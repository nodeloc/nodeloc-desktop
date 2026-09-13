import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'

/** The membership fields every cached copy of a node carries. */
export interface MembershipFields {
  is_joined?: boolean
  member_count?: number
}

export type MembershipPatch = (current: MembershipFields) => { is_joined: boolean; member_count: number }

export type CacheSnapshot = Array<[QueryKey, unknown]>

/** Arrays of NodeSummary inside the node directory responses. */
const NODE_LIST_FIELDS = ['recommended', 'communities', 'owned', 'moderated'] as const

/**
 * Queries that hold node copies: the `['nodes', …]` directory lists (overview,
 * recommended pages, section browse, joined, recently visited), each node page
 * `['node', slug]`, and a profile's owned/moderated nodes.
 */
function holdsNodes(query: Query): boolean {
  const [head, , third] = query.queryKey
  return head === 'nodes' || head === 'node' || (head === 'profile' && third === 'nodes')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function patchList(list: unknown, id: number, patch: MembershipPatch): unknown {
  if (!Array.isArray(list)) return list
  let changed = false
  const next = list.map((item: unknown) => {
    if (!isRecord(item) || item.id !== id) return item
    changed = true
    return { ...item, ...patch(item as MembershipFields) }
  })
  return changed ? next : list
}

/** Returns the same reference when nothing matched, so untouched queries don't re-render. */
function patchData(data: unknown, id: number, patch: MembershipPatch): unknown {
  if (!isRecord(data)) return data

  // Infinite queries.
  const pages = data.pages
  if (Array.isArray(pages)) {
    const nextPages = pages.map((page: unknown) => patchData(page, id, patch))
    return nextPages.some((page, index) => page !== pages[index]) ? { ...data, pages: nextPages } : data
  }

  let next: Record<string, unknown> | null = null
  // `/n/{slug}.json`
  const category = data.category
  if (isRecord(category) && category.id === id && 'parent_category' in data) {
    next = { ...data, category: { ...category, ...patch(category as MembershipFields) } }
  }
  for (const field of NODE_LIST_FIELDS) {
    const value = data[field]
    const patched = patchList(value, id, patch)
    if (patched !== value) {
      next ??= { ...data }
      next[field] = patched
    }
  }
  return next ?? data
}

export function snapshotNodeCaches(queryClient: QueryClient): CacheSnapshot {
  return queryClient.getQueriesData({ predicate: holdsNodes })
}

export function restoreSnapshot(queryClient: QueryClient, snapshot: CacheSnapshot): void {
  for (const [key, data] of snapshot) queryClient.setQueryData(key, data)
}

/** Applies a membership change to every cached copy of node `id`. */
export function patchNodeEverywhere(queryClient: QueryClient, id: number, patch: MembershipPatch): void {
  queryClient.setQueriesData<unknown>({ predicate: holdsNodes }, (data: unknown) => patchData(data, id, patch))
}
