import { QueryClient } from '@tanstack/react-query'
import { isApiErrorKind } from './client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only transient failures are worth retrying; a 404 or 403 won't change.
      retry: (failureCount, error) =>
        failureCount < 2 && isApiErrorKind(error, 'offline', 'timeout', 'server'),
      refetchOnWindowFocus: false,
      staleTime: 30_000
    }
  }
})
