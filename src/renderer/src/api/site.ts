import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { Category, MobileMetaResponse, SiteResponse } from './types'

export const SITE_QUERY_KEY = ['site'] as const

export interface CategoryIndex {
  list: Category[]
  byId: Map<number, Category>
  bySlug: Map<string, Category>
  /** Top-level sections (互联网服务, 科技与创作 …). */
  sections: Category[]
}

function indexCategories(site: SiteResponse): CategoryIndex {
  const byId = new Map<number, Category>()
  const bySlug = new Map<string, Category>()
  for (const category of site.categories) {
    byId.set(category.id, category)
    // Nodes have unique slugs site-wide; sections share the namespace.
    if (!bySlug.has(category.slug)) bySlug.set(category.slug, category)
  }
  const sections = site.categories
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  return { list: site.categories, byId, bySlug, sections }
}

const siteQuery = {
  queryKey: SITE_QUERY_KEY,
  // Large and sent with no-cache headers: keep one copy for the session.
  queryFn: () => apiRequest<SiteResponse>({ path: '/site.json' }),
  staleTime: 10 * 60_000,
  gcTime: Infinity
}

export function useSite() {
  return useQuery(siteQuery)
}

export function useCategoryIndex(): CategoryIndex | undefined {
  return useQuery({ ...siteQuery, select: indexCategories }).data
}

/** Discourse list URLs need the full parent/child slug path, or they 301. */
export function categoryListPath(category: Category, index: CategoryIndex | undefined): string {
  const parent = category.parent_category_id ? index?.byId.get(category.parent_category_id) : undefined
  return parent ? `/c/${parent.slug}/${category.slug}/${category.id}` : `/c/${category.slug}/${category.id}`
}

export function useFeatures() {
  return useQuery({
    queryKey: ['mobile-meta'],
    queryFn: () => apiRequest<MobileMetaResponse>({ path: '/mobile/meta.json', priority: 'background' }),
    staleTime: 30 * 60_000
  }).data?.features
}
