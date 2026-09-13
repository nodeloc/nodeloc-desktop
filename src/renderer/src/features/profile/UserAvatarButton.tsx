import { useState } from 'react'
import type { BasicUser } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { cx } from '../../lib/cx'
import type { FlagTarget } from '../interactions/FlagDialog'
import { UserCardDialog } from './UserCardDialog'
import styles from './UserAvatarButton.module.css'

interface UserAvatarButtonProps {
  user: Pick<BasicUser, 'username' | 'avatar_template'>
  size?: number
  className?: string
  avatarClassName?: string
  tabIndex?: number
  reportTarget?: FlagTarget
}

/** An avatar that opens the user's compact profile card instead of navigating. */
export function UserAvatarButton({
  user,
  size = 32,
  className,
  avatarClassName,
  tabIndex,
  reportTarget
}: UserAvatarButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)

  return (
    <>
      <button
        type="button"
        className={cx(styles.trigger, className)}
        style={{ width: size, height: size }}
        aria-label={`@${user.username}`}
        aria-haspopup="dialog"
        data-user-avatar={user.username}
        tabIndex={tabIndex}
        onClick={(event) => {
          event.stopPropagation()
          setAnchor(event.currentTarget)
          setOpen(true)
        }}
      >
        <Avatar template={user.avatar_template} username={user.username} size={size} className={avatarClassName} />
      </button>
      {open && (
        <UserCardDialog
          username={user.username}
          anchor={anchor}
          reportTarget={reportTarget}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
