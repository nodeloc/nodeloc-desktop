import { Ban, CircleAlert, Ellipsis, Flag, UserPlus, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useErrorMessage } from '../../api/use-error-message'
import { Button, IconButton } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu'
import { EmptyState } from '../../components/EmptyState'
import { paths } from '../../lib/routes'
import { useAuthState, useRequireSignIn } from '../account/use-session'
import { FlagDialog, type FlagTarget } from '../interactions/FlagDialog'
import { InviteToNodeDialog } from './InviteToNodeDialog'
import { ProfileHeader, ProfileHeaderSkeleton } from './ProfileHeader'
import { UserScreenDialog } from './UserScreenDialog'
import { useUserCard } from './use-profile'
import styles from './UserCardDialog.module.css'

interface UserCardDialogProps {
  username: string
  anchor: HTMLElement | null
  onClose: () => void
  reportTarget?: FlagTarget
}

type SecondaryDialog = 'screen' | 'report' | 'invite' | null

/** Discord-style compact profile shown from an avatar click. */
export function UserCardDialog({ username, anchor, onClose, reportTarget }: UserCardDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const me = useAuthState().username
  const requireSignIn = useRequireSignIn()
  const profile = useUserCard(username)
  const [secondary, setSecondary] = useState<SecondaryDialog>(null)

  const openFullProfile = (): void => {
    onClose()
    navigate(paths.user(username))
  }

  const user = profile.data?.user
  const isSelf = Boolean(me && me.toLowerCase() === username.toLowerCase())
  const signedInAction = (dialog: Exclude<SecondaryDialog, null>): (() => void) => () => {
    if (requireSignIn()) setSecondary(dialog)
  }
  const menu: Array<MenuItem | 'separator'> = [
    {
      key: 'screen',
      label: t('profile.screen.action'),
      icon: <Ban />,
      disabled: !user || isSelf,
      onSelect: signedInAction('screen')
    },
    {
      key: 'report',
      label: t('profile.report'),
      icon: <Flag />,
      disabled: !reportTarget || isSelf,
      danger: true,
      onSelect: signedInAction('report')
    },
    'separator',
    { key: 'profile', label: t('profile.viewFullProfile'), icon: <UserRound />, onSelect: openFullProfile },
    {
      key: 'invite',
      label: t('profile.invite.action'),
      icon: <UserPlus />,
      disabled: !user || isSelf,
      onSelect: signedInAction('invite')
    }
  ]

  return (
    <>
      <Dialog open onClose={onClose} title={t('profile.cardTitle', { username })} width={520} anchor={anchor} bare>
        <div className={styles.content} data-user-card={username}>
          <div className={styles.moreMenu}>
            <DropdownMenu
              items={menu}
              trigger={({ open, toggle }) => (
                <IconButton
                  label={t('profile.moreActions')}
                  className={styles.moreButton}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <Ellipsis strokeWidth={2.5} />
                </IconButton>
              )}
            />
          </div>
          {profile.isPending && <ProfileHeaderSkeleton />}
          {profile.isError && (
            <EmptyState
              icon={<CircleAlert />}
              title={errorMessage(profile.error)}
              action={
                <Button variant="primary" onClick={() => void profile.refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          )}
          {user && <ProfileHeader user={user} />}
        </div>
      </Dialog>
      {secondary === 'screen' && user && <UserScreenDialog user={user} onClose={() => setSecondary(null)} />}
      {secondary === 'report' && reportTarget && <FlagDialog target={reportTarget} open onClose={() => setSecondary(null)} />}
      {secondary === 'invite' && <InviteToNodeDialog username={username} onClose={() => setSecondary(null)} />}
    </>
  )
}
