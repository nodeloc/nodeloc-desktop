import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { CHANNELS_KEY, fetchChannel, fetchChannels } from './chat-api'
import { useChatStore } from './chat-store'
import type { ChatChannel, ChatChannelsData, NewMessagePayload, UserTrackingPayload } from './types'

export function useChatChannels() {
  const signedIn = useIsSignedIn()
  return useQuery({ queryKey: CHANNELS_KEY, queryFn: fetchChannels, enabled: signedIn, staleTime: 30_000 })
}

/** Sort key: when the channel last had a message. */
export function lastActivity(channel: ChatChannel): number {
  const time = channel.last_message?.created_at ? Date.parse(channel.last_message.created_at) : NaN
  return Number.isNaN(time) ? (channel.last_message?.id ?? 0) : time
}

/** Followed public channels in server order, and DMs with the most recent first. */
export function useSortedChannels(): { publicChannels: ChatChannel[]; directChannels: ChatChannel[] } {
  const { data } = useChatChannels()
  return useMemo(
    () => ({
      publicChannels: (data?.publicChannels ?? []).filter((channel) => channel.current_user_membership?.following !== false),
      directChannels: [...(data?.directChannels ?? [])].sort((a, b) => lastActivity(b) - lastActivity(a))
    }),
    [data]
  )
}

/** A channel by id: from the followed list, or fetched on its own (links to channels you don't follow). */
export function useChatChannel(channelId: number) {
  const channels = useChatChannels()
  const listed = useMemo(
    () => [...(channels.data?.publicChannels ?? []), ...(channels.data?.directChannels ?? [])].find((channel) => channel.id === channelId),
    [channels.data, channelId]
  )
  const single = useQuery({
    queryKey: ['chat', 'channel', channelId],
    queryFn: () => fetchChannel(channelId),
    enabled: channels.isSuccess && !listed
  })
  return {
    channel: listed ?? single.data,
    // A disabled query also reports pending, so only count the fallback once it can run.
    isPending: channels.isPending || (channels.isSuccess && !listed && single.isPending),
    error: channels.error ?? (listed ? null : single.error),
    refetch: () => void (channels.isError ? channels.refetch() : single.refetch())
  }
}

/** Patches one channel in the cached list. */
export function updateCachedChannel(
  queryClient: QueryClient,
  channelId: number,
  update: (channel: ChatChannel) => ChatChannel
): void {
  queryClient.setQueryData<ChatChannelsData>(CHANNELS_KEY, (data) => {
    if (!data) return data
    const apply = (list: ChatChannel[]): ChatChannel[] =>
      list.some((channel) => channel.id === channelId) ? list.map((channel) => (channel.id === channelId ? update(channel) : channel)) : list
    return { ...data, publicChannels: apply(data.publicChannels), directChannels: apply(data.directChannels) }
  })
}

type Subscription = readonly [channel: string, lastId: number]

/**
 * Subscribes a changing set of MessageBus channels with one listener.
 * Mount once per set: every mounted listener receives each message.
 */
function useRealtimeSet(subscriptions: Subscription[], onMessage: (channel: string, data: unknown) => void): void {
  const handler = useRef(onMessage)
  handler.current = onMessage
  const latest = useRef(subscriptions)
  latest.current = subscriptions
  const active = useRef(new Set<string>())
  const key = subscriptions.map(([channel]) => channel).join('|')

  useEffect(() => {
    const wanted = new Map(latest.current)
    for (const channel of active.current) {
      if (wanted.has(channel)) continue
      active.current.delete(channel)
      void window.nodeloc.realtime.unsubscribe(channel)
    }
    for (const [channel, lastId] of wanted) {
      if (active.current.has(channel)) continue
      active.current.add(channel)
      void window.nodeloc.realtime.subscribe(channel, lastId)
    }
  }, [key])

  useEffect(() => {
    const subscribed = active.current
    const off = window.nodeloc.events.onRealtime((message) => {
      if (subscribed.has(message.channel)) handler.current(message.channel, message.data)
    })
    return () => {
      off()
      for (const channel of subscribed) void window.nodeloc.realtime.unsubscribe(channel)
      subscribed.clear()
    }
  }, [])
}

const NEW_MESSAGES = /^\/chat\/(\d+)\/new-messages$/
const NEW_MENTIONS = /^\/chat\/(\d+)\/new-mentions$/

/** Totals for the rail badge: mentions everywhere, unread messages in channels that aren't muted. */
export function useChatUnreadTotals(): { unread: number; mentions: number } {
  const { data } = useChatChannels()
  return useMemo(() => {
    let unread = 0
    let mentions = 0
    for (const channel of [...(data?.publicChannels ?? []), ...(data?.directChannels ?? [])]) {
      mentions += channel.tracking.mention_count
      if (!channel.current_user_membership?.muted) unread += channel.tracking.unread_count
    }
    return { unread, mentions }
  }, [data])
}

/** Mounts {@link useChatUnreadSync}; rendered once by the main window's shell. */
export function ChatUnreadSync(): null {
  useChatUnreadSync()
  return null
}

/**
 * Live unread and mention counts for every followed channel. Mounted once,
 * by the app shell, so each event is counted once.
 */
export function useChatUnreadSync(): void {
  const queryClient = useQueryClient()
  const { data } = useChatChannels()
  const userId = useCurrentUser()?.id

  const subscriptions = useMemo<Subscription[]>(() => {
    if (!data || userId === undefined) return []
    const list: Subscription[] = [
      [`/chat/user-tracking-state/${userId}`, data.busIds.userTrackingState],
      [`/chat/bulk-user-tracking-state/${userId}`, -1],
      ['/chat/new-channel', data.busIds.newChannel]
    ]
    for (const channel of [...data.publicChannels, ...data.directChannels]) {
      const ids = channel.meta?.message_bus_last_ids
      list.push([`/chat/${channel.id}/new-messages`, ids?.new_messages ?? -1])
      list.push([`/chat/${channel.id}/new-mentions`, ids?.new_mentions ?? -1])
    }
    return list
  }, [data, userId])

  useRealtimeSet(subscriptions, (busChannel, payload) => {
    // The open channel, scrolled to its newest message in a focused window, is being read.
    const isBeingRead = (channelId: number): boolean => {
      const viewing = useChatStore.getState().viewing
      return viewing?.channelId === channelId && viewing.atBottom && document.hasFocus()
    }

    if (busChannel === '/chat/new-channel') {
      void queryClient.invalidateQueries({ queryKey: CHANNELS_KEY })
      return
    }

    const newMessage = NEW_MESSAGES.exec(busChannel)
    if (newMessage) {
      const channelId = Number(newMessage[1])
      const event = payload as NewMessagePayload
      updateCachedChannel(queryClient, channelId, (channel) => {
        const counts = !(event.thread_id && channel.threading_enabled) && event.user_id !== userId && !isBeingRead(channelId)
        return {
          ...channel,
          last_message: {
            id: event.message_id,
            created_at: new Date().toISOString(),
            user: event.user_id && event.username ? { id: event.user_id, username: event.username, avatar_template: '' } : undefined
          },
          tracking: counts ? { ...channel.tracking, unread_count: channel.tracking.unread_count + 1 } : channel.tracking
        }
      })
      return
    }

    const newMention = NEW_MENTIONS.exec(busChannel)
    if (newMention) {
      const channelId = Number(newMention[1])
      if (isBeingRead(channelId)) return
      updateCachedChannel(queryClient, channelId, (channel) => ({
        ...channel,
        tracking: { ...channel.tracking, mention_count: channel.tracking.mention_count + 1 }
      }))
      return
    }

    if (busChannel.startsWith('/chat/bulk-user-tracking-state/')) {
      for (const [id, state] of Object.entries((payload ?? {}) as Record<string, Omit<UserTrackingPayload, 'channel_id'>>)) {
        applyTracking(queryClient, { ...state, channel_id: Number(id) })
      }
      return
    }

    if (busChannel.startsWith('/chat/user-tracking-state/')) applyTracking(queryClient, payload as UserTrackingPayload)
  })
}

function applyTracking(queryClient: QueryClient, state: UserTrackingPayload): void {
  if (!state || typeof state.channel_id !== 'number') return
  updateCachedChannel(queryClient, state.channel_id, (channel) => ({
    ...channel,
    tracking: {
      ...channel.tracking,
      unread_count: state.unread_count ?? channel.tracking.unread_count,
      mention_count: state.mention_count ?? channel.tracking.mention_count
    },
    current_user_membership:
      state.last_read_message_id !== undefined && channel.current_user_membership
        ? { ...channel.current_user_membership, last_read_message_id: state.last_read_message_id }
        : channel.current_user_membership
  }))
}
