import { Circle, CircleCheck, Square, SquareCheck } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../../api/client'
import type { Post } from '../../../api/types'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button } from '../../../components/Button'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { useRequireSignIn } from '../../account/use-session'
import { renderChildren } from '../render-dom'
import { sanitizeCooked } from '../sanitize'
import styles from './PollBlock.module.css'

interface PollBlockProps {
  name: string
  post?: Post
}

/**
 * Renders a discourse-poll from the post's `polls` data (the HTML only
 * carries the option list). Single-choice polls vote on click; multiple-choice
 * polls collect a selection and submit. Ranked-choice polls are read-only.
 */
export function PollBlock({ name, post }: PollBlockProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const requireSignIn = useRequireSignIn()
  const poll = post?.polls?.find((candidate) => candidate.name === name)
  const votedIds = post?.polls_votes?.[name]
  const voted = useMemo(() => new Set(votedIds ?? []), [votedIds])
  const [selection, setSelection] = useState<Set<string>>(voted)
  const [busy, setBusy] = useState(false)

  // Server state wins after each refetch.
  useEffect(() => setSelection(voted), [voted])

  if (!poll || !post) return null

  const multiple = poll.type === 'multiple'
  const votable = poll.type !== 'ranked_choice'
  const closed = poll.status === 'closed'
  const hasVoted = voted.size > 0
  const showResults = poll.results === 'always' || closed || (poll.results === 'on_vote' && hasVoted)
  const totalVotes = poll.options.reduce((sum, option) => sum + (option.votes ?? 0), 0)
  const denominator = multiple ? Math.max(poll.voters, 1) : Math.max(totalVotes, 1)
  const min = poll.min ?? 1
  const max = poll.max ?? poll.options.length

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['topic', post.topic_id] })
  }

  const submit = async (options: string[]): Promise<void> => {
    if (!requireSignIn()) return
    setBusy(true)
    try {
      await apiRequest({
        method: 'PUT',
        path: '/polls/vote',
        form: [['post_id', post.id], ['poll_name', name], ...options.map((id) => ['options[]', id] as [string, string])],
        priority: 'user'
      })
      showToast(t('interactions.poll.voted'), 'success')
      refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
      setSelection(voted)
    } finally {
      setBusy(false)
    }
  }

  const removeVote = async (): Promise<void> => {
    if (!requireSignIn()) return
    setBusy(true)
    try {
      await apiRequest({
        method: 'DELETE',
        path: '/polls/vote',
        form: [
          ['post_id', post.id],
          ['poll_name', name]
        ],
        priority: 'user'
      })
      showToast(t('interactions.poll.removed'))
      refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const onOption = (id: string): void => {
    if (closed || !votable || busy) return
    if (!multiple) {
      if (!voted.has(id)) void submit([id])
      return
    }
    setSelection((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else if (next.size < max) next.add(id)
      return next
    })
  }

  return (
    <div className={styles.poll}>
      {poll.title && <div className={styles.title}>{poll.title}</div>}
      <ul className={styles.options}>
        {poll.options.map((option) => {
          const votes = option.votes ?? 0
          const percent = showResults ? Math.round((votes / denominator) * 100) : 0
          const selected = multiple ? selection.has(option.id) : voted.has(option.id)
          const Icon = multiple ? (selected ? SquareCheck : Square) : selected ? CircleCheck : Circle
          return (
            <li key={option.id}>
              <button
                type="button"
                className={cx(styles.option, selected && styles.selected)}
                disabled={closed || !votable || busy}
                title={t('content.poll.vote')}
                aria-pressed={selected}
                onClick={() => onOption(option.id)}
              >
                {showResults && <span className={styles.bar} style={{ width: `${percent}%` }} />}
                <Icon className={styles.icon} strokeWidth={selected ? 2.5 : 2} />
                <OptionLabel html={option.html} />
                {showResults && (
                  <span className={styles.percent}>
                    {percent}% <span className={styles.votes}>({votes})</span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <footer className={styles.footer}>
        <span>{t('content.poll.voters', { count: poll.voters })}</span>
        <span className={styles.status} data-closed={closed}>
          {closed ? t('content.poll.closed') : t('content.poll.open')}
        </span>
        {multiple && <span>{t('content.poll.multiple', { min, max })}</span>}
        {poll.close && !closed && (
          <span>{t('content.poll.closesAt', { time: new Date(poll.close).toLocaleString(i18n.language) })}</span>
        )}
        {!showResults && (
          <span>{poll.results === 'on_close' ? t('content.poll.resultsOnClose') : t('content.poll.resultsHidden')}</span>
        )}
        {!closed && votable && (
          <span className={styles.footerActions}>
            {multiple && (
              <Button
                size="sm"
                variant="primary"
                disabled={busy || selection.size < min}
                onClick={() => void submit([...selection])}
              >
                {t('interactions.poll.submit')}
              </Button>
            )}
            {hasVoted && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removeVote()}>
                {t('content.poll.removeVote')}
              </Button>
            )}
          </span>
        )}
      </footer>
    </div>
  )
}

/** Option text is cooked inline HTML (may contain emoji images). */
function OptionLabel({ html }: { html: string }): React.JSX.Element {
  const nodes = useMemo(() => renderChildren(sanitizeCooked(html), { images: [], inOnebox: true }, 'o'), [html])
  return <span className={styles.label}>{nodes}</span>
}
