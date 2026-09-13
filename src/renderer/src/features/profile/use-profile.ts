import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { apiRequest } from '../../api/client'
import type { PointsHistoryResponse, UserAction, UserActionsResponse } from '../../api/types'
import type { ProfileTab } from '../../lib/routes'
import type { NodesByUserResponse, ProfileResponse, ProfileSummaryResponse, UserBadgesResponse } from './types'

export type ActivityTab = Extract<ProfileTab, 'activity' | 'topics' | 'replies' | 'likes'>

/** `user_actions.json` filter codes per tab: 1 likes given, 4 topics, 5 replies. */
const ACTIVITY_FILTERS: Record<ActivityTab, string> = {
  activity: '4,5',
  topics: '4',
  replies: '5',
  likes: '1'
}

const ACTIONS_PAGE_SIZE = 30

const userPath = (username: string): string => `/u/${encodeURIComponent(username)}`

export const userCardKey = (username: string) => ['profile', username, 'card'] as const

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => apiRequest<ProfileResponse>({ path: `${userPath(username)}.json` })
  })
}

/** Smaller web user-card payload, including mute/ignore state and permissions. */
export function useUserCard(username: string) {
  return useQuery({
    queryKey: userCardKey(username),
    queryFn: () => apiRequest<ProfileResponse>({ path: `${userPath(username)}/card.json` }),
    staleTime: 5 * 60_000
  })
}

/** Shared by the stats strip and the side cards; one request serves both. */
export function useProfileSummary(username: string) {
  return useQuery({
    queryKey: ['profile', username, 'summary'],
    queryFn: () => apiRequest<ProfileSummaryResponse>({ path: `${userPath(username)}/summary.json` }),
    staleTime: 5 * 60_000
  })
}

/** Nodes the user owns or moderates (discourse-community). */
export function useNodesByUser(username: string) {
  return useQuery({
    queryKey: ['profile', username, 'nodes'],
    queryFn: () =>
      apiRequest<NodesByUserResponse>({
        path: `/node/by-user/${encodeURIComponent(username)}.json`,
        priority: 'background'
      }),
    staleTime: 5 * 60_000
  })
}

export function useUserBadges(username: string) {
  return useQuery({
    queryKey: ['profile', username, 'badges'],
    queryFn: () => apiRequest<UserBadgesResponse>({ path: `/user-badges/${encodeURIComponent(username)}.json` }),
    staleTime: 5 * 60_000
  })
}

/** Stable across pages: a post is one action per type. */
export function actionKey(action: UserAction): string {
  return `${action.action_type}:${action.topic_id}:${action.post_number}`
}

export function useUserActions(username: string, tab: ActivityTab) {
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'actions', tab],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<UserActionsResponse>({
        path: '/user_actions.json',
        query: { username, filter: ACTIVITY_FILTERS[tab], offset: pageParam, limit: ACTIONS_PAGE_SIZE }
      }),
    // Offset paging has no total or cursor: only an empty page means the end.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.user_actions.length > 0 ? lastPageParam + lastPage.user_actions.length : undefined
  })

  const actions = useMemo(() => {
    const merged: UserAction[] = []
    const seen = new Set<string>()
    // New activity shifts offsets while paging; keep the first copy of anything repeated.
    for (const page of query.data?.pages ?? []) {
      for (const action of page.user_actions) {
        const key = actionKey(action)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(action)
      }
    }
    return merged
  }, [query.data])

  return { ...query, actions }
}

/** discourse-points-service: zero-based pages of 20, login required. */
export function usePointsHistory(username: string) {
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'points'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<PointsHistoryResponse>({
        path: `${userPath(username)}/points-history.json`,
        query: { page: pageParam }
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.has_more && lastPage.points_history.length > 0 ? lastPageParam + 1 : undefined
  })

  const entries = useMemo(() => query.data?.pages.flatMap((page) => page.points_history) ?? [], [query.data])

  return { ...query, entries }
}
