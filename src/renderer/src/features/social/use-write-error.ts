import { useCallback } from 'react'
import { ApiException } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'

/**
 * Error copy for write actions. Plugins answer refused writes (banned from a
 * node, creator leaving, missing reason) with 403/422 and a friendly message,
 * so those show the server's text; everything else uses our translation.
 */
export function useWriteErrorMessage(): (error: unknown) => string {
  const errorMessage = useErrorMessage()
  return useCallback(
    (error: unknown) => {
      if (error instanceof ApiException && error.error.serverMessage) {
        const { kind, serverMessage } = error.error
        if (kind === 'forbidden' || kind === 'unprocessable') return serverMessage
      }
      return errorMessage(error)
    },
    [errorMessage]
  )
}
