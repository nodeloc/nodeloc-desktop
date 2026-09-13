import { useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException, apiRequest } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import type { ProfileResponse, ProfileUser } from './types'
import { userCardKey } from './use-profile'
import styles from './UserScreenDialog.module.css'

type ScreenLevel = 'normal' | 'mute' | 'ignore'
type IgnoreDuration = 'day' | 'week' | 'month' | 'forever'

const DURATION_DAYS: Record<IgnoreDuration, number> = {
  day: 1,
  week: 7,
  month: 30,
  forever: 36_500
}

function initialLevel(user: ProfileUser): ScreenLevel {
  if (user.ignored) return 'ignore'
  if (user.muted) return 'mute'
  return 'normal'
}

export function UserScreenDialog({ user, onClose }: { user: ProfileUser; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const [level, setLevel] = useState<ScreenLevel>(() => initialLevel(user))
  const [duration, setDuration] = useState<IgnoreDuration>('forever')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const form: Array<[string, string]> = [['notification_level', level]]
      if (level === 'ignore') {
        const expires = new Date(Date.now() + DURATION_DAYS[duration] * 86_400_000)
        form.push(['expiring_at', expires.toISOString()])
      }
      const result = await apiRequest<{ success?: boolean; error?: string }>({
        method: 'PUT',
        path: `/u/${encodeURIComponent(user.username)}/notification_level.json`,
        form,
        priority: 'user'
      })
      if (result.success === false) {
        throw new ApiException({ kind: 'invalidRequest', serverMessage: result.error })
      }
      queryClient.setQueryData<ProfileResponse>(userCardKey(user.username), (data) =>
        data
          ? {
              ...data,
              user: { ...data.user, muted: level === 'mute', ignored: level === 'ignore' }
            }
          : data
      )
      showToast(t(`profile.screen.saved.${level}`, { username: user.username }), 'success')
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const options: Array<{ level: ScreenLevel; icon: React.JSX.Element; disabled?: boolean }> = [
    { level: 'normal', icon: <Bell /> },
    { level: 'mute', icon: <BellOff />, disabled: user.can_mute_user === false },
    { level: 'ignore', icon: <EyeOff />, disabled: user.can_ignore_user === false }
  ]

  return (
    <Dialog open onClose={onClose} title={t('profile.screen.title', { username: user.username })} width={440}>
      <form className={styles.form} onSubmit={(event) => void save(event)}>
        <div className={styles.options} role="radiogroup" aria-label={t('profile.screen.level')}>
          {options.map((option) => (
            <button
              key={option.level}
              type="button"
              role="radio"
              aria-checked={level === option.level}
              disabled={option.disabled}
              className={cx(styles.option, level === option.level && styles.selected)}
              onClick={() => setLevel(option.level)}
            >
              <span className={styles.optionIcon}>{option.icon}</span>
              <span>
                <strong>{t(`profile.screen.levels.${option.level}.label`)}</strong>
                <small>{t(`profile.screen.levels.${option.level}.description`)}</small>
              </span>
            </button>
          ))}
        </div>

        {level === 'ignore' && (
          <label className={styles.duration}>
            <span>{t('profile.screen.duration')}</span>
            <select value={duration} onChange={(event) => setDuration(event.target.value as IgnoreDuration)}>
              {(Object.keys(DURATION_DAYS) as IgnoreDuration[]).map((value) => (
                <option key={value} value={value}>
                  {t(`profile.screen.durations.${value}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={busy}>{t('profile.screen.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
