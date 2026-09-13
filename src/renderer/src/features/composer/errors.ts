import { useCallback } from 'react'
import { useErrorMessage } from '../../api/use-error-message'

/**
 * A plugin refused with HTTP 200 and `success:false` (lottery). The message
 * is the plugin's own user-facing text.
 */
export class RefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RefusedError'
  }
}

/** `useErrorMessage`, plus the plugin's text for refusals. */
export function useComposerErrorMessage(): (error: unknown) => string {
  const base = useErrorMessage()
  return useCallback((error: unknown) => (error instanceof RefusedError && error.message ? error.message : base(error)), [base])
}
