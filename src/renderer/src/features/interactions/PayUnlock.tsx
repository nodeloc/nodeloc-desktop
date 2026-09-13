import { Coins, LockKeyholeOpen } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { Post } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import { formatCount } from '../../lib/format'
import { CURRENT_USER_KEY, useCurrentUser, useRequireSignIn } from '../account/use-session'
import { usePostOverrides } from './post-overrides'
import styles from './PostDialogs.module.css'

interface PayResponse {
  success: boolean
  already_paid?: boolean
  error?: string
}

interface RefreshCookedResponse {
  cooked: Record<string, string>
}

interface PayUnlockProps {
  post: Post
  amount: number
  /** `data-content-id` on the placeholder; absent on sites without per-block payments. */
  contentId?: string
}

/** The "unlock" button inside a discourse-permission `[pay]` placeholder. */
export function PayUnlockButton({ post, amount, contentId }: PayUnlockProps): React.JSX.Element {
  const { t } = useTranslation()
  const requireSignIn = useRequireSignIn()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={styles.payButton}
        onClick={(event) => {
          event.stopPropagation()
          if (requireSignIn()) setOpen(true)
        }}
      >
        <LockKeyholeOpen strokeWidth={2.5} />
        {t('interactions.pay.unlock')}
      </button>
      {open && <PayUnlockDialog post={post} amount={amount} contentId={contentId} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * `POST /permission/pay` (`topic_id`, `post_id`, `content_id`, `amount`).
 * Failures come back as HTTP 200 with `success: false`. On success the post's
 * cooked HTML is re-read for this user via `GET /permission/refresh_cooked`.
 */
function PayUnlockDialog({ post, amount, contentId, onClose }: PayUnlockProps & { onClose: () => void }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const patchLocal = usePostOverrides((state) => state.patchLocal)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const balance = user?.gamification_score
  const short = balance !== undefined && balance < amount

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const form: Array<[string, string | number]> = [
        ['topic_id', post.topic_id],
        ['post_id', post.id],
        ['amount', amount]
      ]
      if (contentId) form.push(['content_id', contentId])
      const response = await apiRequest<PayResponse>({ method: 'POST', path: '/permission/pay', form, priority: 'user' })
      if (!response.success) {
        setError(response.error ?? t('errors.unknown'))
        return
      }
      showToast(response.already_paid ? t('interactions.pay.alreadyPaid') : t('interactions.pay.success'), 'success')
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
      void queryClient.invalidateQueries({ queryKey: ['topic', post.topic_id] })
      try {
        const refreshed = await apiRequest<RefreshCookedResponse>({
          path: '/permission/refresh_cooked',
          query: { 'post_ids[]': [post.id] },
          priority: 'user'
        })
        const cooked = refreshed.cooked[String(post.id)]
        if (cooked) patchLocal(post, { cooked })
      } catch {
        // The topic refetch above still brings the unlocked content.
      }
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={t('interactions.pay.title')} width={380}>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <div className={styles.amount}>
          <Coins />
          {formatCount(amount, i18n.language)}
          <small>{t('interactions.pay.energy')}</small>
        </div>
        <p className={styles.text}>{t('interactions.pay.summary', { username: post.username })}</p>
        {balance !== undefined && (
          <p className={styles.muted}>{t('interactions.pay.balance', { value: formatCount(balance, i18n.language) })}</p>
        )}
        {(error || short) && (
          <p className={styles.error} role="alert">
            {error ?? t('interactions.pay.insufficient')}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy} icon={<LockKeyholeOpen strokeWidth={2.5} />}>
            {t('interactions.pay.confirm', { amount })}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
