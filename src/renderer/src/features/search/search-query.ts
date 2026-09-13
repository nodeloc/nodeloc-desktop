import type { SearchFilters, SearchOrder, SearchStatus } from './types'

/** Shorter queries don't search (SEARCH-03). */
export const MIN_QUERY_LENGTH = 2

export const SEARCH_STATUSES: readonly SearchStatus[] = ['open', 'closed', 'archived', 'noreplies']
export const SEARCH_ORDERS: readonly SearchOrder[] = ['latest', 'likes', 'views', 'latest_topic']

export const EMPTY_FILTERS: SearchFilters = {
  nodeSlug: '',
  tags: '',
  author: '',
  after: '',
  before: '',
  status: '',
  order: ''
}

/** Counts characters, not UTF-16 units, so "测试" is two. */
export function isSearchable(text: string): boolean {
  return Array.from(text.trim()).length >= MIN_QUERY_LENGTH
}

/** The filters as Discourse search syntax, e.g. `#vps tags:ai,docker @demo-user`. */
export function filterSyntax(filters: SearchFilters, withImages = false): string {
  const parts: string[] = []
  if (filters.nodeSlug) parts.push(`#${filters.nodeSlug}`)
  const tags = filters.tags.split(/[,，\s]+/).filter(Boolean)
  if (tags.length > 0) parts.push(`tags:${tags.join(',')}`)
  const author = filters.author.trim().replace(/^@/, '')
  if (author) parts.push(`@${author}`)
  if (filters.after) parts.push(`after:${filters.after}`)
  if (filters.before) parts.push(`before:${filters.before}`)
  if (filters.status) parts.push(`status:${filters.status}`)
  if (filters.order) parts.push(`order:${filters.order}`)
  if (withImages) parts.push('with:images')
  return parts.join(' ')
}

/** What goes to the API: the user's text followed by the filter syntax. */
export function composeQuery(text: string, filters: SearchFilters, withImages: boolean): string {
  return [text.trim(), filterSyntax(filters, withImages)].filter(Boolean).join(' ')
}

export function countActiveFilters(filters: SearchFilters): number {
  return Object.values(filters).filter(Boolean).length
}

/** Words to highlight: the typed text minus any syntax the user wrote by hand. */
export function highlightTerms(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((word) => word && !/^[#@]/.test(word) && !word.includes(':'))
    .map((word) => word.replace(/^"+|"+$/g, ''))
    .filter(Boolean)
}
