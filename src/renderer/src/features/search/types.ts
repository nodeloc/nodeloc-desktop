import type { BasicUser, DirectoryApp, SearchPost, TopicListItem } from '../../api/types'

export type SearchStatus = 'open' | 'closed' | 'archived' | 'noreplies'
export type SearchOrder = 'latest' | 'likes' | 'views' | 'latest_topic'

/** The advanced filter panel (SEARCH-04). Empty strings mean "any". */
export interface SearchFilters {
  nodeSlug: string
  /** As typed: comma or space separated. */
  tags: string
  author: string
  /** `YYYY-MM-DD`, straight from a date input. */
  after: string
  before: string
  status: SearchStatus | ''
  order: SearchOrder | ''
}

/** A post hit joined to its topic (the response lists them separately). */
export interface SearchResult {
  post: SearchPost
  topic?: TopicListItem
}

/** `GET /u/search/users.json` */
export interface UserSearchResponse {
  users: BasicUser[]
}

/** `GET /apps/directory.json` — pages are 0-based. */
export interface AppsDirectoryResponse {
  apps: DirectoryApp[]
  total: number
  page: number
  per_page: number
  counts?: Record<string, number>
}
