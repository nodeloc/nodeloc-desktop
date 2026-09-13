import { CircleAlert, EllipsisVertical, LogIn, LogOut, Settings, User, Zap } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Button, IconButton } from '../components/Button'
import { Dialog } from '../components/Dialog'
import { DropdownMenu } from '../components/DropdownMenu'
import { showToast } from '../components/toast-store'
import { CheckInButton } from '../features/account/CheckInButton'
import { useSignInDialog } from '../features/account/sign-in-store'
import { AUTH_STATE_KEY, useAuthState, useCurrentUser } from '../features/account/use-session'
import { formatCount } from '../lib/format'
import { paths } from '../lib/routes'
import { ThemeMenuButton } from './ThemeSwitcher'
import styles from './UserBar.module.css'

/** Bottom of the sidebar: the account, with check-in, appearance and the account menu beside it. */
export function UserBar(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const auth = useAuthState()
  const user = useCurrentUser()
  const showSignIn = useSignInDialog((state) => state.show)
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async (): Promise<void> => {
    setSigningOut(true)
    const state = await window.nodeloc.auth.signOut()
    queryClient.setQueryData(AUTH_STATE_KEY, state)
    setSigningOut(false)
    setConfirmingSignOut(false)
    showToast(t('account.signedOut'))
  }

  let account: React.JSX.Element
  if (auth.status === 'signedIn') {
    const username = user?.username ?? auth.username ?? ''
    account = (
      <div className={styles.userBar}>
        <button type="button" className={styles.identity} onClick={() => navigate(paths.user(username))}>
          <Avatar template={user?.avatar_template} username={username} size={32} />
          <span className={styles.userText}>
            <span className={styles.userName}>{user?.name || username}</span>
            <span className={styles.userHint}>
              <Zap fill="currentColor" className={styles.energyIcon} />
              {t('account.energy', { value: formatCount(user?.gamification_score ?? 0, i18n.language) })}
            </span>
          </span>
        </button>
        <div className={styles.tools}>
          {user && <CheckInButton key={user.id} userId={user.id} />}
          <ThemeMenuButton />
          <DropdownMenu
            placement="top"
            trigger={({ toggle }) => (
              <IconButton label={t('account.menu')} size="sm" onClick={toggle}>
                <EllipsisVertical strokeWidth={2.5} />
              </IconButton>
            )}
            items={[
              { key: 'profile', label: t('account.myProfile'), icon: <User />, onSelect: () => navigate(paths.user(username)) },
              { key: 'settings', label: t('settings.title'), icon: <Settings />, onSelect: () => navigate(paths.settings()) },
              'separator',
              { key: 'sign-out', label: t('account.signOut'), icon: <LogOut />, danger: true, onSelect: () => setConfirmingSignOut(true) }
            ]}
          />
        </div>
      </div>
    )
  } else if (auth.status === 'expired') {
    account = (
      <div className={styles.userBar}>
        <CircleAlert className={styles.warning} />
        <span className={styles.userText}>
          <span className={styles.userName}>{t('account.expiredTitle')}</span>
          <span className={styles.userHint}>{auth.username}</span>
        </span>
        <div className={styles.tools}>
          <Button size="sm" variant="primary" onClick={showSignIn}>
            {t('account.signInAgain')}
          </Button>
          <ThemeMenuButton />
        </div>
      </div>
    )
  } else {
    account = (
      <div className={styles.userBar}>
        <Avatar username={t('sidebar.guest')} size={32} />
        <span className={styles.userText}>
          <span className={styles.userName}>{t('sidebar.guest')}</span>
          <span className={styles.userHint}>{auth.status === 'pending' ? t('account.waiting') : t('sidebar.guestHint')}</span>
        </span>
        <div className={styles.tools}>
          <Button size="sm" variant="primary" icon={<LogIn strokeWidth={2.5} />} onClick={showSignIn}>
            {t('account.signIn')}
          </Button>
          <ThemeMenuButton />
          <IconButton label={t('settings.title')} size="sm" onClick={() => navigate(paths.settings())}>
            <Settings />
          </IconButton>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.footer}>
      {account}
      <Dialog
        open={confirmingSignOut}
        onClose={() => setConfirmingSignOut(false)}
        title={t('account.signOutConfirmTitle')}
        width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingSignOut(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={signingOut} onClick={() => void signOut()}>
              {t('account.signOut')}
            </Button>
          </>
        }
      >
        <p>{t('account.signOutConfirm')}</p>
      </Dialog>
    </div>
  )
}
