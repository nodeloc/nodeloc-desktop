import { Flag } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useSite } from '../../api/site'
import type { Post, PostActionType, SiteResponse } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import styles from './PostDialogs.module.css'

export type FlagTarget = { kind: 'post'; post: Post } | { kind: 'topic'; topicId: number }

interface FlagOption {
  type: PostActionType
  /** Already flagged this way; shown but not selectable. */
  acted: boolean
}

/**
 * Flag types the reader may use. Posts: `site.post_action_types` flags that
 * the post's `actions_summary` marks `can_act` (or already acted). Topics:
 * `site.topic_flag_types`. Both include the site's custom flags.
 */
export function flagOptions(site: SiteResponse | undefined, target: FlagTarget): FlagOption[] {
  if (!site) return []
  if (target.kind === 'topic') {
    return (site.topic_flag_types ?? [])
      .filter((type) => type.is_flag && type.enabled !== false)
      .map((type) => ({ type, acted: false }))
  }
  const summaries = target.post.actions_summary ?? []
  return site.post_action_types
    .filter((type) => type.is_flag && type.enabled !== false && (!type.applies_to || type.applies_to.includes('Post')))
    .flatMap((type) => {
      const summary = summaries.find((entry) => entry.id === type.id)
      if (!summary?.can_act && !summary?.acted) return []
      return [{ type, acted: Boolean(summary.acted) }]
    })
}

/** Type names and descriptions may carry HTML (links to the guidelines) and a `{{username}}` slot. */
function plainText(html: string, username?: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  return username ? text.replace(/\{\{username\}\}|%\{username\}/g, username) : text
}

/** `POST /post_actions` with `id`, `post_action_type_id`, `message`, and `flag_topic` for topics. */
export function FlagDialog({ target, open, onClose }: { target: FlagTarget; open: boolean; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const site = useSite().data
  const [typeId, setTypeId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => flagOptions(site, target), [site, target])
  const username = target.kind === 'post' ? target.post.username : undefined
  const topicId = target.kind === 'post' ? target.post.topic_id : target.topicId
  const selected = options.find((option) => option.type.id === typeId && !option.acted)?.type
  const needsMessage = Boolean(selected?.require_message)
  const valid = selected !== undefined && (!needsMessage || message.trim().length > 0)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!selected || !valid) return
    setBusy(true)
    setError(null)
    try {
      const form: Array<[string, string | number]> = [
        ['id', target.kind === 'post' ? target.post.id : target.topicId],
        ['post_action_type_id', selected.id]
      ]
      if (message.trim()) form.push(['message', message.trim()])
      if (target.kind === 'topic') form.push(['flag_topic', 'true'])
      await apiRequest({ method: 'POST', path: '/post_actions.json', form, priority: 'user' })
      showToast(t('interactions.flag.success'), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic', topicId] })
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(target.kind === 'topic' ? 'interactions.flag.topicTitle' : 'interactions.flag.title')}
      width={480}
    >
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        {options.length === 0 ? (
          <p className={styles.text}>{site ? t('interactions.flag.noTypes') : t('common.loading')}</p>
        ) : (
          <div className={styles.options} role="radiogroup" aria-label={t('interactions.flag.type')}>
            {options.map(({ type, acted }) => (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={typeId === type.id}
                disabled={acted}
                className={cx(styles.option, typeId === type.id && styles.selected)}
                onClick={() => setTypeId(type.id)}
              >
                <span className={styles.radio} aria-hidden="true" />
                <span className={styles.optionText}>
                  <span className={styles.optionName}>
                    {plainText(type.name, username)}
                    {acted && ` · ${t('interactions.flag.flagged')}`}
                  </span>
                  {type.description && <span className={styles.optionDescription}>{plainText(type.description, username)}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        {needsMessage && (
          <label className={styles.field}>
            <span>{t('interactions.flag.message')}</span>
            <textarea
              value={message}
              placeholder={t('interactions.flag.messagePlaceholder')}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
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
          <Button type="submit" variant="primary" disabled={!valid || busy} icon={<Flag />}>
            {t('interactions.flag.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
