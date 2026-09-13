import type { FormField, QueryValue } from '@shared/api'
import { apiRequest, isApiErrorKind } from '../../api/client'
import type {
  ChatChannel,
  ChatChannelsData,
  ChatThread,
  MessagesResponse,
  MyChannelsResponse,
  RawChatChannel,
  SendMessageResponse,
  ThreadsResponse,
  UserSearchResult
} from './types'

export const CHANNELS_KEY = ['chat', 'channels'] as const

/** The server silently caps larger pages. */
export const PAGE_SIZE = 50
/** Thread lists are capped at 10 per request. */
export const THREADS_PAGE_SIZE = 10

const NO_TRACKING = { unread_count: 0, mention_count: 0 }

function withTracking(channels: RawChatChannel[] | undefined, response: MyChannelsResponse): ChatChannel[] {
  const tracking = response.tracking?.channel_tracking ?? {}
  return (channels ?? []).map((channel) => ({ ...channel, tracking: { ...NO_TRACKING, ...tracking[String(channel.id)] } }))
}

/** Followed channels and DMs with their unread counts. Falls back to the public list on older servers. */
export async function fetchChannels(): Promise<ChatChannelsData> {
  let response: MyChannelsResponse
  try {
    response = await apiRequest<MyChannelsResponse>({ path: '/chat/api/me/channels', priority: 'foreground' })
  } catch (error) {
    if (!isApiErrorKind(error, 'notFound')) throw error
    const fallback = await apiRequest<{ channels?: RawChatChannel[] } | RawChatChannel[]>({
      path: '/chat/api/channels',
      priority: 'foreground'
    })
    const channels = Array.isArray(fallback) ? fallback : (fallback.channels ?? [])
    response = {
      public_channels: channels.filter((channel) => channel.chatable_type !== 'DirectMessage'),
      direct_message_channels: channels.filter((channel) => channel.chatable_type === 'DirectMessage')
    }
  }
  const busIds = response.meta?.message_bus_last_ids
  return {
    publicChannels: withTracking(response.public_channels, response),
    directChannels: withTracking(response.direct_message_channels, response),
    busIds: { newChannel: busIds?.new_channel ?? -1, userTrackingState: busIds?.user_tracking_state ?? -1 }
  }
}

/** One channel, for links to channels the user doesn't follow. */
export async function fetchChannel(channelId: number): Promise<ChatChannel> {
  const response = await apiRequest<{ channel: RawChatChannel }>({ path: `/chat/api/channels/${channelId}`, priority: 'user' })
  return { ...response.channel, tracking: { ...NO_TRACKING } }
}

export interface MessagesQuery {
  direction?: 'past' | 'future'
  targetMessageId?: number
}

export function fetchMessages(channelId: number, threadId: number | undefined, query: MessagesQuery = {}): Promise<MessagesResponse> {
  const params: Record<string, QueryValue> = {
    page_size: PAGE_SIZE,
    direction: query.direction,
    target_message_id: query.targetMessageId
  }
  // Without a target, a thread opens at its latest messages, like a channel.
  if (threadId !== undefined && query.targetMessageId === undefined) params.fetch_from_last_message = true
  return apiRequest<MessagesResponse>({
    path: threadId === undefined
      ? `/chat/api/channels/${channelId}/messages`
      : `/chat/api/channels/${channelId}/threads/${threadId}/messages`,
    query: params,
    priority: 'user'
  })
}

export interface SendInput {
  message: string
  uploadIds: number[]
  inReplyToId?: number
  threadId?: number
  stagedId: string
}

/** `POST /chat/{channelId}` — the only send endpoint. */
export function sendMessage(channelId: number, input: SendInput): Promise<SendMessageResponse> {
  const form: FormField[] = [
    ['message', input.message],
    ['staged_id', input.stagedId]
  ]
  if (input.inReplyToId !== undefined) form.push(['in_reply_to_id', input.inReplyToId])
  if (input.threadId !== undefined) form.push(['thread_id', input.threadId])
  for (const id of input.uploadIds) form.push(['upload_ids[]', id])
  return apiRequest<SendMessageResponse>({ method: 'POST', path: `/chat/${channelId}`, form, priority: 'user' })
}

export function editMessage(channelId: number, messageId: number, message: string, uploadIds: number[]): Promise<unknown> {
  const form: FormField[] = [['message', message]]
  for (const id of uploadIds) form.push(['upload_ids[]', id])
  return apiRequest({ method: 'PUT', path: `/chat/api/channels/${channelId}/messages/${messageId}`, form, priority: 'user' })
}

export function deleteMessage(channelId: number, messageId: number): Promise<unknown> {
  return apiRequest({ method: 'DELETE', path: `/chat/api/channels/${channelId}/messages/${messageId}`, priority: 'user' })
}

export function restoreMessage(channelId: number, messageId: number): Promise<unknown> {
  return apiRequest({ method: 'PUT', path: `/chat/api/channels/${channelId}/messages/${messageId}/restore`, priority: 'user' })
}

export function reactToMessage(channelId: number, messageId: number, emoji: string, add: boolean): Promise<unknown> {
  return apiRequest({
    method: 'PUT',
    path: `/chat/${channelId}/react/${messageId}`,
    form: [
      ['emoji', emoji],
      ['react_action', add ? 'add' : 'remove']
    ],
    priority: 'user'
  })
}

export function markChannelRead(channelId: number, messageId: number): Promise<unknown> {
  return apiRequest({
    method: 'PUT',
    path: `/chat/api/channels/${channelId}/read`,
    query: { message_id: messageId },
    priority: 'background'
  })
}

export function markThreadRead(channelId: number, threadId: number): Promise<unknown> {
  return apiRequest({ method: 'PUT', path: `/chat/api/channels/${channelId}/threads/${threadId}/read`, priority: 'background' })
}

export function fetchThreads(channelId: number, offset: number): Promise<ThreadsResponse> {
  return apiRequest<ThreadsResponse>({
    path: `/chat/api/channels/${channelId}/threads`,
    query: { limit: THREADS_PAGE_SIZE, offset },
    priority: 'foreground'
  })
}

export async function fetchThread(channelId: number, threadId: number): Promise<ChatThread> {
  return (await apiRequest<{ thread: ChatThread }>({ path: `/chat/api/channels/${channelId}/threads/${threadId}`, priority: 'user' }))
    .thread
}

export async function createDirectMessage(usernames: string[]): Promise<RawChatChannel> {
  const form: FormField[] = usernames.map((username) => ['target_usernames[]', username] as const)
  form.push(['upsert', true])
  return (await apiRequest<{ channel: RawChatChannel }>({ method: 'POST', path: '/chat/api/direct-message-channels', form, priority: 'user' }))
    .channel
}

export async function searchUsers(term: string): Promise<UserSearchResult[]> {
  return (await apiRequest<{ users?: UserSearchResult[] }>({ path: '/u/search/users.json', query: { term, limit: 10 }, priority: 'user' }))
    .users ?? []
}
