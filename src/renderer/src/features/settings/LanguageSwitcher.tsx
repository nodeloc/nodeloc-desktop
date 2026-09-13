import type { AppPreferences, LanguagePreference } from '@shared/bridge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import switcherStyles from '../../layout/ThemeSwitcher.module.css'
import { APP_PREFERENCES_KEY } from './preferences'

const LANGUAGES: readonly LanguagePreference[] = ['system', 'zh-CN', 'en']

export function LanguageSwitcher(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const preferences = useQuery({
    queryKey: APP_PREFERENCES_KEY,
    queryFn: () => window.nodeloc.app.getPreferences(),
    staleTime: Infinity
  })
  const update = useMutation({
    mutationFn: (language: LanguagePreference) => window.nodeloc.app.updatePreferences({ language }),
    onSuccess: (next) => {
      queryClient.setQueryData<AppPreferences>(APP_PREFERENCES_KEY, next)
    }
  })
  const current = update.isPending ? update.variables : preferences.data?.language

  return (
    <div className={switcherStyles.switcher} role="radiogroup" aria-label={t('settings.appearance.language')}>
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          role="radio"
          aria-checked={current === language}
          className={cx(switcherStyles.option, current === language && switcherStyles.selected)}
          onClick={() => update.mutate(language)}
        >
          {t(`settings.appearance.languages.${language}`)}
        </button>
      ))}
    </div>
  )
}
