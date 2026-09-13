import { Check, Search, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Spinner } from '../../components/Spinner'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { paths } from '../../lib/routes'
import { useCurrentUser } from '../account/use-session'
import { CHANNELS_KEY, createDirectMessage, searchUsers } from './chat-api'
import styles from './NewDirectMessageDialog.module.css'
import type { UserSearchResult } from './types'

const SEARCH_DELAY_MS = 250

/** Pick one or more people and open (or reuse) a DM with them. */
export function NewDirectMessageDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  // Mounting the form only while open resets it every time.
  return open ? <DirectMessageForm onClose={onClose} /> : null
}

function DirectMessageForm({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const me = useCurrentUser()
  const [term, setTerm] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<UserSearchResult[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [term])

  const results = useQuery({
    queryKey: ['chat', 'user-search', query],
    queryFn: () => searchUsers(query),
    enabled: query.length > 0,
    staleTime: 60_000
  })
  const users = (results.data ?? []).filter((user) => user.username !== me?.username)

  const toggle = (user: UserSearchResult): void => {
    setSelected((list) =>
      list.some((other) => other.username === user.username) ? list.filter((other) => other.username !== user.username) : [...list, user]
    )
  }

  const start = async (): Promise<void> => {
    if (selected.length === 0 || creating) return
    setCreating(true)
    try {
      const channel = await createDirectMessage(selected.map((user) => user.username))
      void queryClient.invalidateQueries({ queryKey: CHANNELS_KEY })
      onClose()
      navigate(paths.chat(channel.id))
    } catch (error) {
      setCreating(false)
      showToast(errorMessage(error), 'danger')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('chat.dm.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={selected.length === 0 || creating} onClick={() => void start()}>
            {t('chat.dm.start')}
          </Button>
        </>
      }
    >
      <label className={styles.search}>
        <Search />
        <input
          className={styles.input}
          value={term}
          placeholder={t('chat.dm.search')}
          aria-label={t('chat.dm.search')}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && users[0]) {
              event.preventDefault()
              toggle(users[0])
            }
          }}
        />
      </label>

      {selected.length > 0 && (
        <ul className={styles.chips} aria-label={t('chat.dm.selected')}>
          {selected.map((user) => (
            <li key={user.username}>
              <button type="button" className={styles.chip} title={t('chat.dm.remove', { username: user.username })} onClick={() => toggle(user)}>
                <Avatar template={user.avatar_template} username={user.username} size={18} />
                <span>{user.username}</span>
                <X strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.results}>
        {results.isFetching && users.length === 0 && (
          <div className={styles.status}>
            <Spinner size={22} />
          </div>
        )}
        {results.isError && <p className={styles.status}>{errorMessage(results.error)}</p>}
        {results.isSuccess && !results.isFetching && users.length === 0 && <p className={styles.status}>{t('chat.dm.noResults')}</p>}
        {users.map((user) => {
          const checked = selected.some((other) => other.username === user.username)
          return (
            <button
              key={user.username}
              type="button"
              role="checkbox"
              aria-checked={checked}
              className={cx(styles.result, checked && styles.resultSelected)}
              onClick={() => toggle(user)}
            >
              <Avatar template={user.avatar_template} username={user.username} size={28} />
              <span className={styles.names}>
                <span className={styles.username}>{user.username}</span>
                {user.name && <span className={styles.fullName}>{user.name}</span>}
              </span>
              {checked && <Check strokeWidth={2.5} className={styles.check} />}
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
