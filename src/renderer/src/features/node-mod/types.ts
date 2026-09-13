import type { BasicUser, UploadRef } from '../../api/types'
import type { NodeCategory } from '../nodes/types'

/**
 * `GET /node/:id/mod.json` (discourse-community ModToolsController#show).
 * Answered only to people who may moderate the node
 * (`guardian.ensure_can_moderate_community!`: an admin, the node's owner, a
 * member of `{slug}-mods`, or of one of its category moderation groups);
 * everyone else gets 403.
 */
export interface ModToolsData {
  /** CategorySerializer with `include_permissions: true`. */
  category: ModCategory
  /** CommunitySerializer. */
  community: ModCommunity
  groups: {
    /** `{slug}-mods`; null when the group is missing. */
    moderators: ModGroupSummary | null
    /** `{slug}-members`; null when the group is missing. */
    members: ModGroupSummary | null
  }
  /** Everyone in `{slug}-mods` by username, with the owner first even when not in the group. */
  moderators: BasicUser[]
  /** `community_rules` custom field. Older nodes may hold bare strings. */
  rules: Array<ModRule | string>
  /** `community_ads` custom field (the "links" section). */
  ads: ModAd[]
  /** `community_max_ads_per_community` site setting. */
  max_ads: number
  stats: ModStats
  /**
   * The review queue works for this node: category group moderation is on
   * site-wide and `{slug}-mods` is registered as the category's moderation group.
   */
  can_review: boolean
  /** `guardian.can_edit_community?`: an admin or the node's owner. Owner-only sections need it. */
  can_edit: boolean
  /** An ownership transfer still waiting on its recipient, or null. */
  pending_transfer: ModPendingTransfer | null
  verification: ModVerification
  /** The owner or staff. */
  can_transfer_ownership: boolean
  /** The current user watches the node (notified of new topics). */
  new_topic_alerts: boolean
}

/** CategorySerializer as sent by the mod tools; only the fields the app reads are listed. */
export interface ModCategory extends NodeCategory {
  group_permissions?: Array<{ permission_type: number; group_name: string; group_id?: number }>
  available_groups?: string[]
  moderating_group_ids?: number[]
  community_flair_self_serve?: boolean
  key_color_enabled?: boolean
  [key: string]: unknown
}

/** discourse-community CommunitySerializer. */
export interface ModCommunity {
  id: number
  name: string
  slug: string
  color: string
  description?: string | null
  /** `/c/{parent}/{slug}/{id}`. */
  url: string
  topic_count: number
  post_count: number
  member_count: number
  is_joined: boolean
  is_creator: boolean
  uploaded_logo?: UploadRef | null
  uploaded_logo_dark?: UploadRef | null
  /** The node's owner. */
  user_id?: number | null
  parent_category_id?: number | null
  community_verified?: boolean
  community_official?: boolean
}

export interface ModGroupSummary {
  id: number
  name: string
  user_count: number
}

/** RulesController stores these; `id` is a UUID. */
export interface ModRule {
  id: string
  title: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

/** AdvertisementsController entries (`id` is a UUID). */
export interface ModAd {
  id: string
  title: string
  description?: string | null
  url: string
  image_url?: string | null
  upload_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface ModDailyCount {
  /** ISO date, oldest first. */
  date: string
  count: number
}

export interface ModStats {
  topics_7d: number
  posts_7d: number
  members_7d: number
  active_members_7d: number
  /** Pending reviewables in this category. */
  pending_reviewables: number
  /** Join requests waiting on `{slug}-members`. */
  pending_requests: number
  /** Thirty days each, empty days filled in. */
  series_30d: {
    members: ModDailyCount[]
    topics: ModDailyCount[]
    posts: ModDailyCount[]
  }
  invites: {
    links_active: number
    joined_7d: number
    joined_30d: number
  }
}

export interface ModPendingTransfer {
  user: BasicUser
  requested_at: string
}

/** `Verifications.state_for(category, current_user)`. */
export interface ModVerification {
  available: boolean
  official: boolean
  status: string | null
  manual: boolean
  /** Admins only. */
  can_manage: boolean
  note: string | null
  moderation_reason: string | null
  ends_at: string | null
  days_remaining: number | null
  /** Within the warning window and not a manual mark. */
  expiring: boolean
  warning_days: number
  merchant: { name: string; ends_at: string | null } | null
  /** The owner may apply now. */
  can_apply: boolean
  renew_url: string
}
