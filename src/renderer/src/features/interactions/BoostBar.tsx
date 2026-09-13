import { Check, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Boost, Post } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { IconButton } from '../../components/Button'
import { cx } from '../../lib/cx'
import { PostContent } from '../content/PostContent'
import { useCurrentUser } from '../account/use-session'
import styles from './BoostBar.module.css'
import { useLocalPost } from './post-overrides'
import { BOOST_MAX_EMOJI, BOOST_MAX_LENGTH, boostStats, useBoostActions } from './use-boosts'

interface BoostBarProps {
  post: Post
  /** The add-a-boost input is open. */
  composing: boolean
  onCloseComposer: () => void
}

/** discourse-boosts bubbles under a post, plus the input for adding one. */
export function BoostBar({ post, composing, onCloseComposer }: BoostBarProps): React.JSX.Element | null {
  const { boosts } = useLocalPost(post)
  const actions = useBoostActions(post)
  const list = boosts ?? []

  if (list.length === 0 && !composing) return null

  return (
    <div className={styles.bar}>
      {list.map((boost) => (
        <BoostBubble
          key={boost.id}
          boost={boost}
          pending={boost.id < 0}
          onRemove={boost.can_delete ? () => void actions.remove(boost) : undefined}
        />
      ))}
      {composing && (
        <BoostInput
          username={post.username}
          onCancel={onCloseComposer}
          onSubmit={(raw) => {
            onCloseComposer()
            void actions.add(raw)
          }}
        />
      )}
    </div>
  )
}

function BoostBubble({ boost, pending, onRemove }: { boost: Boost; pending: boolean; onRemove?: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className={cx(styles.bubble, pending && styles.pending)} title={t('interactions.boost.by', { username: boost.user.username })}>
      <Avatar template={boost.user.avatar_template} username={boost.user.username} size={18} />
      <PostContent html={boost.cooked} size="reply" className={styles.text} />
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={t('interactions.boost.remove')} title={t('interactions.boost.remove')} onClick={onRemove}>
          <X strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}

function BoostInput({ username, onSubmit, onCancel }: { username: string; onSubmit: (raw: string) => void; onCancel: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const [value, setValue] = useState('')
  const stats = boostStats(value.trim())
  const over = stats.length > BOOST_MAX_LENGTH || stats.emoji > BOOST_MAX_EMOJI
  const valid = value.trim().length > 0 && !over

  const submit = (): void => {
    if (valid) onSubmit(value.trim())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className={styles.input}>
      {user && <Avatar template={user.avatar_template} username={user.username} size={18} />}
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        type="text"
        value={value}
        placeholder={t('interactions.boost.placeholder', { username })}
        aria-invalid={over || undefined}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className={cx(styles.counter, over && styles.over)} title={t('interactions.boost.limit', { length: BOOST_MAX_LENGTH, emoji: BOOST_MAX_EMOJI })}>
        {stats.length}/{BOOST_MAX_LENGTH}
      </span>
      <IconButton label={t('interactions.boost.submit')} size="sm" disabled={!valid} onClick={submit}>
        <Check strokeWidth={2.5} />
      </IconButton>
      <IconButton label={t('common.cancel')} size="sm" onClick={onCancel}>
        <X strokeWidth={2.5} />
      </IconButton>
    </div>
  )
}
