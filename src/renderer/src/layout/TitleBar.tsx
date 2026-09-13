import { Bell, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import appIcon from '../assets/app-icon.png'
import { IconButton } from '../components/Button'
import { useIsSignedIn } from '../features/account/use-session'
import { useNotificationCounts } from '../features/inbox/use-notifications'
import { cx } from '../lib/cx'
import { paths } from '../lib/routes'
import styles from './TitleBar.module.css'

/**
 * Draggable custom title bar; Windows draws the caption buttons on the right.
 * `compact` (pop-out windows) drops the brand column that lines up with the rail and sidebar.
 */
export function TitleBar({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const signedIn = useIsSignedIn()
  const counts = useNotificationCounts()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // Keep the box in step with the search page's query.
  useEffect(() => {
    if (location.pathname === '/search') setQuery(new URLSearchParams(location.search).get('q') ?? '')
  }, [location.pathname, location.search])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) navigate(paths.search(trimmed))
  }

  const unread = counts?.allUnread ?? 0

  return (
    <header className={cx(styles.titleBar, compact && styles.compact)}>
      <div className={styles.brand}>
        <img className={styles.mark} src={appIcon} alt="" width={20} height={20} draggable={false} />
        <span className={styles.name}>NodeLoc</span>
      </div>
      <div className={styles.navigation}>
        <IconButton label={t('nav.back')} size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft />
        </IconButton>
        <IconButton label={t('nav.forward')} size="sm" onClick={() => navigate(1)}>
          <ChevronRight />
        </IconButton>
      </div>
      <form className={styles.search} role="search" onSubmit={submit}>
        <Search className={styles.searchIcon} />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('nav.searchPlaceholder')}
          aria-label={t('nav.search')}
          spellCheck={false}
        />
      </form>
      {signedIn && (
        <div className={styles.tools}>
          <IconButton label={t('nav.inbox')} size="sm" className={styles.inbox} onClick={() => navigate('/inbox')}>
            <Bell fill={unread > 0 ? 'currentColor' : 'none'} />
            {unread > 0 && <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span>}
          </IconButton>
        </div>
      )}
    </header>
  )
}
