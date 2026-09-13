import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { apiRequest } from '../../api/client'
import type { BasicUser, Tag, TopicListItem, TopicListResponse } from '../../api/types'
import type { TopicListSource } from './topic-list-source'

export function useTopicList(source: TopicListSource) {
  const query = useInfiniteQuery({
    queryKey: ['topic-list', ...source.key],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<TopicListResponse>({
        path: source.path,
        query: { ...source.query, page: pageParam > 0 ? pageParam : undefined }
      }),
    // Discourse keeps sending `more_topics_url` past the last page, so also stop on an empty page.
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.topic_list.more_topics_url && lastPage.topic_list.topics.length > 0 ? lastPageParam + 1 : undefined
  })

  const merged = useMemo(() => {
    const topics: TopicListItem[] = []
    const seen = new Set<number>()
    const users = new Map<number, BasicUser>()
    for (const page of query.data?.pages ?? []) {
      for (const user of page.users ?? []) users.set(user.id, user)
      // Bumped topics can move between pages while paging; keep the first copy.
      for (const topic of page.topic_list.topics) {
        if (seen.has(topic.id)) continue
        seen.add(topic.id)
        topics.push(topic)
      }
    }
    const topTags: Array<string | Tag> = query.data?.pages[0]?.topic_list.top_tags ?? []
    return { topics, users, topTags }
  }, [query.data])

  return { ...query, ...merged }
}
