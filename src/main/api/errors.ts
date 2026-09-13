import type { ApiError } from '@shared/api'

const OFFLINE_CODES = [
  'ERR_INTERNET_DISCONNECTED',
  'ERR_NAME_NOT_RESOLVED',
  'ERR_NETWORK_CHANGED',
  'ERR_NETWORK_IO_SUSPENDED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_FAILED',
  'ERR_ADDRESS_UNREACHABLE',
  'ERR_PROXY_CONNECTION_FAILED'
]
const TIMEOUT_CODES = ['ERR_TIMED_OUT', 'ERR_CONNECTION_TIMED_OUT']

/** A request that never got an HTTP response. Chromium reports `net::ERR_*` in the message. */
export function classifyNetworkError(error: unknown): ApiError {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return { kind: 'timeout' }
    if (TIMEOUT_CODES.some((code) => error.message.includes(code))) return { kind: 'timeout' }
    if (OFFLINE_CODES.some((code) => error.message.includes(code))) return { kind: 'offline' }
  }
  return { kind: 'unknown' }
}

export function classifyHttpError(status: number, headers: Headers, bodyText: string): ApiError {
  const body = parseObject(bodyText)
  const base: ApiError = {
    kind: 'unknown',
    status,
    serverMessage: firstMessage(body),
    errorType: typeof body?.error_type === 'string' ? body.error_type : undefined
  }

  // `server: cloudflare` is on every response, so it proves nothing. A real
  // challenge carries `cf-mitigated`, or is a 403 with an HTML page where
  // Discourse would have sent JSON.
  const isHtml = (headers.get('content-type') ?? '').includes('text/html')
  if (headers.has('cf-mitigated') || (status === 403 && isHtml)) return { ...base, kind: 'challenged' }

  if (status === 401 || base.errorType === 'not_logged_in') return { ...base, kind: 'unauthorized' }

  switch (status) {
    case 400:
      return { ...base, kind: 'invalidRequest' }
    case 403:
      return { ...base, kind: 'forbidden' }
    case 404:
      return { ...base, kind: 'notFound' }
    case 409:
      return { ...base, kind: 'conflict' }
    case 413:
      return { ...base, kind: 'tooLarge' }
    case 422:
      return { ...base, kind: 'unprocessable' }
    case 429:
      return { ...base, kind: 'rateLimited', retryAfterSeconds: retryAfter(headers, body) }
  }
  return { ...base, kind: status >= 500 ? 'server' : 'unknown' }
}

type JsonObject = Record<string, unknown>

function parseObject(text: string): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined
  } catch {
    return undefined
  }
}

/** Discourse uses `errors: [...]`; several NodeLoc plugins use `error` or `message`. */
function firstMessage(body: JsonObject | undefined): string | undefined {
  if (!body) return undefined
  if (Array.isArray(body.errors) && typeof body.errors[0] === 'string') return body.errors[0]
  if (typeof body.error === 'string') return body.error
  if (typeof body.message === 'string') return body.message
  return undefined
}

function retryAfter(headers: Headers, body: JsonObject | undefined): number | undefined {
  const header = Number(headers.get('retry-after'))
  if (Number.isFinite(header) && header > 0) return header
  const extras = body?.extras as JsonObject | undefined
  const wait = extras?.wait_seconds
  return typeof wait === 'number' && wait > 0 ? wait : undefined
}
