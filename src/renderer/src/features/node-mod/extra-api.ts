import type { UploadResult, UploadType } from '@shared/api'
import { ApiException, apiRequest } from '../../api/client'
import type { ApiRequest } from '@shared/api'
import type { BasicUser, UploadRef } from '../../api/types'
import { nodeModKey } from './use-mod-tools'

/**
 * Requests for the configuration sections of a node's mod tools
 * (plugins/discourse-community, plus discourse-apps for node apps).
 * A 200 carrying `success: false` is a failure too.
 */
export async function modRequest<T>(request: ApiRequest): Promise<T> {
  const data = await apiRequest<T>({ priority: 'user', ...request })
  if (data && typeof data === 'object' && (data as { success?: unknown }).success === false) {
    const body = data as { message?: string; error?: string; errors?: string[] }
    throw new ApiException({
      kind: 'unprocessable',
      serverMessage: body.message ?? body.error ?? body.errors?.join(' ') ?? undefined
    })
  }
  return data
}

/**
 * Uploads a picture chosen from disk. Pass the upload type the web mod tools
 * use, so the server sizes it the same way: `category_logo` for logos,
 * `category_background` for banners, `avatar` for link images.
 */
export async function uploadImage(file: File, uploadType: UploadType = 'composer'): Promise<UploadResult> {
  const result = await window.nodeloc.api.upload({
    fileName: file.name || 'image',
    mimeType: file.type || 'application/octet-stream',
    data: await file.arrayBuffer(),
    uploadType
  })
  if (!result.ok) throw new ApiException(result.error)
  return result.data
}

/** Section lists live under `nodeModKey`, so a mod tools refresh reaches them too. */
export const extraKeys = {
  ads: (id: number) => [...nodeModKey(id), 'ads'] as const,
  tagGroups: (id: number) => [...nodeModKey(id), 'tag-groups'] as const,
  flair: (id: number) => [...nodeModKey(id), 'flair'] as const,
  flairUsersAll: (id: number) => [...nodeModKey(id), 'flair-users'] as const,
  flairUsers: (id: number, filter: string) => [...nodeModKey(id), 'flair-users', filter] as const,
  channels: (id: number) => [...nodeModKey(id), 'channels'] as const,
  invites: (id: number) => [...nodeModKey(id), 'invites'] as const,
  apps: (id: number) => [...nodeModKey(id), 'apps'] as const,
  appActivity: (id: number, installId: number) => [...nodeModKey(id), 'apps', 'activity', installId] as const
}

// ---------------------------------------------------------------------------
// Settings (PUT /node/edit/:id, CategorySerializer with include_permissions)

export interface GroupPermission {
  permission_type: number
  group_name: string
  group_id: number
}

export interface RequiredTagGroup {
  name: string
  min_count?: number
}

/** The CategorySerializer fields the settings and tags sections read. */
export interface EditableCategory {
  id: number
  slug: string
  color?: string
  uploaded_logo?: UploadRef | null
  uploaded_logo_dark?: UploadRef | null
  uploaded_background?: UploadRef | null
  uploaded_background_dark?: UploadRef | null
  group_permissions?: GroupPermission[]
  topic_template?: string | null
  topic_title_placeholder?: string | null
  default_slow_mode_seconds?: number | null
  auto_close_hours?: number | string | null
  allow_badges?: boolean
  minimum_required_tags?: number | null
  required_tag_groups?: RequiredTagGroup[] | null
}

export interface PendingTransfer {
  user: BasicUser
  requested_at: string
  expires_at?: string
}

export function saveNodeSettings(categoryId: number, body: Record<string, unknown>): Promise<{ category: EditableCategory }> {
  return modRequest({ method: 'PUT', path: `/node/edit/${categoryId}.json`, json: body })
}

// ---------------------------------------------------------------------------
// Links (community_ads)

export interface NodeAd {
  id: string
  title: string
  description?: string | null
  url: string
  image_url?: string | null
  upload_id?: number | null
  created_at?: string
  updated_at?: string
}

export interface AdsResponse {
  ads: NodeAd[]
  max_ads: number
  can_add_more?: boolean
}

// ---------------------------------------------------------------------------
// Tags

export interface NodeTagGroup {
  id: number
  name: string
  tags: Array<{ id: number; name: string; slug?: string }>
}

export interface TagGroupsResponse {
  tag_groups: NodeTagGroup[]
  choices: Array<{ id: number; name: string }>
}

export interface TagStyle {
  icon?: string
  color?: string
  text_color?: string
}

export interface TagStyleResponse {
  tag: string
  style: TagStyle
  removed: boolean
}

// ---------------------------------------------------------------------------
// Flair

export interface FlairTemplate {
  template_id: number
  text: string
  emoji?: string | null
  background_color: string
  text_color: 'dark' | 'light' | string
  mod_only?: boolean
}

export interface FlairIndexResponse {
  templates: FlairTemplate[]
  self_serve: boolean
  can_manage: boolean
}

export interface FlairWearer {
  user: BasicUser
  flairs: FlairTemplate[]
}

export interface FlairUsersResponse {
  users: FlairWearer[]
  total: number
}

/** FlairsController::PAGE */
export const FLAIR_PAGE = 50

// ---------------------------------------------------------------------------
// Verification (Verifications.state_for)

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn'

export interface VerificationState {
  available: boolean
  official: boolean
  status?: VerificationStatus | string | null
  manual: boolean
  can_manage: boolean
  note?: string | null
  moderation_reason?: string | null
  ends_at?: string | null
  days_remaining?: number | null
  expiring: boolean
  warning_days?: number
  merchant?: { name: string; ends_at: string } | null
  can_apply: boolean
  renew_url: string
}

// ---------------------------------------------------------------------------
// Channels

export const CHANNEL_KINDS = ['youtube', 'telegram', 'rss', 'bilibili', 'webhook'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]
export type ChannelState = 'live' | 'pending' | 'polling' | 'expired' | 'disabled'

export interface ChannelItem {
  id: number
  title: string
  status: 'published' | 'queued' | 'skipped' | 'failed' | string
  source_url?: string | null
  topic_url?: string | null
  created_at: string
}

export interface NodeChannel {
  id: number
  kind: ChannelKind | string
  name: string
  enabled: boolean
  state: ChannelState | string
  post_as: 'owner' | 'bot' | string
  review: boolean
  daily_limit: number
  title_prefix?: string | null
  tags?: string[]
  last_synced_at?: string | null
  last_error?: string | null
  items_count: number
  recent: ChannelItem[]
  source_url?: string | null
  lease_expires_at?: string | null
  bot_username?: string | null
  chat_title?: string | null
  bind_code?: string | null
  webhook_url?: string | null
  feed_url?: string | null
}

export interface ChannelsResponse {
  channels: NodeChannel[]
  max: number
  bot_available: boolean
  bilibili_available: boolean
}

// ---------------------------------------------------------------------------
// Invites

export interface NodeInvite {
  id: number
  invite_key: string
  link: string
  invited_by: BasicUser
  max_redemptions_allowed: number
  redemption_count: number
  expires_at: string
  created_at: string
}

export interface InvitesResponse {
  invites: NodeInvite[]
  can_manage: boolean
  invited_count: number
}

// ---------------------------------------------------------------------------
// Node apps (discourse-apps NodeAppsController)

export interface AppSettingField {
  key: string
  type: 'boolean' | 'enum' | 'text' | 'markdown' | 'secret' | 'integer' | 'string' | string
  label?: string
  description?: string
  required?: boolean
  options?: string[]
  default?: unknown
}

export interface AppInstallActivity {
  last_run_at?: string | null
  last_handler?: string | null
  last_outcome?: string | null
  last_error_code?: string | null
  runs_24h: number
  effects_24h: number
  last_fetch_error?: { host: string; code: string; at: string } | null
}

export interface NodeAppInstall {
  id: number
  app_id: number
  active: boolean
  app_name: string
  app_slug?: string
  author_username?: string | null
  settings_schema?: AppSettingField[] | null
  settings?: Record<string, unknown> | null
  activity?: AppInstallActivity
}

export interface InstallableApp {
  id: number
  slug: string
  name: string
  description?: string | null
  settings_schema?: AppSettingField[] | null
}

export interface NodeAppsResponse {
  installs: NodeAppInstall[]
  available: InstallableApp[]
}

export interface AppRunEffect {
  type: string
  key?: string
  url?: string
  amount?: number
  title?: string
  label?: string
  tags?: string
  job_key?: string
  room?: string
  days?: number
  post_id?: number
  topic_id?: number
}

export interface AppRun {
  id: number
  at: string
  handler: string
  event?: string | null
  outcome: string
  error_code?: string | null
  effects: AppRunEffect[]
  error?: string | null
  rejected?: { code: string } | null
  host?: string | null
  status?: number | null
}

/** Stands in for a stored secret; sent back unchanged it means "leave it". */
export const SECRET_SET = '__set__'
