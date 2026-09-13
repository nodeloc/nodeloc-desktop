import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '../account/use-session'
import { CHANNELS_KEY, markChannelRead, markThreadRead } from './chat-api'
import type { ChatChannelsData } from './types'
import { updateCachedChannel } from './use-channels'
import type { Timeline } from './use-timeline'

const THROTTLE_MS = 2000

export function useWindowFocused(): boolean {
  const [focused, setFocused] = useState(() => document.hasFocus())
  useEffect(() => {
    const onFocus = (): void => setFocused(true)
    const onBlur = (): void => setFocused(false)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
  return focused
}

interface MarkReadOptions {
  channelId: number
  threadId?: number
  timeline: Timeline
  atBottom: boolean
}

/**
 * Reports the read position while the newest message is on screen in a
 * focused window, at most every two seconds. Clears the channel's unread
 * badge locally at the same time.
 */
export function useMarkRead({ channelId, threadId, timeline, atBottom }: MarkReadOptions): void {
  const queryClient = useQueryClient()
  const userId = useCurrentUser()?.id
  const focused = useWindowFocused()
  const marked = useRef(0)
  const lastSentAt = useRef(0)
  const newest = timeline.confirmed[timeline.confirmed.length - 1]
  const ready = timeline.status === 'ready' && !timeline.fromSnapshot && !timeline.canLoadFuture

  useEffect(() => {
    if (!ready || !atBottom || !focused || !newest || newest.id <= marked.current) return
    const messageId = newest.id
    const ownMessage = newest.user.id === userId

    const timer = setTimeout(
      () => {
        marked.current = messageId
        if (threadId !== undefined) {
          lastSentAt.current = Date.now()
          void markThreadRead(channelId, threadId).catch(() => undefined)
          return
        }

        const data = queryClient.getQueryData<ChatChannelsData>(CHANNELS_KEY)
        const channel = data && [...data.publicChannels, ...data.directChannels].find((candidate) => candidate.id === channelId)
        const alreadyRead =
          (channel?.current_user_membership?.last_read_message_id ?? 0) >= messageId && !channel?.tracking.unread_count
        // Sending moves the server's read marker by itself.
        if (!alreadyRead && !ownMessage) {
          lastSentAt.current = Date.now()
          void markChannelRead(channelId, messageId).catch(() => undefined)
        }
        updateCachedChannel(queryClient, channelId, (current) => ({
          ...current,
          tracking: { ...current.tracking, unread_count: 0, mention_count: 0 },
          current_user_membership: current.current_user_membership
            ? {
                ...current.current_user_membership,
                last_read_message_id: Math.max(messageId, current.current_user_membership.last_read_message_id ?? 0)
              }
            : current.current_user_membership
        }))
      },
      Math.max(0, lastSentAt.current + THROTTLE_MS - Date.now())
    )
    return () => clearTimeout(timer)
  }, [ready, atBottom, focused, newest, userId, channelId, threadId, queryClient])
}
