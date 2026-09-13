import type { NotificationCounts } from '@shared/bridge'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { apiRequest } from '../../api/client'
import type { TopicListResponse } from '../../api/types'
import { useIsSignedIn } from '../account/use-session'
import type { NotificationItem, NotificationsResponse } from './types'

const PAGE_SIZE = 60
export const NOTIFICATIONS_KEY = ['notifications'] as const
export const COUNTS_KEY = ['notification-counts'] as const
export const MESSAGES_KEY = ['private-messages'] as const

export type NotificationFilter = 'all' | 'unread'

export function useNotifications(filter: NotificationFilter) {
  const signedIn = useIsSignedIn()
  const query = useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_KEY, filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<NotificationsResponse>({
        path: '/notifications.json',
        query: { offset: pageParam, limit: PAGE_SIZE, filter: filter === 'unread' ? 'unread' : undefined },
        priority: 'user'
      }),
    getNextPageParam: (lastPage, pages) =>
      lastPage.load_more_notifications && lastPage.notifications.length > 0
        ? pages.reduce((sum, page) => sum + page.notifications.length, 0)
        : undefined,
    enabled: signedIn
  })

  const items = useMemo(() => {
    const seen = new Set<number>()
    const result: NotificationItem[] = []
    for (const page of query.data?.pages ?? []) {
      for (const item of page.notifications) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        result.push(item)
      }
    }
    return result
  }, [query.data])

  return { ...query, items }
}

/**
 * Live unread counts pushed by the main process (MessageBus
 * `/notification/{userId}`). New counts also refresh the notification list,
 * so an open inbox shows new items without polling.
 */
export function useNotificationCounts(): NotificationCounts | null {
  const signedIn = useIsSignedIn()
  const queryClient = useQueryClient()
  const counts = useQuery({
    queryKey: COUNTS_KEY,
    queryFn: () => window.nodeloc.notifications.getCounts(),
    enabled: signedIn,
    staleTime: Infinity
  })

  useEffect(
    () =>
      window.nodeloc.events.onNotificationCounts((next) => {
        const previous = queryClient.getQueryData(COUNTS_KEY)
        queryClient.setQueryData(COUNTS_KEY, next)
        if (JSON.stringify(previous) !== JSON.stringify(next)) {
          void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })
          void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY })
        }
      }),
    [queryClient]
  )

  return signedIn ? (counts.data ?? null) : null
}

/** `topics/private-messages/{username}` or a group inbox, as a topic list. */
export function usePrivateMessages(username: string | undefined, group?: string) {
  return useInfiniteQuery({
    queryKey: [...MESSAGES_KEY, username, group ?? 'personal'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<TopicListResponse>({
        path: group
          ? `/topics/private-messages-group/${encodeURIComponent(username ?? '')}/${encodeURIComponent(group)}.json`
          : `/topics/private-messages/${encodeURIComponent(username ?? '')}.json`,
        query: { page: pageParam > 0 ? pageParam : undefined },
        priority: 'user'
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.topic_list.more_topics_url && lastPage.topic_list.topics.length > 0 ? lastPageParam + 1 : undefined,
    enabled: Boolean(username)
  })
}
