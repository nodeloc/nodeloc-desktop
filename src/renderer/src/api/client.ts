import type { ApiError, ApiErrorKind, ApiRequest } from '@shared/api'

/** A classified API failure, thrown so TanStack Query can see it. */
export class ApiException extends Error {
  constructor(readonly error: ApiError) {
    super(`API request failed: ${error.kind}${error.status ? ` (${error.status})` : ''}`)
    this.name = 'ApiException'
  }
}

export async function apiRequest<T>(request: ApiRequest): Promise<T> {
  const result = await window.nodeloc.api.request<T>(request)
  if (!result.ok) throw new ApiException(result.error)
  return result.data
}

export function isApiErrorKind(error: unknown, ...kinds: ApiErrorKind[]): boolean {
  return error instanceof ApiException && kinds.includes(error.error.kind)
}
