import type { TFunction } from 'i18next'
import { SITE_ORIGIN } from '@shared/site'
import { paths } from '../../lib/routes'
import type { NotificationItem } from './types'

/** Type ids to names, as `site.notification_types` reports them for this site. */
export function notificationTypeNames(types: Record<string, number> | undefined): Map<number, string> {
  return new Map(Object.entries(types ?? {}).map(([name, id]) => [id, name]))
}

const KNOWN_TEXT = new Set([
  'mentioned',
  'replied',
  'quoted',
  'edited',
  'liked',
  'liked_consolidated',
  'reaction',
  'private_message',
  'invited_to_private_message',
  'invitee_accepted',
  'posted',
  'moved_post',
  'linked',
  'granted_badge',
  'invited_to_topic',
  'group_mentioned',
  'group_message_summary',
  'watching_first_post',
  'topic_reminder',
  'bookmark_reminder',
  'watching_category_or_tag',
  'chat_mention',
  'chat_message',
  'chat_invitation',
  'chat_group_mention',
  'chat_quoted',
  'chat_watched_thread',
  'boost',
  'following',
  'following_created_topic',
  'following_replied',
  'reward_received',
  'topic_featured',
  'lottery_result',
  'category_migrated',
  'custom'
])

/** One consistent sentence per notification type (same source as desktop alerts). */
export function notificationText(item: NotificationItem, typeName: string | undefined, t: TFunction): string {
  const data = item.data
  const values = {
    user: data.display_username ?? data.display_name ?? data.username ?? data.original_username ?? item.acting_user_name ?? '',
    title: data.topic_title ?? item.fancy_title ?? '',
    badge: data.badge_name ?? '',
    group: data.group_name ?? '',
    count: data.count ?? data.inbox_count ?? 0,
    amount: data.amount ?? data.points ?? 0,
    message: data.message ?? '',
    lotteryTitle: data.lottery_title ?? data.translated_title ?? ''
  }
  const key = typeName && KNOWN_TEXT.has(typeName) ? typeName : 'fallback'
  return t(`inbox.types.${key}`, values)
}

/** Where a notification leads: an in-app route or a forum URL for the in-app browser. */
export function notificationTarget(item: NotificationItem, typeName: string | undefined): { route?: string; url?: string } {
  const data = item.data
  if (typeName?.startsWith('chat_') && data.chat_channel_id) {
    return { route: `/chat/${data.chat_channel_id}${data.chat_message_id ? `/${data.chat_message_id}` : ''}` }
  }
  if (typeName === 'granted_badge' && data.badge_id) {
    return { url: `${SITE_ORIGIN}/badges/${data.badge_id}/${data.badge_slug ?? ''}` }
  }
  if (typeName === 'group_message_summary' && data.group_name) {
    return { route: `/inbox/messages/group/${encodeURIComponent(data.group_name)}` }
  }
  if (typeName === 'following' && (data.display_username ?? data.username)) {
    return { route: paths.user((data.display_username ?? data.username)!) }
  }
  if (item.topic_id) return { route: paths.topic(item.topic_id, item.post_number ?? undefined) }
  return {}
}
