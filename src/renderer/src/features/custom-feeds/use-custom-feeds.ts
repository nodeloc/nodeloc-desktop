import type { FormField } from '@shared/api'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { showToast } from '../../components/toast-store'
import { useIsSignedIn } from '../account/use-session'
import type { CustomFeedsResponse } from '../social/types'
import { CUSTOM_FEEDS_KEY } from '../social/use-personal-nav'
import { useWriteErrorMessage } from '../social/use-write-error'
import type { CustomFeedDetail, CustomFeedInput, CustomFeedResponse, NodeSearchResponse } from './types'

const enc = encodeURIComponent

export const customFeedDetailKey = (username: string, slug: string) =>
  ['custom-feed-detail', username.toLowerCase(), slug] as const

/** One feed with its nodes: `GET /custom-feeds/{username}/{slug}.json`. */
export function useCustomFeedDetail(username: string, slug: string) {
  return useQuery({
    queryKey: customFeedDetailKey(username, slug),
    queryFn: async () =>
      (await apiRequest<CustomFeedResponse>({ path: `/custom-feeds/${enc(username)}/${enc(slug)}.json` })).custom_feed,
    enabled: username.length > 0 && slug.length > 0,
    staleTime: 60_000
  })
}

/** Nodes to add: `GET /custom-feeds/node-search.json?term=`. */
export function useFeedNodeSearch(term: string) {
  const signedIn = useIsSignedIn()
  return useQuery({
    queryKey: ['custom-feeds', 'node-search', term],
    queryFn: async () =>
      (await apiRequest<NodeSearchResponse>({ path: '/custom-feeds/node-search.json', query: { term }, priority: 'user' })).nodes,
    enabled: signedIn && term.length > 0,
    staleTime: 60_000
  })
}

/** Keeps the sidebar list, the detail and the feed's topic list in step with a changed feed. */
function applyFeed(queryClient: QueryClient, feed: CustomFeedDetail, { topicsChanged = false } = {}): void {
  queryClient.setQueryData<CustomFeedsResponse>(CUSTOM_FEEDS_KEY, (previous) => {
    if (!previous) return previous
    const rest = previous.custom_feeds.filter((item) => item.id !== feed.id)
    return { custom_feeds: [...rest, feed].sort((a, b) => a.name.localeCompare(b.name)) }
  })
  queryClient.setQueryData(customFeedDetailKey(feed.username, feed.slug), (previous: CustomFeedDetail | undefined) =>
    // Update and create answers carry the nodes too; keep them if one ever doesn't.
    feed.nodes || !previous ? feed : { ...previous, ...feed }
  )
  if (topicsChanged) invalidateFeedTopics(queryClient, feed.username, feed.slug)
}

function invalidateFeedTopics(queryClient: QueryClient, username: string, slug: string): void {
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'topic-list' &&
      queryKey[1] === 'custom-feed' &&
      String(queryKey[2]).toLowerCase() === username.toLowerCase() &&
      queryKey[3] === slug
  })
}

function feedForm(input: CustomFeedInput): FormField[] {
  return [
    ['name', input.name.trim()],
    ['description', input.description.trim()],
    ['private', input.private],
    // A private feed is only seen by its owner; the web form applies the same rule.
    ['show_on_profile', input.private ? false : input.showOnProfile]
  ]
}

export type SaveFeedVariables =
  | { mode: 'create'; input: CustomFeedInput }
  | { mode: 'edit'; feed: CustomFeedDetail; input: CustomFeedInput }
  | { mode: 'copy'; source: CustomFeedDetail; input: CustomFeedInput }

/** Create (`POST /custom-feeds`), edit (`PUT /custom-feeds/{id}`) or copy (`POST /custom-feeds/{user}/{slug}/copy`). */
export function useSaveCustomFeed() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()

  return useMutation<CustomFeedDetail, unknown, SaveFeedVariables>({
    mutationFn: async (variables) => {
      const form = feedForm(variables.input)
      const request =
        variables.mode === 'edit'
          ? { method: 'PUT' as const, path: `/custom-feeds/${variables.feed.id}.json` }
          : variables.mode === 'copy'
            ? { method: 'POST' as const, path: `/custom-feeds/${enc(variables.source.username)}/${enc(variables.source.slug)}/copy.json` }
            : { method: 'POST' as const, path: '/custom-feeds.json' }
      return (await apiRequest<CustomFeedResponse>({ ...request, form, priority: 'user' })).custom_feed
    },
    onSuccess: (feed, variables) => {
      applyFeed(queryClient, feed)
      showToast(t(variables.mode === 'edit' ? 'customFeeds.saved' : 'customFeeds.created', { name: feed.name }), 'success')
    },
    onError: (error) => showToast(writeError(error), 'danger')
  })
}

/** `DELETE /custom-feeds/{id}` (204). */
export function useDeleteCustomFeed() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()

  return useMutation<unknown, unknown, CustomFeedDetail>({
    mutationFn: (feed) => apiRequest({ method: 'DELETE', path: `/custom-feeds/${feed.id}.json`, priority: 'user' }),
    onSuccess: (_response, feed) => {
      queryClient.setQueryData<CustomFeedsResponse>(CUSTOM_FEEDS_KEY, (previous) =>
        previous ? { custom_feeds: previous.custom_feeds.filter((item) => item.id !== feed.id) } : previous
      )
      queryClient.removeQueries({ queryKey: customFeedDetailKey(feed.username, feed.slug) })
      showToast(t('customFeeds.deleted', { name: feed.name }), 'success')
    },
    onError: (error) => showToast(writeError(error), 'danger')
  })
}

interface FeedNodeVariables {
  feed: CustomFeedDetail
  categoryId: number
  add: boolean
}

/** `POST /custom-feeds/{id}/nodes` · `DELETE /custom-feeds/{id}/nodes/{categoryId}` */
export function useToggleFeedNode() {
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()

  return useMutation<CustomFeedDetail, unknown, FeedNodeVariables>({
    mutationFn: async ({ feed, categoryId, add }) =>
      (
        await apiRequest<CustomFeedResponse>(
          add
            ? { method: 'POST', path: `/custom-feeds/${feed.id}/nodes.json`, form: [['category_id', categoryId]], priority: 'user' }
            : { method: 'DELETE', path: `/custom-feeds/${feed.id}/nodes/${categoryId}.json`, priority: 'user' }
        )
      ).custom_feed,
    onSuccess: (feed) => applyFeed(queryClient, feed, { topicsChanged: true }),
    onError: (error) => showToast(writeError(error), 'danger')
  })
}
