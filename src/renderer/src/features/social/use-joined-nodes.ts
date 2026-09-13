import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { apiRequest, isApiErrorKind } from '../../api/client'
import type { Category, NodeListResponse, NodeSummary } from '../../api/types'
import { showToast } from '../../components/toast-store'
import { useAuthState, useIsSignedIn } from '../account/use-session'
import { patchNodeEverywhere, restoreSnapshot, snapshotNodeCaches, type CacheSnapshot } from './node-cache'
import type { JoinRequestResponse, MembershipResponse } from './types'
import { useWriteErrorMessage } from './use-write-error'

export const JOINED_NODES_KEY = ['nodes', 'joined'] as const

/** The signed-in user's nodes (`/node/joined.json`). Shared by the node rail and anything else listing them. */
export function useJoinedNodes() {
  const signedIn = useIsSignedIn()
  return useQuery({
    queryKey: JOINED_NODES_KEY,
    queryFn: () => apiRequest<NodeListResponse>({ path: '/node/joined.json' }),
    enabled: signedIn,
    staleTime: 5 * 60_000
  })
}

/** A node page's category in the directory's lighter shape, so either can be joined and listed. */
export function toNodeSummary(node: NodeSummary | Category): NodeSummary {
  if ('url' in node) return node
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    color: node.color,
    description: node.description ?? null,
    url: `/n/${node.slug}`,
    topic_count: node.topic_count,
    post_count: node.post_count,
    member_count: node.member_count ?? 0,
    is_joined: node.is_joined ?? false,
    is_creator: node.is_creator ?? false,
    uploaded_logo: node.uploaded_logo,
    uploaded_logo_dark: node.uploaded_logo_dark,
    user_id: node.user_id,
    parent_category_id: node.parent_category_id ?? 0,
    community_verified: node.community_verified,
    community_official: node.community_official
  }
}

interface JoinVariables {
  node: NodeSummary
  join: boolean
}

function applyMembership(
  queryClient: ReturnType<typeof useQueryClient>,
  node: NodeSummary,
  join: boolean,
  memberCount: (current: number | undefined, wasJoined: boolean | undefined) => number
): void {
  patchNodeEverywhere(queryClient, node.id, (current) => ({
    is_joined: join,
    member_count: Math.max(0, memberCount(current.member_count, current.is_joined))
  }))
  queryClient.setQueryData<NodeListResponse>(JOINED_NODES_KEY, (previous) => {
    if (!previous) return previous
    const listed = previous.communities.some((item) => item.id === node.id)
    if (join) {
      return listed ? previous : { communities: [...previous.communities, { ...node, is_joined: true }] }
    }
    return listed ? { communities: previous.communities.filter((item) => item.id !== node.id) } : previous
  })
}

/**
 * Join or leave a node. Every cached copy (directory cards, node page, rail)
 * flips at once and rolls back if the server refuses.
 */
export function useJoinNode() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()

  return useMutation<MembershipResponse, unknown, JoinVariables, { snapshot: CacheSnapshot }>({
    mutationFn: ({ node, join }) =>
      apiRequest<MembershipResponse>(
        join
          ? { method: 'POST', path: `/node/join/${node.id}`, priority: 'user' }
          : { method: 'DELETE', path: `/node/leave/${node.id}`, priority: 'user' }
      ),
    onMutate: async ({ node, join }) => {
      await queryClient.cancelQueries({ queryKey: JOINED_NODES_KEY })
      const snapshot = snapshotNodeCaches(queryClient)
      applyMembership(queryClient, node, join, (count = 0, wasJoined) =>
        wasJoined === join ? count : count + (join ? 1 : -1)
      )
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      if (context) restoreSnapshot(queryClient, context.snapshot)
      showToast(writeError(error), 'danger')
    },
    onSuccess: (response, { node, join }) => {
      const joined = response.joined ?? join
      const community = response.community?.id === node.id ? response.community : undefined
      // The server's own count replaces the optimistic guess.
      applyMembership(queryClient, community ? { ...node, ...community } : node, joined, (count = 0) =>
        community?.member_count ?? count
      )
      showToast(t(joined ? 'social.membership.joined' : 'social.membership.left', { name: node.name }), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic-list', 'feed', 'joined'] })
    }
  })
}

interface JoinRequestState {
  /** `${username}:${categoryId}` for requests sent this session. */
  requested: Record<string, true>
  mark: (key: string) => void
}

const useJoinRequests = create<JoinRequestState>((set) => ({
  requested: {},
  mark: (key) => set((state) => ({ requested: { ...state.requested, [key]: true } }))
}))

/** The server has no "pending request" field on a node, so requests sent from this app are remembered for the session. */
export function useHasRequestedJoin(categoryId: number): boolean {
  const username = useAuthState().username ?? ''
  return useJoinRequests((state) => state.requested[`${username}:${categoryId}`] === true)
}

interface RequestJoinVariables {
  node: NodeSummary
  reason: string
}

/** Ask to join a private node. 409 means a request is already pending, which counts as sent. */
export function useRequestJoin() {
  const { t } = useTranslation()
  const writeError = useWriteErrorMessage()
  const username = useAuthState().username ?? ''
  const mark = useJoinRequests((state) => state.mark)

  return useMutation<JoinRequestResponse, unknown, RequestJoinVariables>({
    mutationFn: ({ node, reason }) =>
      apiRequest<JoinRequestResponse>({
        method: 'POST',
        path: `/node/${node.id}/request-join`,
        form: [['reason', reason]],
        priority: 'user'
      }),
    onSuccess: (_response, { node }) => {
      mark(`${username}:${node.id}`)
      showToast(t('social.membership.requestSent'), 'success')
    },
    onError: (error, { node }) => {
      if (isApiErrorKind(error, 'conflict')) {
        mark(`${username}:${node.id}`)
        showToast(t('social.membership.alreadyRequested'))
        return
      }
      showToast(writeError(error), 'danger')
    }
  })
}
