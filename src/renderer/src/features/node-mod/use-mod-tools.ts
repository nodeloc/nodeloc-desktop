import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { apiRequest, isApiErrorKind } from '../../api/client'
import type { NodeCategory } from '../nodes/types'
import { useNode } from '../nodes/use-node'
import type { ModToolsData } from './types'

/**
 * Every mod tools query lives under this prefix, so invalidating it refreshes
 * the tools payload (stats, rules, moderators) and each section's own lists.
 */
export const nodeModKey = (categoryId: number) => ['node-mod', categoryId] as const

/** `/n/{slug}.json` for the id (shared with the node page), then `GET /node/{id}/mod.json`. */
export function useModTools(slug: string) {
  const node = useNode(slug)
  const categoryId = node.data?.category.id
  const mod = useQuery({
    queryKey: nodeModKey(categoryId ?? 0),
    queryFn: () => apiRequest<ModToolsData>({ path: `/node/${categoryId}/mod.json` }),
    enabled: categoryId !== undefined,
    staleTime: 60_000,
    // A 403 means "not a moderator here"; asking again won't change that.
    retry: (count, error) => count < 2 && !isApiErrorKind(error, 'forbidden', 'unauthorized', 'notFound')
  })
  return { node, mod }
}

/** After a change: the mod tools (and every section list) and the node's own page data. */
export function useRefreshNodeMod(category: Pick<NodeCategory, 'id' | 'slug'>): () => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: nodeModKey(category.id) }),
      queryClient.invalidateQueries({ queryKey: ['node', category.slug] })
    ])
  }, [queryClient, category.id, category.slug])
}
