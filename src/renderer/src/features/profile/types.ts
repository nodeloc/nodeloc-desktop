import type { Badge, NodeSummary, PointsHistoryResponse, UserProfile, UserSummaryResponse } from '../../api/types'

/**
 * Profile response fields that api/types.ts doesn't model yet, checked
 * against live anonymous responses.
 */

export interface ProfileUser extends UserProfile {
  /** Set when the user hides their profile; most other fields are then left out. */
  profile_hidden?: boolean
}

export interface ProfileResponse {
  user: ProfileUser
}

export interface ProfileSummaryResponse extends UserSummaryResponse {
  user_summary: UserSummaryResponse['user_summary'] & {
    can_see_summary_stats?: boolean
    can_see_user_actions?: boolean
  }
}

/** One grant from `/user-badges/{username}.json`; a badge granted twice appears twice. */
export interface UserBadge {
  id: number
  badge_id: number
  granted_at: string
  topic_id?: number | null
  post_number?: number | null
}

export interface UserBadgesResponse {
  badges?: Badge[]
  user_badges: UserBadge[]
}

/** discourse-community `/node/by-user/{username}.json`. */
export interface NodesByUserResponse {
  user: { username: string; name?: string | null }
  owned: NodeSummary[]
  moderated: NodeSummary[]
}

export type PointsEntry = PointsHistoryResponse['points_history'][number]
