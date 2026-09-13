import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type {
  NestedChildrenResponse,
  NestedContextResponse,
  NestedSort,
  NestedTopicResponse,
  Post,
  TopicResponse
} from '../../api/types'

/** The nested endpoints accept any slug; the id is what matters. */
const SLUG = 'topic'

/** A nested URL can redirect to the chronological endpoint for private messages. */
export function isFlatTopicResponse(
  response: NestedTopicResponse | NestedContextResponse | TopicResponse | undefined
): response is TopicResponse {
  return response !== undefined && 'post_stream' in response
}

export function useNestedTopic(topicId: number, sort: NestedSort | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['topic', topicId, 'nested', sort ?? 'default'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<NestedTopicResponse | TopicResponse>({
        path: `/n/${SLUG}/${topicId}.json`,
        query: { sort: sort ?? undefined, page: pageParam > 0 ? pageParam : undefined },
        priority: 'user'
      }),
    // `has_more_roots` arrives as a boolean or as 0/1.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      (!isFlatTopicResponse(lastPage) && lastPage.has_more_roots ? lastPageParam + 1 : undefined),
    // Changing the sort keeps the current thread on screen until the new order arrives,
    // so only the replies refresh. Never carries data over from another topic.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === topicId ? previous : undefined),
    enabled,
    staleTime: 60_000
  })
}

/** The ancestors and direct thread of one reply, for deep links to a post number. */
export function useTopicContext(topicId: number, postNumber: number) {
  return useQuery({
    queryKey: ['topic', topicId, 'context', postNumber],
    queryFn: () =>
      apiRequest<NestedContextResponse | TopicResponse>({ path: `/n/${SLUG}/${topicId}/${postNumber}.json`, priority: 'user' }),
    staleTime: 60_000,
    retry: false
  })
}

export function fetchChildren(topicId: number, postNumber: number, sort: NestedSort | null, page: number, depth: number) {
  return apiRequest<NestedChildrenResponse>({
    path: `/n/${SLUG}/${topicId}/children/${postNumber}.json`,
    query: { sort: sort ?? undefined, page: page > 0 ? page : undefined, depth },
    priority: 'user'
  })
}

const FLAT_CHUNK = 20

/**
 * Chronological reader for topics without a nested view (private messages,
 * or when the nested endpoint isn't available): the first page comes with
 * the topic, the rest is fetched by post id from its stream.
 */
export function useFlatTopic(topicId: number, enabled = true, initialData?: TopicResponse) {
  const first = useQuery({
    queryKey: ['topic', topicId, 'flat'],
    queryFn: () => apiRequest<TopicResponse>({ path: `/t/${topicId}.json`, priority: 'user' }),
    enabled,
    initialData,
    staleTime: 60_000
  })

  const loaded = new Set(first.data?.post_stream.posts.map((post) => post.id) ?? [])
  const remaining = first.data?.post_stream.stream.filter((id) => !loaded.has(id)) ?? []

  const more = useInfiniteQuery({
    queryKey: ['topic', topicId, 'flat-more', remaining.length],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<{ post_stream: { posts: Post[] } }>({
        path: `/t/${topicId}/posts.json`,
        query: { 'post_ids[]': remaining.slice(pageParam, pageParam + FLAT_CHUNK) },
        priority: 'user'
      }),
    getNextPageParam: (_lastPage, _pages, lastPageParam) =>
      lastPageParam + FLAT_CHUNK < remaining.length ? lastPageParam + FLAT_CHUNK : undefined,
    enabled: false
  })

  return { first, more, hasRemaining: remaining.length > 0 }
}
