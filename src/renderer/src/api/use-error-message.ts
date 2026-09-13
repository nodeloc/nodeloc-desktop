import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException } from './client'

/**
 * Turns any thrown error into copy a user can read. Validation-type errors
 * show the server's own message (plugins send friendly Chinese text); every
 * other kind uses our translation, never a status code.
 */
export function useErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation()
  return useCallback(
    (error: unknown) => {
      if (!(error instanceof ApiException)) return t('errors.unknown')
      const { kind, serverMessage } = error.error
      const showsServerText = kind === 'unprocessable' || kind === 'invalidRequest' || kind === 'conflict'
      return showsServerText && serverMessage ? serverMessage : t(`errors.${kind}`)
    },
    [t]
  )
}
