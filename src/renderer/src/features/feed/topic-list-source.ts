import type { QueryValue } from '@shared/api'
import type { FeedFilter, NodeView } from '../../lib/routes'

/** Where a topic list comes from. `key` identifies the list in the query cache. */
export interface TopicListSource {
  key: readonly unknown[]
  path: string
  query?: Record<string, QueryValue>
}

export const TOP_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'all'] as const
export type TopPeriod = (typeof TOP_PERIODS)[number]

export function feedSource(filter: FeedFilter, period: TopPeriod): TopicListSource {
  if (filter === 'top') return { key: ['feed', 'top', period], path: '/top.json', query: { period } }
  return { key: ['feed', filter], path: `/${filter}.json` }
}

/** `listPath` is the category's `/c/parent/child/id` path. */
export function categorySource(listPath: string, view: NodeView, period: TopPeriod): TopicListSource {
  if (view === 'top') {
    return { key: ['category', listPath, 'top', period], path: `${listPath}/l/top.json`, query: { period } }
  }
  return { key: ['category', listPath, view], path: `${listPath}/l/${view}.json` }
}

export function tagSource(slug: string): TopicListSource {
  return { key: ['tag', slug], path: `/tag/${encodeURIComponent(slug)}.json` }
}

export function customFeedSource(username: string, slug: string): TopicListSource {
  return {
    key: ['custom-feed', username, slug],
    path: `/f/${encodeURIComponent(username)}/${encodeURIComponent(slug)}.json`
  }
}
