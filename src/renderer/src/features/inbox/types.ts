/** `GET /notifications.json` item. `data` varies by notification type. */
export interface NotificationItem {
  id: number
  notification_type: number
  read: boolean
  high_priority?: boolean
  created_at: string
  post_number: number | null
  topic_id: number | null
  slug: string | null
  fancy_title?: string | null
  acting_user_avatar_template?: string | null
  acting_user_name?: string | null
  data: {
    topic_title?: string
    display_username?: string
    display_name?: string
    username?: string
    original_username?: string
    badge_id?: number
    badge_name?: string
    badge_slug?: string
    group_name?: string
    inbox_count?: number
    message?: string
    count?: number
    chat_channel_id?: number
    chat_message_id?: number
    chat_channel_title?: string
    amount?: number
    points?: number
    note?: string
    lottery_title?: string
    level_name?: string
    translated_title?: string
    boost_raw?: string
    reaction_icon?: string
  }
}

export interface NotificationsResponse {
  notifications: NotificationItem[]
  total_rows_notifications?: number
  seen_notification_id?: number
  load_more_notifications?: string | null
}
