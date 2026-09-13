import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { TopicView } from '../../api/types'
import { useRealtime } from '../../lib/realtime'
import { useCurrentUser } from '../account/use-session'

/** Several edits and likes often arrive together; refetch once they settle. */
const REFRESH_DELAY_MS = 1500

interface TopicBusPayload {
  type?: string
  user_id?: number
}

/**
 * Live updates for an open topic (MessageBus `/topic/{id}` and its reactions
 * channel). New replies by others are counted for a "new replies" prompt
 * instead of shifting the thread under the reader; edits, likes, deletions
 * and the reader's own replies refresh the loaded pages quietly.
 */
export function useTopicRealtime(topic: TopicView | undefined): { newReplies: number; acknowledge: () => void } {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const [newReplies, setNewReplies] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const topicId = topic?.id

  useEffect(() => {
    setNewReplies(0)
    return () => clearTimeout(timer.current)
  }, [topicId])

  const refreshSoon = (): void => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (topicId !== undefined) void queryClient.invalidateQueries({ queryKey: ['topic', topicId] })
    }, REFRESH_DELAY_MS)
  }

  useRealtime(
    topicId !== undefined ? `/topic/${topicId}` : null,
    (data) => {
      const payload = data as TopicBusPayload
      switch (payload.type) {
        case 'created':
          if (user && payload.user_id === user.id) refreshSoon()
          else setNewReplies((count) => count + 1)
          break
        case 'revised':
        case 'rebaked':
        case 'acted':
        case 'liked':
        case 'deleted':
        case 'recovered':
        case 'destroyed':
        case 'boost_added':
        case 'boost_removed':
          refreshSoon()
          break
        default:
          break
      }
    },
    topic?.message_bus_last_id ?? -1
  )

  useRealtime(topicId !== undefined ? `/topic/${topicId}/reactions` : null, refreshSoon)

  return {
    newReplies,
    acknowledge: () => {
      setNewReplies(0)
      if (topicId !== undefined) void queryClient.invalidateQueries({ queryKey: ['topic', topicId] })
    }
  }
}
