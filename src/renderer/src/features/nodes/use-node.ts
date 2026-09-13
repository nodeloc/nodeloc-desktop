import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { NodeResponse } from './types'

/** One node's page data. NodePage and NodeSidebar share this cache entry. */
export function useNode(slug: string) {
  return useQuery({
    queryKey: ['node', slug],
    queryFn: () => apiRequest<NodeResponse>({ path: `/n/${encodeURIComponent(slug)}.json` }),
    staleTime: 5 * 60_000
  })
}

/**
 * The node's `/c/parent/child/id` list path; Discourse 301s without the full
 * path. Null when the slug is a top-level section, which has no node page.
 */
export function nodeListPath({ category, parent_category }: NodeResponse): string | null {
  return parent_category ? `/c/${parent_category.slug}/${category.slug}/${category.id}` : null
}
