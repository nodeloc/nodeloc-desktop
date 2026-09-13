import { Zap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { Post } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import { CURRENT_USER_KEY, useCurrentUser } from '../account/use-session'
import styles from './RewardDialog.module.css'

const PRESETS = [1, 5, 10, 20, 50]
const NOTE_LIMIT = 100

interface RewardResponse {
  success: boolean
  error?: string
}

/**
 * discourse-reward: tip energy to a post. One tip per person per post, capped
 * by trust level. Failures come back as HTTP 200 with `success: false`.
 */
export function RewardDialog({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const [amount, setAmount] = useState(10)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const balance = user?.gamification_score
  const valid = Number.isInteger(amount) && amount > 0

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const form: Array<[string, string | number]> = [
        ['post_id', post.id],
        ['amount', amount]
      ]
      if (note.trim()) form.push(['note', note.trim()])
      const response = await apiRequest<RewardResponse>({ method: 'POST', path: '/reward/give', form, priority: 'user' })
      if (!response.success) {
        setError(response.error ?? t('errors.unknown'))
        return
      }
      showToast(t('interactions.reward.success', { amount, username: post.username }), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic', post.topic_id] })
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
      setNote('')
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('interactions.reward.title', { username: post.username })} width={400}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.presets} role="radiogroup" aria-label={t('interactions.reward.amount')}>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={amount === preset}
              className={cx(styles.preset, amount === preset && styles.selected)}
              onClick={() => setAmount(preset)}
            >
              <Zap fill="currentColor" />
              {preset}
            </button>
          ))}
        </div>
        <label className={styles.field}>
          <span>{t('interactions.reward.custom')}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(amount) ? amount : ''}
            onChange={(event) => setAmount(Math.floor(Number(event.target.value)))}
          />
        </label>
        <label className={styles.field}>
          <span>{t('interactions.reward.note')}</span>
          <input
            type="text"
            maxLength={NOTE_LIMIT}
            value={note}
            placeholder={t('interactions.reward.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {balance !== undefined && (
          <p className={styles.balance}>{t('interactions.reward.balance', { value: formatCount(balance, i18n.language) })}</p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!valid || busy} icon={<Zap fill="currentColor" />}>
            {t('interactions.reward.submit', { amount: valid ? amount : 0 })}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
