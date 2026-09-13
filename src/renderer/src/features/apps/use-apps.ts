import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import type { AppDetail, AppDetailResponse, AppKind, AppsDirectoryPage } from './types'

const PER_PAGE = 24

async function fetchDirectoryPage(kind: AppKind | null, page: number): Promise<AppsDirectoryPage> {
  const data = await apiRequest<AppsDirectoryPage | AppDetail[]>({
    path: '/apps/directory.json',
    query: { kind: kind ?? undefined, page: page > 0 ? page : undefined },
    priority: 'foreground'
  })
  // Early builds of the plugin answered with a bare array.
  if (Array.isArray(data)) return { apps: data, total: data.length, page: 0, per_page: data.length || PER_PAGE }
  return data
}

/** The apps directory, one kind at a time (APPS-01). */
export function useAppsDirectoryPages(kind: AppKind | null) {
  return useInfiniteQuery({
    queryKey: ['apps', 'directory', kind ?? 'all'],
    queryFn: ({ pageParam }) => fetchDirectoryPage(kind, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const perPage = last.per_page || PER_PAGE
      return (last.page + 1) * perPage < last.total && last.apps.length > 0 ? last.page + 1 : undefined
    },
    staleTime: 10 * 60_000
  })
}

export function useAppDetail(slug: string) {
  return useQuery({
    queryKey: ['apps', 'detail', slug],
    queryFn: async () =>
      (await apiRequest<AppDetailResponse>({ path: `/apps/${encodeURIComponent(slug)}.json`, priority: 'user' })).directory_app,
    enabled: slug.length > 0,
    staleTime: 5 * 60_000
  })
}
