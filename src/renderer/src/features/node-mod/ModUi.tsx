import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiRequest } from '../../api/client'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { cx } from '../../lib/cx'
import { paths } from '../../lib/routes'
import { useCurrentUser } from '../account/use-session'
import { ChipInput } from '../composer/ChipInput'
import type { UserSearchResponse } from '../composer/types'
import { useDebouncedValue } from '../composer/use-debounced-value'
import styles from './ModUi.module.css'

/** Shared building blocks for mod tools sections. */

export { styles as modStyles }

/** A section's lede line under the page toolbar, with optional actions on the right. */
export function ModIntro({ children, actions }: { children: ReactNode; actions?: ReactNode }): React.JSX.Element {
  return (
    <div className={styles.intro}>
      <p className={styles.lede}>{children}</p>
      {actions && <div className={styles.introActions}>{actions}</div>}
    </div>
  )
}

export function ModPanel({
  title,
  count,
  action,
  children,
  className
}: {
  title?: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cx(styles.panel, className)}>
      {(title || action) && (
        <header className={styles.panelHeader}>
          {title && (
            <h2 className={styles.panelTitle}>
              {title}
              {count !== undefined && <span className={styles.count}>{count}</span>}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** A person in a list: avatar, name linking to the profile, meta line, trailing actions. */
export function ModUserRow({
  user,
  badge,
  meta,
  actions
}: {
  user: { username: string; avatar_template?: string | null; name?: string | null }
  badge?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}): React.JSX.Element {
  return (
    <li className={styles.row}>
      <Avatar template={user.avatar_template} username={user.username} size={32} />
      <div className={styles.rowBody}>
        <div className={styles.rowTitleLine}>
          <Link className={styles.rowTitle} to={paths.user(user.username)}>
            {user.username}
          </Link>
          {badge && <span className={styles.badge}>{badge}</span>}
        </div>
        {meta && <div className={styles.rowMeta}>{meta}</div>}
      </div>
      {actions && <div className={styles.rowActions}>{actions}</div>}
    </li>
  )
}

export function ModEmpty({ icon, children }: { icon?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className={styles.empty}>
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <span>{children}</span>
    </div>
  )
}

/** A confirmation before a destructive action. Stays open (busy) until `onConfirm` settles. */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose
}: {
  open: boolean
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  /** Resolve to close the dialog; errors are the caller's to report. */
  onConfirm: () => Promise<unknown>
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  // Dialog re-runs its focus handling when `onClose` changes; keep it stable across parent renders.
  const latest = useRef({ onClose, busy })
  latest.current = { onClose, busy }
  const close = useCallback(() => {
    if (!latest.current.busy) latest.current.onClose()
  }, [])

  const confirm = async (): Promise<void> => {
    setBusy(true)
    latest.current.busy = true
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      latest.current.busy = false
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('nodeMod.confirmTitle')}
      width={400}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" className={cx(danger && styles.dangerButton)} onClick={() => void confirm()} disabled={busy}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className={styles.dialogText}>{message}</p>
    </Dialog>
  )
}

const SEARCH_LIMIT = 8

/** Usernames from `/u/search/users.json`, as chips. The signed-in user is left out, as on the web. */
export function UserPicker({
  value,
  onChange,
  max,
  placeholder,
  disabled
}: {
  value: string[]
  onChange: (usernames: string[]) => void
  max?: number
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const me = useCurrentUser()
  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim().replace(/^@/, ''), 250)

  const search = useQuery({
    queryKey: ['node-mod', 'user-search', term],
    queryFn: () =>
      apiRequest<UserSearchResponse>({ path: '/u/search/users.json', query: { term, limit: SEARCH_LIMIT }, priority: 'user' }),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const options = term
    ? (search.data?.users ?? [])
        .filter((user) => user.username !== me?.username)
        .map((user) => ({
          key: user.username,
          value: user.username,
          label: user.username,
          detail: user.name ?? undefined,
          icon: <Avatar template={user.avatar_template} username={user.username} size={20} />
        }))
    : []

  return (
    <div className={cx(styles.picker, disabled && styles.disabled)}>
      <ChipInput
        values={value}
        onChange={onChange}
        query={query}
        onQueryChange={setQuery}
        options={options}
        loading={search.isFetching}
        placeholder={placeholder ?? t('nodeMod.userPicker.placeholder')}
        max={max}
        removeLabel={(name) => t('nodeMod.userPicker.remove', { name })}
      />
    </div>
  )
}
