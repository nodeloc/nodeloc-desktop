import { Hash } from 'lucide-react'
import { Avatar } from '../../components/Avatar'
import { cx } from '../../lib/cx'
import { useCurrentUser } from '../account/use-session'
import styles from './ChannelAvatar.module.css'
import { directMessageUsers, isDirectMessage } from './chat-text'
import type { ChatChannel, ChatChannelTracking } from './types'

/** A DM shows the other person; a channel shows a hash tile in its category colour. */
export function ChannelAvatar({ channel, size }: { channel: ChatChannel; size: number }): React.JSX.Element {
  const userId = useCurrentUser()?.id
  if (isDirectMessage(channel)) {
    const user = directMessageUsers(channel, userId)[0]
    return <Avatar template={user?.avatar_template} username={user?.username ?? channel.title} size={size} />
  }
  const color = channel.chatable?.color
  return (
    <span className={styles.hash} style={{ width: size, height: size, color: color ? `#${color}` : undefined }}>
      <Hash strokeWidth={2.5} />
    </span>
  )
}

export function hasBadge(tracking: ChatChannelTracking, muted?: boolean): boolean {
  return tracking.mention_count > 0 || (!muted && tracking.unread_count > 0)
}

/** Mentions in red; plain unread counts are quiet, and hidden for muted channels. */
export function UnreadBadge({ tracking, muted }: { tracking: ChatChannelTracking; muted?: boolean }): React.JSX.Element | null {
  if (tracking.mention_count > 0) return <span className={cx(styles.badge, styles.mention)}>{cap(tracking.mention_count)}</span>
  if (muted || tracking.unread_count <= 0) return null
  return <span className={cx(styles.badge, styles.unread)}>{cap(tracking.unread_count)}</span>
}

const cap = (count: number): string => (count > 99 ? '99+' : String(count))
