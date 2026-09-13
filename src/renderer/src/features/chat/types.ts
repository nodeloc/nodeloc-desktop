/**
 * Discourse chat plugin shapes (`plugins/chat` serializers). Only fields the
 * app reads are listed; most are optional because serializers drop them for
 * DMs, threads or older plugin versions.
 */

export interface ChatUser {
  id: number
  username: string
  name?: string | null
  avatar_template: string
}

export interface ChatMembership {
  following?: boolean
  muted?: boolean
  starred?: boolean
  last_read_message_id?: number | null
  notification_level?: string | number
}

export interface ChatLastMessage {
  id: number
  message?: string
  excerpt?: string
  created_at: string
  user?: ChatUser
}

export interface ChatChannelTracking {
  unread_count: number
  mention_count: number
  watched_threads_unread_count?: number
}

export interface ChatChannel {
  id: number
  title: string
  slug?: string
  description?: string | null
  chatable_type: 'Category' | 'DirectMessage' | string
  chatable?: {
    id?: number
    name?: string | null
    color?: string | null
    group?: boolean
    users?: ChatUser[]
  }
  last_message?: ChatLastMessage | null
  current_user_membership?: ChatMembership | null
  meta?: {
    message_bus_last_ids?: {
      channel_message_bus_last_id?: number
      new_messages?: number
      new_mentions?: number
      kick?: number
    }
    can_join_chat_channel?: boolean
  }
  threading_enabled?: boolean
  memberships_count?: number
  icon_upload_url?: string | null
  emoji?: string | null
  status?: string
  /** Merged in from the response's `tracking.channel_tracking`. */
  tracking: ChatChannelTracking
}

export type RawChatChannel = Omit<ChatChannel, 'tracking'>

export interface ChatThreadTracking {
  channel_id?: number
  unread_count: number
  mention_count: number
  watched_threads_unread_count?: number
}

/** `GET /chat/api/me/channels`. */
export interface MyChannelsResponse {
  public_channels?: RawChatChannel[]
  direct_message_channels?: RawChatChannel[]
  tracking?: {
    channel_tracking?: Record<string, ChatChannelTracking>
    thread_tracking?: Record<string, ChatThreadTracking>
  }
  meta?: {
    message_bus_last_ids?: {
      channel_metadata?: number
      channel_edits?: number
      channel_status?: number
      new_channel?: number
      user_tracking_state?: number
    }
  }
}

/** What the channels query holds: tracking merged into each channel. */
export interface ChatChannelsData {
  publicChannels: ChatChannel[]
  directChannels: ChatChannel[]
  busIds: {
    newChannel: number
    userTrackingState: number
  }
}

export interface ChatUpload {
  id: number
  url: string
  original_filename?: string
  width?: number | null
  height?: number | null
  thumbnail?: { url: string; width?: number; height?: number } | null
  extension?: string
  filesize?: number
  human_filesize?: string
  short_url?: string
}

export interface ChatReaction {
  emoji: string
  count: number
  reacted: boolean
  users?: Array<{ id?: number; username: string }>
}

export interface ChatThreadPreview {
  last_reply_created_at?: string | null
  last_reply_excerpt?: string | null
  last_reply_id?: number | null
  reply_count: number
  participant_count?: number
  participant_users?: ChatUser[]
  last_reply_user?: ChatUser | null
}

export interface ChatMessage {
  id: number
  message: string
  cooked: string
  excerpt?: string
  created_at: string
  edited?: boolean
  deleted_at?: string | null
  deleted_by_id?: number | null
  thread_id?: number | null
  in_reply_to?: {
    id: number
    cooked?: string
    excerpt?: string
    user?: ChatUser
  } | null
  user: ChatUser
  uploads?: ChatUpload[]
  reactions?: ChatReaction[]
  mentioned_users?: ChatUser[]
  available_flags?: string[]
  chat_channel_id: number
  thread?: { id: number; preview?: ChatThreadPreview | null } | null
}

/** A message as the timeline holds it: optimistic sends carry their staged id until confirmed. */
export interface TimelineMessage extends ChatMessage {
  staged_id?: string
  send_state?: 'sending' | 'failed'
}

export interface MessagesResponse {
  messages: ChatMessage[]
  meta?: {
    target_message_id?: number | null
    can_load_more_past?: boolean
    can_load_more_future?: boolean
  }
}

export interface ChatThread {
  id: number
  title?: string | null
  channel_id?: number
  original_message?: ChatMessage | null
  original_message_user?: ChatUser | null
  preview?: ChatThreadPreview | null
  reply_count?: number
  last_message_id?: number
}

export interface ThreadsResponse {
  threads: ChatThread[]
  meta?: { load_more_url?: string | null }
}

export interface SendMessageResponse {
  success?: string
  message_id?: number
}

/**
 * Payloads on `/chat/{channelId}` and `/chat/{channelId}/thread/{threadId}`.
 * Unknown `type`s are treated as a signal to refetch.
 */
export interface ChatRealtimeEvent {
  type: string
  chat_message?: Partial<ChatMessage> & { id: number }
  staged_id?: string | null
  deleted_id?: number
  deleted_ids?: number[]
  deleted_at?: string
  action?: 'add' | 'remove'
  user?: { id: number; username: string }
  emoji?: string
  chat_message_id?: number
  thread_id?: number
  original_message_id?: number
  preview?: ChatThreadPreview
}

/** `/chat/{channelId}/new-messages`. */
export interface NewMessagePayload {
  channel_id?: number
  message_id: number
  user_id?: number
  username?: string
  thread_id?: number | null
}

/** `/chat/user-tracking-state/{userId}`. */
export interface UserTrackingPayload {
  channel_id: number
  unread_count?: number
  mention_count?: number
  watched_threads_unread_count?: number
  last_read_message_id?: number
  thread_id?: number | null
}

export interface UserSearchResult {
  id?: number
  username: string
  name?: string | null
  avatar_template: string
}
