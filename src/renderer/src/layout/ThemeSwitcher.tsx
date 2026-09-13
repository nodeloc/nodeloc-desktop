import type { ThemeSource } from '@shared/bridge'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../components/Button'
import { DropdownMenu } from '../components/DropdownMenu'
import { cx } from '../lib/cx'
import styles from './ThemeSwitcher.module.css'

const APP_INFO_KEY = ['app-info'] as const

const THEME_ICONS: Record<ThemeSource, ReactNode> = {
  system: <Monitor />,
  light: <Sun />,
  dark: <Moon />
}

/** The saved theme source and a setter. Sets nativeTheme in the main process, which flips `prefers-color-scheme` here. */
function useThemeSource(): { current: ThemeSource | undefined; setSource: (source: ThemeSource) => void } {
  const queryClient = useQueryClient()
  const { data: info } = useQuery({
    queryKey: APP_INFO_KEY,
    queryFn: () => window.nodeloc.app.getInfo(),
    staleTime: Infinity
  })
  const mutation = useMutation({
    mutationFn: (source: ThemeSource) => window.nodeloc.theme.setSource(source),
    onSuccess: (_result, source) => {
      queryClient.setQueryData(APP_INFO_KEY, (previous: typeof info) => previous && { ...previous, themeSource: source })
    }
  })
  return { current: mutation.isPending ? mutation.variables : info?.themeSource, setSource: mutation.mutate }
}

function useThemeOptions(): Array<{ value: ThemeSource; label: string }> {
  const { t } = useTranslation()
  return [
    { value: 'system', label: t('sidebar.themeSystem') },
    { value: 'light', label: t('sidebar.themeLight') },
    { value: 'dark', label: t('sidebar.themeDark') }
  ]
}

/** Segmented control (settings page). */
export function ThemeSwitcher(): React.JSX.Element {
  const { t } = useTranslation()
  const { current, setSource } = useThemeSource()
  const options = useThemeOptions()

  return (
    <div className={styles.switcher} role="radiogroup" aria-label={t('sidebar.theme')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={current === option.value}
          className={cx(styles.option, current === option.value && styles.selected)}
          onClick={() => setSource(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** An icon showing the current theme; opens a menu to change it (account bar). */
export function ThemeMenuButton(): React.JSX.Element {
  const { t } = useTranslation()
  const { current, setSource } = useThemeSource()
  const options = useThemeOptions()

  return (
    <DropdownMenu
      placement="top"
      trigger={({ toggle }) => (
        <IconButton label={t('sidebar.theme')} size="sm" onClick={toggle}>
          {THEME_ICONS[current ?? 'system']}
        </IconButton>
      )}
      items={options.map((option) => ({
        key: option.value,
        label: option.label,
        icon: THEME_ICONS[option.value],
        checked: current === option.value,
        onSelect: () => setSource(option.value)
      }))}
    />
  )
}
