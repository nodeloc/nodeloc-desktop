import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { APP_PREFERENCES_KEY } from '../features/settings/preferences'
import { applyLanguage } from './language'

/** Keeps every window in the saved language, including live system-language changes. */
export function LanguageSync(): null {
  const preferences = useQuery({
    queryKey: APP_PREFERENCES_KEY,
    queryFn: () => window.nodeloc.app.getPreferences(),
    staleTime: Infinity
  }).data

  useEffect(() => {
    if (preferences) void applyLanguage(preferences.language)
  }, [preferences?.language])

  useEffect(() => {
    if (preferences?.language !== 'system') return
    const sync = (): void => {
      void applyLanguage('system')
      // Re-run the main-process locale selection for tray menus and notifications.
      void window.nodeloc.app.updatePreferences({ language: 'system' })
    }
    window.addEventListener('languagechange', sync)
    return () => window.removeEventListener('languagechange', sync)
  }, [preferences?.language])

  return null
}
