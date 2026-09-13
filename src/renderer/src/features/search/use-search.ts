import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useCategoryIndex, type CategoryIndex } from '../../api/site'
import type { Category, DirectoryApp, SearchPost, SearchResponse, TopicListItem } from '../../api/types'
import type { AppsDirectoryResponse, SearchResult, UserSearchResponse } from './types'

/** Discourse stops full-page search at page 10. */
const MAX_SEARCH_PAGE = 10
/** Nodes needed before local name matching stops topping up the results. */
const MIN_NODE_RESULTS = 3
const MAX_LOCAL_NODES = 30
/** Guards the apps loop if `total` ever disagrees with the pages. */
const MAX_APP_PAGES = 10

/** Full-page search (`/search.json`): post hits joined to their topics, 50 per page. */
export function useSearchPosts(query: string, enabled = true) {
  const search = useInfiniteQuery({
    queryKey: ['search', query],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiRequest<SearchResponse>({
        path: '/search.json',
        query: { q: query, page: pageParam > 1 ? pageParam : undefined },
        priority: 'user'
      }),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.grouped_search_result.more_full_page_results && lastPage.posts.length > 0 && lastPageParam < MAX_SEARCH_PAGE
        ? lastPageParam + 1
        : undefined,
    enabled,
    staleTime: 60_000
  })

  const merged = useMemo(() => {
    const topics = new Map<number, TopicListItem>()
    const posts: SearchPost[] = []
    const seen = new Set<number>()
    for (const page of search.data?.pages ?? []) {
      for (const topic of page.topics) topics.set(topic.id, topic)
      for (const post of page.posts) {
        if (seen.has(post.id)) continue
        seen.add(post.id)
        posts.push(post)
      }
    }
    const results: SearchResult[] = posts.map((post) => ({ post, topic: topics.get(post.topic_id) }))
    // Discourse reports problems such as a too-short term here with a 200.
    const serverError = search.data?.pages[0]?.grouped_search_result.error ?? null
    return { results, serverError }
  }, [search.data])

  return { ...search, ...merged }
}

/**
 * Header quick search (`/search/query.json`). For guests the full-page
 * endpoint never returns categories or users; this one does.
 */
export function useQuickSearch(term: string, enabled = true) {
  return useQuery({
    queryKey: ['search-quick', term],
    queryFn: () => apiRequest<SearchResponse>({ path: '/search/query.json', query: { term }, priority: 'user' }),
    enabled,
    staleTime: 60_000
  })
}

/** Quick-search nodes, topped up by matching node names locally when the server finds few. */
export function useNodeResults(text: string) {
  const quick = useQuickSearch(text)
  const index = useCategoryIndex()
  const nodes = useMemo(() => mergeNodes(quick.data?.categories ?? [], index, text), [quick.data, index, text])
  return { ...quick, nodes }
}

function mergeNodes(found: Category[], index: CategoryIndex | undefined, text: string): Category[] {
  // The site index carries logos and descriptions the search payload may omit.
  const nodes = found.map((category) => index?.byId.get(category.id) ?? category)
  if (nodes.length >= MIN_NODE_RESULTS || !index) return nodes

  const needle = text.trim().toLowerCase()
  const seen = new Set(nodes.map((node) => node.id))
  for (const category of index.list) {
    if (nodes.length >= MAX_LOCAL_NODES) break
    if (!category.parent_category_id || seen.has(category.id)) continue
    if (category.name.toLowerCase().includes(needle) || category.slug.toLowerCase().includes(needle)) {
      nodes.push(category)
    }
  }
  return nodes
}

/** User search; works for guests. */
export function useUserSearch(term: string) {
  return useQuery({
    queryKey: ['search-users', term],
    queryFn: () =>
      apiRequest<UserSearchResponse>({ path: '/u/search/users.json', query: { term, limit: 20 }, priority: 'user' }),
    staleTime: 60_000
  })
}

/** The whole apps directory, filtered locally. It's a few dozen apps over 0-based pages. */
export function useAppsDirectory() {
  return useQuery({
    queryKey: ['apps-directory'],
    queryFn: fetchAllApps,
    staleTime: 10 * 60_000
  })
}

async function fetchAllApps(): Promise<DirectoryApp[]> {
  const apps: DirectoryApp[] = []
  for (let page = 0; page < MAX_APP_PAGES; page++) {
    const response = await apiRequest<AppsDirectoryResponse>({
      path: '/apps/directory.json',
      query: { page: page > 0 ? page : undefined },
      priority: 'foreground'
    })
    apps.push(...response.apps)
    if (response.apps.length === 0 || apps.length >= response.total) break
  }
  return apps
}

export function filterApps(apps: readonly DirectoryApp[], text: string): DirectoryApp[] {
  const needle = text.trim().toLowerCase()
  return apps.filter(
    (app) =>
      app.name.toLowerCase().includes(needle) ||
      app.slug.toLowerCase().includes(needle) ||
      (app.description ?? '').toLowerCase().includes(needle)
  )
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
