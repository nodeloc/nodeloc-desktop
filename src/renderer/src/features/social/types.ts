import type { NodeSummary } from '../../api/types'

/** discourse-community join/leave: `POST /node/join/{id}`, `DELETE /node/leave/{id}`. */
export interface MembershipResponse {
  success?: boolean
  joined?: boolean
  community?: NodeSummary
}

/** `POST /node/{id}/request-join`. */
export interface JoinRequestResponse {
  success?: boolean
  request_status?: 'pending' | string
}

export interface CustomFeed {
  id: number
  name: string
  slug: string
  username: string
  node_count: number
  private: boolean
  /** Hex, with or without the leading `#`. */
  color?: string | null
  url?: string
}

export interface CustomFeedsResponse {
  custom_feeds: CustomFeed[]
}
