export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/**
 * Scheduling class. `user` is a direct user action and is never held back;
 * `background` yields first when the API key budget runs low.
 */
export type RequestPriority = 'user' | 'foreground' | 'background'

export type QueryPrimitive = string | number | boolean
export type QueryValue = QueryPrimitive | readonly QueryPrimitive[] | null | undefined

/**
 * One form field. Discourse needs ordered, repeatable keys
 * (`options[]=a&options[]=b`), which a plain object can't express.
 */
export type FormField = readonly [name: string, value: QueryPrimitive]

export interface ApiRequest {
  method?: HttpMethod
  /** Site-relative path such as `/latest.json`. Absolute URLs are rejected. */
  path: string
  /** Array values repeat the key as given, so pass `post_ids[]` to get brackets. */
  query?: Record<string, QueryValue>
  form?: readonly FormField[]
  json?: unknown
  /**
   * Plugin-specific request headers (e.g. discourse-checkin's). Only an
   * allowlist in the main process is forwarded; everything else is dropped.
   */
  headers?: Record<string, string>
  priority?: RequestPriority
  /** Defaults to 20 seconds. */
  timeoutMs?: number
}

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'invalidRequest'
  | 'unprocessable'
  | 'tooLarge'
  | 'rateLimited'
  | 'server'
  | 'challenged'
  | 'offline'
  | 'timeout'
  | 'decode'
  | 'unknown'

/**
 * A failed request, classified. Carries no user-facing text: the renderer
 * turns `kind` into a translated message, and shows `serverMessage` only for
 * validation errors, where plugins send friendly Chinese copy.
 */
export interface ApiError {
  kind: ApiErrorKind
  status?: number
  serverMessage?: string
  errorType?: string
  retryAfterSeconds?: number
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; error: ApiError }

export type UploadType =
  | 'composer'
  | 'avatar'
  | 'card_background'
  | 'profile_background'
  | 'chat-composer'
  | 'category_logo'
  | 'category_logo_dark'
  | 'category_background'
  | 'category_background_dark'

export interface UploadRequest {
  fileName: string
  mimeType: string
  data: ArrayBuffer
  uploadType: UploadType
}

/** `POST /uploads.json` response (synchronous upload). */
export interface UploadResult {
  id: number
  url: string
  short_url: string
  short_path?: string
  original_filename: string
  filesize: number
  width?: number | null
  height?: number | null
  thumbnail_width?: number | null
  thumbnail_height?: number | null
  extension: string
  human_filesize?: string
}
