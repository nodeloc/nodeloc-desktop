import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { NodeBrowseResponse, NodeSummary, NodesResponse } from '../../api/types'

export const SECTION_PREVIEW_COUNT = 6
const RECOMMENDED_PAGE_SIZE = 30
const SECTION_PAGE_SIZE = 30

/** `/nodes.json` first page. Same key and request as the node rail, so they share one fetch. */
export function useNodesOverview() {
  return useQuery({
    queryKey: ['nodes', 'overview'],
    queryFn: () => apiRequest<NodesResponse>({ path: '/nodes.json' }),
    staleTime: 10 * 60_000
  })
}

/** Recommended nodes after the overview's first page; fetched only once the user asks. */
export function useMoreRecommended(enabled: boolean, startOffset: number) {
  return useInfiniteQuery({
    queryKey: ['nodes', 'recommended', startOffset],
    initialPageParam: startOffset,
    enabled,
    queryFn: ({ pageParam }) =>
      apiRequest<NodesResponse>({
        path: '/nodes.json',
        query: { limit: RECOMMENDED_PAGE_SIZE, offset: pageParam },
        priority: 'user'
      }),
    getNextPageParam: (lastPage) => {
      const meta = lastPage.recommended_meta
      return meta.has_more && lastPage.recommended.length > 0 ? meta.offset + meta.limit : undefined
    }
  })
}

/** The first few nodes of a section, for the browse page. */
export function useSectionPreview(sectionId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['nodes', 'browse', sectionId, 'preview'],
    enabled,
    queryFn: () =>
      apiRequest<NodeBrowseResponse>({
        path: `/node/browse/${sectionId}.json`,
        query: { page: 0, per_page: SECTION_PREVIEW_COUNT }
      }),
    staleTime: 10 * 60_000
  })
}

/** Every node in a section. `page` is 0-based. */
export function useSectionNodes(sectionId: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['nodes', 'browse', sectionId],
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam }) =>
      apiRequest<NodeBrowseResponse>({
        path: `/node/browse/${sectionId}.json`,
        query: { page: pageParam, per_page: SECTION_PAGE_SIZE }
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more && lastPage.communities.length > 0 ? lastPage.meta.page + 1 : undefined,
    staleTime: 10 * 60_000
  })
}

/** Offset pages can overlap when member counts reorder the list mid-paging; keep the first copy. */
export function uniqueNodes(lists: NodeSummary[][]): NodeSummary[] {
  const seen = new Set<number>()
  const result: NodeSummary[] = []
  for (const list of lists) {
    for (const node of list) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      result.push(node)
    }
  }
  return result
}
