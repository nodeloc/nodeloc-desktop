import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../account/use-session'

/**
 * The account's `send_shortcut` (a Rails enum sent as its name). `enter`
 * sends on Enter; anything else keeps Enter for new lines and sends on
 * Ctrl+Enter, which always works either way.
 */
export function useSendShortcut(): { enterSends: boolean; hint: string } {
  const { t } = useTranslation()
  const enterSends = useCurrentUser()?.user_option?.send_shortcut === 'enter'
  return { enterSends, hint: enterSends ? t('composer.shortcutEnter') : t('composer.shortcutCtrlEnter') }
}
