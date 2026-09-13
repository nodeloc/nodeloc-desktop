import type { BasicUser, DirectoryApp } from '../../api/types'

/** `DiscourseApps::App::KINDS`. */
export const APP_KINDS = ['game', 'applet', 'bot'] as const
export type AppKind = (typeof APP_KINDS)[number]

export function isAppKind(value: unknown): value is AppKind {
  return typeof value === 'string' && (APP_KINDS as readonly string[]).includes(value)
}

/** `DirectoryAppSerializer` (plugins/discourse-apps). Optional keys are omitted when blank. */
export interface AppDetail extends DirectoryApp {
  id: number
  kind?: AppKind | string
  surface?: 'blocks' | 'webview' | 'service' | string
  approved_scopes?: string[] | null
  version_number?: number | null
  /** The published version's readme, cooked server-side like a post. */
  readme_cooked?: string
  updated_at?: string
  /** The app's own category, where it's discussed. */
  category_url?: string
  /** A topic post URL where the app runs (`/t/slug/123/4`). */
  home_url?: string
  is_service?: boolean
  /** 4, 9, 12 or 17. */
  age_rating?: number | null
  content_descriptors?: string[] | null
  author?: BasicUser | null
}

/** `GET /apps/directory.json?kind=&page=` — pages are 0-based, 24 per page. */
export interface AppsDirectoryPage {
  apps: AppDetail[]
  total: number
  page: number
  per_page: number
  kind?: AppKind | null
  /** Published apps per kind, counted before `kind` narrows the list. */
  counts?: Partial<Record<AppKind, number>>
}

/** `GET /apps/{slug}.json` */
export interface AppDetailResponse {
  directory_app: AppDetail
}
