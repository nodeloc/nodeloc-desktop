/**
 * Discourse and NodeLoc plugin response shapes, modelled from live responses
 * and the plugin sources. Only fields the app reads are listed. Plugin fields
 * are optional: a plugin omits them when they don't apply (for example vote
 * fields on a private message).
 */

// ---------------------------------------------------------------------------
// Users

export interface BasicUser {
  id: number
  username: string
  name?: string | null
  avatar_template: string
  animated_avatar?: string | null
  trust_level?: number
  title?: string | null
}

export interface FlairFields {
  flair_name?: string | null
  /** An image path/URL, or a Font Awesome icon name such as "gem". */
  flair_url?: string | null
  flair_bg_color?: string | null
  flair_color?: string | null
  flair_group_id?: number | null
}

export interface TitleStyle {
  text_color?: string
  text_effect?: string
  glitch_left_color?: string
  glitch_right_color?: string
}

export interface Badge {
  id: number
  name: string
  description?: string
  grant_count?: number
  icon?: string | null
  image_url?: string | null
  badge_type_id?: number
  slug?: string
  allow_title?: boolean
  custom_style?: TitleStyle | null
}

export interface UserGroup extends FlairFields {
  id: number
  name: string
  full_name?: string | null
  title?: string | null
}

export interface UserProfile extends FlairFields {
  id: number
  username: string
  name?: string | null
  avatar_template: string
  animated_avatar?: string | null
  title?: string | null
  bio_cooked?: string | null
  bio_excerpt?: string | null
  website?: string | null
  website_name?: string | null
  location?: string | null
  created_at: string
  last_posted_at?: string | null
  last_seen_at?: string | null
  trust_level: number
  moderator: boolean
  admin: boolean
  badge_count?: number
  profile_view_count?: number
  time_read?: number
  card_background_upload_url?: string | null
  profile_background_upload_url?: string | null
  groups?: UserGroup[]
  total_followers?: number
  total_following?: number
  can_follow?: boolean
  is_followed?: boolean
  gamification_score?: number
  featured_topic_count?: number
  owned_community_count?: number
  server_count?: number
  can_send_private_message_to_user?: boolean
  can_chat_user?: boolean
  accepted_answers?: number
  ignored?: boolean
  muted?: boolean
  can_ignore_user?: boolean
  can_mute_user?: boolean
  custom_fields?: { signature_cooked?: string | null }
}

export interface UserResponse {
  user: UserProfile
  badges?: Badge[]
}

export interface UserSummaryResponse {
  user_summary: {
    likes_given: number
    likes_received: number
    topics_entered: number
    posts_read_count: number
    days_visited: number
    topic_count: number
    post_count: number
    time_read: number
    recent_time_read?: number
    solved_count?: number
    topic_ids?: number[]
    replies?: Array<{ topic_id: number; post_number: number; like_count: number; created_at: string }>
    most_liked_by_users?: Array<BasicUser & { count: number }>
    most_replied_to_users?: Array<BasicUser & { count: number }>
    badges?: Array<{ id: number; badge_id: number; granted_at: string; count?: number }>
    top_categories?: Array<{ id: number; name: string; color: string; slug: string; topic_count: number; post_count: number }>
  }
  topics?: Array<{ id: number; title: string; slug: string; posts_count: number; like_count: number; created_at: string; category_id: number }>
  badges?: Badge[]
  users?: BasicUser[]
}

/** user_actions filter codes. */
export const USER_ACTION = { like: 1, wasLiked: 2, bookmark: 3, topic: 4, reply: 5 } as const

export interface UserAction {
  excerpt: string
  truncated?: boolean
  action_type: number
  created_at: string
  avatar_template: string
  acting_avatar_template: string
  slug: string
  topic_id: number
  target_username: string
  post_number: number
  post_id: number | null
  username: string
  name?: string | null
  user_id: number
  acting_username: string
  acting_name?: string | null
  acting_user_id: number
  title: string
  deleted: boolean
  hidden: boolean | null
  post_type: number | null
  category_id: number
  closed: boolean
  archived: boolean
  reply_to_post_number: number | null
}

export interface UserActionsResponse {
  user_actions: UserAction[]
}

export interface PointsHistoryResponse {
  points_history: Array<{ date: string; points: number; description: string; created_at: string; is_positive: boolean }>
  page: number
  has_more: boolean
}

/** Account preferences (`user_option`). Several enums arrive as names, not numbers. */
export interface UserOption {
  community_view_mode?: 'compact' | 'expand' | 'card' | null
  /** discourse-community: show the recently viewed topics rail. */
  community_show_recent_posts?: boolean
  homepage_id?: number | null
  text_size?: string
  send_shortcut?: string
  interface_color_mode?: number
  timezone?: string
  hide_presence?: boolean
  hide_profile?: boolean
  allow_private_messages?: boolean
}

export interface CurrentUser {
  id: number
  username: string
  name?: string | null
  avatar_template: string
  animated_avatar?: string | null
  title?: string | null
  trust_level: number
  admin: boolean
  moderator: boolean
  staff?: boolean
  unread_notifications: number
  unread_high_priority_notifications: number
  all_unread_notifications_count?: number
  new_personal_messages_notifications_count?: number
  can_create_topic?: boolean
  can_send_private_messages?: boolean
  can_create_community?: boolean
  gamification_score?: number
  recent_post_category_ids?: number[]
  groups?: Array<{ id: number; name: string; has_messages?: boolean }>
  user_option?: UserOption
  can_chat?: boolean
  has_chat_enabled?: boolean
  chat_channels?: unknown
  /** discourse-featured-topic: in `featured_topic_allowed_groups`. */
  can_feature_topics?: boolean
}

export interface CurrentUserResponse {
  current_user: CurrentUser
}

// ---------------------------------------------------------------------------
// Categories and nodes

export interface UploadRef {
  id: number
  url: string
  width?: number
  height?: number
}

export interface Category {
  id: number
  name: string
  slug: string
  color: string
  text_color?: string
  description?: string | null
  description_text?: string | null
  description_excerpt?: string | null
  parent_category_id?: number | null
  topic_count: number
  post_count: number
  position?: number
  read_restricted?: boolean
  notification_level?: number | null
  style_type?: string
  icon?: string | null
  emoji?: string | null
  topic_template?: string | null
  topic_title_placeholder?: string | null
  minimum_required_tags?: number
  uploaded_logo?: UploadRef | null
  uploaded_logo_dark?: UploadRef | null
  uploaded_background?: UploadRef | null
  uploaded_background_dark?: UploadRef | null
  permission?: number | null
  created_at?: string | null
  user_id?: number

  // discourse-community (nodes only)
  is_joined?: boolean
  is_creator?: boolean
  member_count?: number
  moderator_count?: number
  moderators?: Array<BasicUser & { app_bot?: boolean }>
  community_rules?: Array<string | { title?: string; description?: string; body?: string }>
  community_verified?: boolean
  community_official?: boolean
  owner_username?: string
  can_edit?: boolean
  /** Sent to signed-in users: may manage this node (also allows featuring its topics). */
  can_edit_community?: boolean
}

/** discourse-community's CommunitySerializer (lighter than Category). */
export interface NodeSummary {
  id: number
  name: string
  slug: string
  color: string
  description?: string | null
  url: string
  topic_count: number
  post_count: number
  member_count: number
  is_joined: boolean
  is_creator: boolean
  uploaded_logo?: UploadRef | null
  uploaded_logo_dark?: UploadRef | null
  user_id?: number
  parent_category_id: number
  community_verified?: boolean
  community_official?: boolean
}

export interface NodesResponse {
  recommended: NodeSummary[]
  recommended_meta: { total: number; offset: number; limit: number; has_more: boolean }
  grouped: Record<string, { category: Category; total_count: number; has_more: boolean }>
}

export interface NodeBrowseResponse {
  communities: NodeSummary[]
  meta: { total: number; page: number; per_page: number; has_more: boolean }
}

export interface NodeListResponse {
  communities: NodeSummary[]
}

export interface NodePageResponse {
  category: Category
  parent_category: Category | null
}

// ---------------------------------------------------------------------------
// Topic lists

export interface TopicPoster {
  user_id: number
  description?: string
  extras?: string | null
}

export interface Tag {
  id: number
  name: string
  slug: string
}

export type VoteDirection = 'up' | 'down' | 'none'

export interface TopicListItem {
  id: number
  title: string
  fancy_title?: string
  slug: string
  posts_count: number
  reply_count: number
  like_count: number
  views: number
  created_at: string
  last_posted_at?: string | null
  bumped_at?: string
  category_id?: number | null
  pinned?: boolean
  closed?: boolean
  archived?: boolean
  unseen?: boolean
  last_read_post_number?: number | null
  highest_post_number?: number
  excerpt?: string | null
  image_url?: string | null
  posters?: TopicPoster[]
  last_poster_username?: string
  /** Older Discourse sends names, newer sends objects. */
  tags?: Array<string | Tag>

  // discourse-vote
  op_post_id?: number
  op_vote_score?: number
  op_vote_count?: number
  op_vote_direction?: VoteDirection
  op_can_vote_up?: boolean
  op_can_vote_down?: boolean
  op_like_count?: number

  // discourse-community, featured-topic, lottery, read-permission
  topic_images?: string[]
  topic_thumbnails?: string[]
  topic_video_url?: string | null
  is_featured?: boolean
  lottery_status?: 'open' | 'drawn' | 'closed' | null
  has_read_permission_restriction?: boolean
  can_read_topic?: boolean
}

export interface TopicListResponse {
  users?: BasicUser[]
  topic_list: {
    more_topics_url?: string | null
    topics: TopicListItem[]
    top_tags?: Array<string | Tag>
    can_create_topic?: boolean
    per_page?: number
  }
}

// ---------------------------------------------------------------------------
// Posts and topics

export interface Reaction {
  id: string
  type: string
  count: number
}

export interface ReactionUser extends BasicUser {
  reaction: string
}

export interface ReactionUsersResponse {
  users: ReactionUser[]
  total_rows: number
}

export interface ActionSummary {
  id: number
  count?: number
  acted?: boolean
  can_act?: boolean
  can_undo?: boolean
  hidden?: boolean
}

export interface Reward {
  id: number
  user_id: number
  username: string
  avatar_template: string
  amount: number
  note: string | null
  created_at: string
  is_system_reward?: boolean
  is_deduct?: boolean
}

export interface PollOption {
  id: string
  html: string
  votes?: number
}

export interface Poll {
  id?: number
  name: string
  type: 'regular' | 'multiple' | 'number' | 'ranked_choice' | string
  status: 'open' | 'closed'
  public?: boolean
  results: 'always' | 'on_vote' | 'on_close' | 'staff_only' | string
  min?: number
  max?: number
  step?: number
  options: PollOption[]
  voters: number
  close?: string | null
  title?: string | null
  chart_type?: string
  preloaded_voters?: Record<string, BasicUser[]>
}

export interface LotteryParticipant {
  username: string
  avatar_template: string
  tickets: number
  is_random: boolean
}

export interface Lottery {
  id: number
  title: string
  user_id: number
  post_id: number
  min_participants: number
  /** 1,000,000 means unlimited. */
  max_participants: number
  max_tickets_per_user: number
  min_tickets_per_user: number
  min_trust_level: number
  draw_at: string
  status: 'open' | 'drawn' | 'closed'
  levels: Array<{ id: number; name: string; prize: string; quantity: number }>
  tickets_count: number
  participants_count: number
  user_tickets: number
  is_participating: boolean
  can_draw: boolean | null
  can_manage: boolean | null
  can_close: boolean
  participants: LotteryParticipant[]
  winners?: Array<{ username: string; avatar_template: string; level_name: string; prize: string }>
}

export interface RedEnvelope {
  id: number
  topic_id: number
  user_id: number
  total_points: number
  total_count: number
  claimed_count: number
  remaining_points: number
  available_count: number
  exhausted: boolean
  claim_percentage: number
  created_at: string
}

export interface RedEnvelopeClaim {
  id: number
  red_envelope_id: number
  user_id: number
  post_id: number
  points_received: number
  created_at: string
}

export interface Boost {
  id: number
  cooked: string
  user: BasicUser
  can_delete?: boolean
  can_flag?: boolean
}

export interface Post extends FlairFields {
  id: number
  name?: string | null
  username: string
  avatar_template: string
  animated_avatar?: string | null
  created_at: string
  updated_at: string
  cooked: string
  post_number: number
  post_type: number
  reply_count: number
  reply_to_post_number: number | null
  reply_to_user?: { username: string; name?: string | null; avatar_template: string }
  reads?: number
  score?: number
  yours: boolean
  topic_id: number
  topic_slug?: string
  display_username?: string
  primary_group_name?: string | null
  version: number
  can_edit: boolean
  can_delete: boolean
  can_recover?: boolean
  read?: boolean
  user_title?: string | null
  title_is_group?: boolean
  bookmarked: boolean
  bookmark_id?: number
  actions_summary: ActionSummary[]
  moderator: boolean
  admin: boolean
  staff: boolean
  group_moderator?: boolean
  user_id: number
  hidden: boolean
  trust_level: number
  deleted_at: string | null
  user_deleted: boolean
  edit_reason?: string | null
  can_view_edit_history?: boolean
  wiki: boolean
  post_url: string
  user_signature?: string | null

  // discourse-reactions
  reactions?: Reaction[]
  current_user_reaction?: { id: string; type: string; can_undo: boolean } | null
  reaction_users_count?: number
  current_user_used_main_reaction?: boolean

  // discourse-vote
  vote_score?: number
  vote_count?: number
  vote_direction?: VoteDirection
  can_vote_up?: boolean
  can_vote_down?: boolean

  // NodeLoc plugins
  rewards?: Reward[]
  lottery?: Lottery | null
  polls?: Poll[]
  polls_votes?: Record<string, string[]>
  red_envelope_claim?: RedEnvelopeClaim | null
  notice?: { type: string; points_received?: number } | null
  boosts?: Boost[]
  can_boost?: boolean
  read_permission_restricted?: boolean
  user_server_count?: number
  accepted_answer?: boolean

  // Nested replies
  direct_reply_count?: number
  total_descendant_count?: number
  /**
   * A soft-deleted reply kept in the tree. For non-staff the post is cut down
   * to `id`, `post_number`, `reply_to_post_number`, empty `cooked`, and the
   * reply counts; author fields are absent.
   */
  deleted_post_placeholder?: boolean
  /** A reply from a user the reader ignores; `cooked` is empty. */
  ignored_post_placeholder?: boolean
  children?: Post[]
}

export interface TopicParticipant extends BasicUser, FlairFields {
  post_count: number
}

export interface TopicDetails {
  can_edit?: boolean
  notification_level?: number
  participants?: TopicParticipant[]
  created_by?: BasicUser
  last_poster?: BasicUser
  can_create_post?: boolean
  can_reply_as_new_topic?: boolean
  can_flag_topic?: boolean
}

export interface TopicView {
  id: number
  title: string
  fancy_title?: string
  slug: string
  posts_count: number
  reply_count: number
  like_count: number
  views: number
  created_at: string
  last_posted_at?: string | null
  category_id: number
  tags?: Array<string | Tag>
  closed: boolean
  archived: boolean
  pinned: boolean
  visible: boolean
  archetype: string
  word_count?: number
  user_id?: number
  image_url?: string | null
  bookmarked?: boolean
  details: TopicDetails
  message_bus_last_id?: number
  highest_post_number?: number | null
  participant_count?: number
  draft_key?: string

  is_featured?: boolean
  red_envelope?: RedEnvelope | null
  repost_count?: number
  pinned_post_ids?: number[]
  locked_post_ids?: number[]
  collapsed_post_numbers?: number[]
  valid_reactions?: string[]
  read_permission_trust_level?: number
  has_read_permission_restriction?: boolean
  can_read_topic?: boolean
}

export interface TopicResponse extends TopicView {
  post_stream: { posts: Post[]; stream: number[] }
  suggested_topics?: TopicListItem[]
  related_topics?: TopicListItem[]
}

export type NestedSort = 'top' | 'hot' | 'new' | 'old'

export interface NestedTopicResponse {
  roots: Post[]
  /** Sent as a boolean or as 0/1. */
  has_more_roots: boolean | number
  page: number
  topic?: TopicView
  op_post?: Post
  sort?: NestedSort
  effective_sort?: NestedSort
  message_bus_last_id?: number
  pinned_post_ids?: number[]
  suggested_topics?: TopicListItem[]
  related_topics?: TopicListItem[]
}

export interface NestedChildrenResponse {
  children: Post[]
  has_more: boolean | number
  page: number
}

export interface NestedContextResponse {
  topic: TopicView
  op_post: Post
  ancestor_chain: Post[]
  ancestors_truncated: boolean
  target_post: Post
  effective_sort?: NestedSort
  message_bus_last_id?: number
  related_topics?: TopicListItem[]
}

// ---------------------------------------------------------------------------
// Site

export interface PostActionType {
  id: number
  name: string
  name_key: string
  description: string
  short_description: string
  is_flag: boolean
  enabled?: boolean
  require_message?: boolean
  applies_to?: string[]
}

export interface DirectoryApp {
  id?: number
  slug: string
  name: string
  description?: string | null
  logo_url?: string | null
  installs_count?: number
  surface?: 'blocks' | 'webview' | 'service' | string
  home_url?: string | null
  kind?: string
  author?: { username: string; avatar_template?: string } | null
}

export interface SiteResponse {
  categories: Category[]
  min_topic_title_length?: number
  min_post_length?: number
  max_post_length?: number
  notification_types: Record<string, number>
  post_action_types: PostActionType[]
  topic_flag_types?: PostActionType[]
  trust_levels: Record<string, number>
  top_tags?: Array<string | Tag>
  top_menu_items?: string[]
  community_tag_styles?: Record<string, { icon?: string; color?: string; text_color?: string }>
  vote_upvote_reactions?: string[]
  vote_downvote_reactions?: string[]
  vote_collapse_score_threshold?: number
  popular_apps?: DirectoryApp[]
  apps_browse_url?: string
  can_create_tag?: boolean
  can_tag_topics?: boolean
}

export interface MobileMetaResponse {
  api_version: number
  features: Partial<Record<'checkin' | 'upgrade_progress' | 'points' | 'lottery' | 'red_envelope' | 'apps' | 'chat' | 'post_source' | 'releases' | 'push', boolean>>
}

// ---------------------------------------------------------------------------
// Search

export interface SearchPost {
  id: number
  name?: string | null
  username: string
  avatar_template: string
  created_at: string
  like_count: number
  blurb: string
  post_number: number
  topic_id: number
}

export interface SearchResponse {
  posts: SearchPost[]
  topics: TopicListItem[]
  users: BasicUser[]
  categories: Category[]
  tags: Array<Tag | { id?: number; name: string }>
  grouped_search_result: {
    term: string
    more_posts: boolean | null
    more_users: boolean | null
    more_categories: boolean | null
    more_full_page_results: boolean | null
    error?: string | null
  }
}

export interface TagsResponse {
  tags: Array<{ id: number | string; text: string; name: string; count: number; description?: string | null }>
}

// ---------------------------------------------------------------------------
// Media

export interface AnyVideo {
  id: number
  status: 'pending' | 'processing' | 'ready' | 'failed'
  thumbnail_url: string | null
  duration_seconds: number | null
  width: number | null
  height: number | null
  error_message?: string | null
  source_url: string | null
  hls_url?: string | null
}
