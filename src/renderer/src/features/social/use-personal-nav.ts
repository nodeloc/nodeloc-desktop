import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiRequest } from '../../api/client'
import type { NodeListResponse } from '../../api/types'
import { useIsSignedIn } from '../account/use-session'
import type { CustomFeedsResponse } from './types'

export const RECENT_NODES_KEY = ['nodes', 'recently-visited'] as const
export const CUSTOM_FEEDS_KEY = ['custom-feeds'] as const

/** Signed in only: guests get 403. */
export function useRecentlyVisitedNodes() {
  const signedIn = useIsSignedIn()
  return useQuery({
    queryKey: RECENT_NODES_KEY,
    queryFn: () => apiRequest<NodeListResponse>({ path: '/node/recently-visited.json' }),
    enabled: signedIn,
    staleTime: 5 * 60_000
  })
}

/**
 * Opening a node changes the recently-visited list. Marks it stale without
 * refetching, so the home sidebar reloads it only when it's shown again.
 */
export function useMarkNodeVisited(categoryId: number | undefined): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (categoryId === undefined) return
    void queryClient.invalidateQueries({ queryKey: RECENT_NODES_KEY, refetchType: 'none' })
  }, [categoryId, queryClient])
}

export function useCustomFeeds() {
  const signedIn = useIsSignedIn()
  return useQuery({
    queryKey: CUSTOM_FEEDS_KEY,
    queryFn: () => apiRequest<CustomFeedsResponse>({ path: '/custom-feeds.json' }),
    enabled: signedIn,
    staleTime: 5 * 60_000
  })
}
