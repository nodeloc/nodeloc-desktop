import { useCallback } from 'react'
import type { NodeCategory } from '../../nodes/types'
import { useRefreshNodeMod } from '../use-mod-tools'

/** Fire-and-forget refresh of the mod tools (and every section list under it) and `['node', slug]`. */
export function useInvalidateNodeMod(category: Pick<NodeCategory, 'id' | 'slug'>): () => void {
  const refresh = useRefreshNodeMod(category)
  return useCallback(() => {
    void refresh()
  }, [refresh])
}
