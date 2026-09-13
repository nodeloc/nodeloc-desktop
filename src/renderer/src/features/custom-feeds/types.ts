import type { BasicUser, NodeSummary } from '../../api/types'

/** `CustomFeedSerializer` (plugins/discourse-community). `nodes` only on single-feed responses. */
export interface CustomFeedDetail {
  id: number
  name: string
  slug: string
  description?: string | null
  private: boolean
  show_on_profile: boolean
  color?: string | null
  /** `/f/{username_lower}/{slug}` */
  url?: string
  username: string
  node_count: number
  /** True for the owner. */
  can_edit: boolean
  created_at?: string
  creator?: BasicUser
  nodes?: NodeSummary[]
}

/** Show, create, update, copy, add/remove node all answer with the feed. */
export interface CustomFeedResponse {
  custom_feed: CustomFeedDetail
}

/** `GET /custom-feeds/node-search.json?term=` (≤20, nodes only). */
export interface NodeSearchResponse {
  nodes: NodeSummary[]
}

export interface CustomFeedInput {
  name: string
  description: string
  private: boolean
  showOnProfile: boolean
}

/** Server limits: `CustomFeed::MAX_NAME_LENGTH` and friends, `community_custom_feed_max_nodes` default. */
export const FEED_NAME_MAX = 50
export const FEED_DESCRIPTION_MAX = 500
export const FEED_NODES_MAX = 100
