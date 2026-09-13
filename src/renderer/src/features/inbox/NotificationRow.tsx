import { AtSign, Bell, Heart, Mail, Medal, MessageCircleMore, Pencil, Quote, Reply, Rocket, Ticket, Trophy, UserPlus, Zap, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import { cx } from '../../lib/cx'
import { formatRelativeTime } from '../../lib/format'
import { notificationText } from './notification-display'
import styles from './NotificationRow.module.css'
import type { NotificationItem } from './types'

const ICONS: Record<string, LucideIcon> = {
  mentioned: AtSign,
  group_mentioned: AtSign,
  replied: Reply,
  posted: Reply,
  following_replied: Reply,
  quoted: Quote,
  edited: Pencil,
  liked: Heart,
  liked_consolidated: Heart,
  reaction: Heart,
  private_message: Mail,
  invited_to_private_message: Mail,
  group_message_summary: Mail,
  granted_badge: Medal,
  chat_mention: MessageCircleMore,
  chat_message: MessageCircleMore,
  chat_invitation: MessageCircleMore,
  chat_group_mention: MessageCircleMore,
  chat_quoted: MessageCircleMore,
  chat_watched_thread: MessageCircleMore,
  boost: Rocket,
  following: UserPlus,
  reward_received: Zap,
  lottery_result: Ticket,
  topic_featured: Trophy
}

interface NotificationRowProps {
  item: NotificationItem
  typeName: string | undefined
  onOpen: (item: NotificationItem) => void
}

export function NotificationRow({ item, typeName, onOpen }: NotificationRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const IconComponent = (typeName && ICONS[typeName]) || Bell
  const username = item.data.display_username ?? item.data.username

  return (
    <button
      type="button"
      className={cx(styles.row, !item.read && styles.unread, item.high_priority && styles.priority)}
      onClick={() => onOpen(item)}
    >
      <span className={styles.visual}>
        {item.acting_user_avatar_template && username ? (
          <Avatar template={item.acting_user_avatar_template} username={username} size={36} />
        ) : (
          <span className={styles.iconCircle}>
            <IconComponent />
          </span>
        )}
        <span className={styles.typeBadge} data-type={typeName}>
          <IconComponent />
        </span>
      </span>
      <span className={styles.text}>
        <span className={styles.sentence}>{notificationText(item, typeName, t)}</span>
        <time className={styles.time} dateTime={item.created_at}>
          {formatRelativeTime(item.created_at, i18n.language)}
        </time>
      </span>
      {!item.read && <span className={styles.dot} aria-hidden="true" />}
    </button>
  )
}
