import { session, type Session } from 'electron'
import { randomBytes } from 'node:crypto'
import type { ApiRequest, ApiResult, RequestPriority, UploadRequest, UploadResult } from '@shared/api'
import { isDevelopment } from '../environment'
import { classifyHttpError, classifyNetworkError } from './errors'
import type { RequestScheduler } from './scheduler'

export interface Credentials {
  userApiKey: string
  clientId: string
}

export interface DiscourseClientOptions {
  origin: string
  partition: string
  scheduler: RequestScheduler
  getCredentials: () => Credentials | null
  /**
   * The server stopped recognising our key. MessageBus doesn't fail in that
   * case, it quietly serves us as a guest, so this header is the only signal.
   */
  onLoggedOut?: () => void
}

const DEFAULT_TIMEOUT_MS = 20_000
const UPLOAD_TIMEOUT_MS = 180_000
/** Short rolling-window limits benefit from a global pause; daily limits do not. */
const MAX_GLOBAL_BACKOFF_SECONDS = 5 * 60

/** Renderer-supplied headers that are passed on (plugin protocols); anything else is dropped. */
const FORWARDED_HEADERS = new Set(['x-discourse-checkin', 'x-checkin-nonce'])

/** Longer than Discourse's ~25 s long-poll hold. */
const POLL_TIMEOUT_MS = 60_000

interface PreparedRequest {
  url: URL
  method: string
  body?: string | Uint8Array
  contentType?: string
  extraHeaders?: Record<string, string>
  priority: RequestPriority
  timeoutMs: number
  /** Caller-controlled cancellation (e.g. restarting a long poll). */
  signal?: AbortSignal
  /** Retry selected public reads without a rate-limited User API Key. */
  anonymous?: boolean
}

/**
 * The only place that talks to the forum. Lives in the main process so the
 * User API Key never reaches the renderer, and so requests aren't subject to
 * CORS (MessageBus doesn't allow the `User-Api-Key` header cross-origin).
 */
export class DiscourseClient {
  private cachedSession: Session | undefined

  constructor(private readonly options: DiscourseClientOptions) {}

  request<T>(request: ApiRequest): Promise<ApiResult<T>> {
    const url = this.buildUrl(request.path, request.query)
    if (!url) return Promise.resolve({ ok: false, error: { kind: 'invalidRequest' } })

    let body: string | undefined
    let contentType: string | undefined
    if (request.form) {
      const params = new URLSearchParams()
      for (const [name, value] of request.form) params.append(name, String(value))
      body = params.toString()
      contentType = 'application/x-www-form-urlencoded; charset=UTF-8'
    } else if (request.json !== undefined) {
      body = JSON.stringify(request.json)
      contentType = 'application/json'
    }

    const extraHeaders: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers ?? {})) {
      if (FORWARDED_HEADERS.has(name.toLowerCase()) && typeof value === 'string') extraHeaders[name] = value
    }

    const priority = request.priority ?? 'foreground'
    return this.options.scheduler.schedule(priority, () =>
      this.perform<T>({
        url,
        method: request.method ?? (body === undefined ? 'GET' : 'POST'),
        body,
        contentType,
        extraHeaders,
        priority,
        timeoutMs: request.timeoutMs ?? DEFAULT_TIMEOUT_MS
      })
    )
  }

  /** `POST /uploads.json` as multipart, synchronously processed so the response has the final URL. */
  upload(request: UploadRequest): Promise<ApiResult<UploadResult>> {
    const url = this.buildUrl('/uploads.json')
    if (!url || !(request.data instanceof ArrayBuffer)) {
      return Promise.resolve({ ok: false, error: { kind: 'invalidRequest' } })
    }

    const boundary = `----NodeLocDesktop${randomBytes(12).toString('hex')}`
    const field = (name: string, value: string): string =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    const safeName = request.fileName.replace(/["\r\n]/g, '_') || 'file'
    const head =
      field('upload_type', request.uploadType) +
      field('synchronous', 'true') +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
      `Content-Type: ${request.mimeType || 'application/octet-stream'}\r\n\r\n`
    const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(request.data), Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')])

    return this.options.scheduler.schedule('user', () =>
      this.perform<UploadResult>({
        url,
        method: 'POST',
        body: new Uint8Array(body),
        contentType: `multipart/form-data; boundary=${boundary}`,
        priority: 'user',
        timeoutMs: UPLOAD_TIMEOUT_MS
      })
    )
  }

  /**
   * One MessageBus long poll. `Dont-Chunk` asks for a plain JSON array
   * instead of the chunked streaming format.
   */
  pollMessageBus(clientId: string, fields: ReadonlyArray<readonly [string, number]>, signal: AbortSignal): Promise<ApiResult<unknown[]>> {
    const url = this.buildUrl(`/message-bus/${encodeURIComponent(clientId)}/poll`)
    if (!url) return Promise.resolve({ ok: false, error: { kind: 'invalidRequest' } })
    const params = new URLSearchParams()
    for (const [name, value] of fields) params.append(name, String(value))

    return this.options.scheduler.schedule('background', () =>
      this.perform<unknown[]>({
        url,
        method: 'POST',
        body: params.toString(),
        contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
        extraHeaders: { 'Dont-Chunk': 'true' },
        priority: 'background',
        timeoutMs: POLL_TIMEOUT_MS,
        signal
      })
    )
  }

  private async perform<T>(prepared: PreparedRequest): Promise<ApiResult<T>> {
    const { url, method, body, contentType, priority } = prepared
    const credentials = prepared.anonymous ? null : this.options.getCredentials()
    const headers: Record<string, string> = {
      Accept: 'application/json',
      // Discourse localizes category names and machine-translates posts to the
      // request language; the community writes in Chinese, so ask for that.
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.5',
      'X-Requested-With': 'XMLHttpRequest',
      ...prepared.extraHeaders
    }
    // Updates the user's "last seen"; background polling shouldn't count as presence.
    if (priority !== 'background') headers['Discourse-Present'] = 'true'
    if (contentType) headers['Content-Type'] = contentType
    if (credentials) {
      headers['User-Api-Key'] = credentials.userApiKey
      headers['User-Api-Client-Id'] = credentials.clientId
    }

    // discourse-checkin calls verified_request? itself, so Discourse's normal
    // User API Key CSRF exemption does not apply. Fetch a token in this same
    // cookie session for each explicit check-in (never retry the write).
    if (method === 'POST' && /^\/checkin(?:\.json)?$/.test(url.pathname)) {
      const csrf = await this.perform<{ csrf: string }>({
        url: new URL('/session/csrf.json', this.options.origin),
        method: 'GET',
        priority,
        timeoutMs: prepared.timeoutMs,
        signal: prepared.signal
      })
      if (!csrf.ok) return csrf
      if (typeof csrf.data?.csrf !== 'string' || !csrf.data.csrf) {
        return { ok: false, error: { kind: 'decode', status: csrf.status } }
      }
      headers['X-CSRF-Token'] = csrf.data.csrf
    }

    let response: Response
    let text: string
    try {
      const timeout = AbortSignal.timeout(prepared.timeoutMs)
      response = await this.session().fetch(url.toString(), {
        method,
        headers,
        body,
        signal: prepared.signal ? AbortSignal.any([prepared.signal, timeout]) : timeout
      })
      text = await response.text()
    } catch (error) {
      const classified = classifyNetworkError(error)
      if (!prepared.signal?.aborted) this.log(`${method} ${url} failed: ${classified.kind}`, error)
      return { ok: false, error: classified }
    }

    if (credentials && response.headers.has('discourse-logged-out')) this.options.onLoggedOut?.()

    if (response.ok) {
      if (text.trim() === '') return { ok: true, status: response.status, data: null as T }
      try {
        return { ok: true, status: response.status, data: JSON.parse(text) as T }
      } catch {
        this.log(`${method} ${url} returned non-JSON`, text.slice(0, 200))
        return { ok: false, error: { kind: 'decode', status: response.status } }
      }
    }

    const error = classifyHttpError(response.status, response.headers, text)
    // A User API Key has a daily request budget. Public content should remain
    // usable after that budget is exhausted, so retry known-public reads as a
    // guest before putting authenticated traffic into the server's back-off.
    if (error.kind === 'rateLimited' && credentials && method === 'GET' && supportsAnonymousFallback(url.pathname)) {
      const fallback = await this.perform<T>({ ...prepared, anonymous: true })
      if (fallback.ok) return fallback
    }
    if (
      error.kind === 'rateLimited' &&
      error.retryAfterSeconds &&
      error.retryAfterSeconds <= MAX_GLOBAL_BACKOFF_SECONDS
    ) {
      this.options.scheduler.backOff(error.retryAfterSeconds)
    }
    this.log(
      `${method} ${url} → ${response.status} ${error.kind}`,
      `cf-ray=${response.headers.get('cf-ray') ?? '-'} body=${text.slice(0, 200)}`
    )
    return { ok: false, error }
  }

  /** Accepts only site-relative paths, so the renderer can't point our credentials elsewhere. */
  private buildUrl(path: string, query?: ApiRequest['query']): URL | undefined {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return undefined

    const url = new URL(path, this.options.origin)
    if (url.origin !== this.options.origin) return undefined

    for (const [name, value] of Object.entries(query ?? {})) {
      if (value === null || value === undefined) continue
      const values = Array.isArray(value) ? value : [value]
      for (const item of values) url.searchParams.append(name, String(item))
    }
    return url
  }

  /** Persistent partition, so Cloudflare clearance survives restarts. */
  private session(): Session {
    this.cachedSession ??= session.fromPartition(this.options.partition)
    return this.cachedSession
  }

  private log(message: string, detail?: unknown): void {
    if (!isDevelopment) return
    console.warn(`[api] ${message}`, detail ?? '')
  }
}

/** Public screens that still make sense without signed-in personalization. */
function supportsAnonymousFallback(pathname: string): boolean {
  if (/^\/(?:site|mobile\/meta|nodes|latest|hot|new|top|featured|categories)\.json$/.test(pathname)) return true
  if (/^\/node\/browse\/\d+\.json$/.test(pathname)) return true
  if (/^\/n\/[^/]+\.json$/.test(pathname)) return true
  if (/^\/t\/\d+\.json$/.test(pathname)) return true
  if (/^\/tag\/[^/]+\.json$/.test(pathname)) return true
  if (/^\/apps\/(?:directory|[^/]+)\.json$/.test(pathname)) return true
  return /^\/c\/.+\/l\/(?:latest|hot|new|top|featured)\.json$/.test(pathname)
}
