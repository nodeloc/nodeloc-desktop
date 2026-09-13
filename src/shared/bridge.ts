import type { ApiRequest, ApiResult, UploadRequest, UploadResult } from './api'

export type ThemeSource = 'system' | 'light' | 'dark'
export type AppLanguage = 'zh-CN' | 'en'
export type LanguagePreference = 'system' | AppLanguage

export interface AppInfo {
  version: string
  isPackaged: boolean
  themeSource: ThemeSource
}

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'downloading' | 'installing' | 'error' | 'unavailable'

export interface UpdateState {
  status: UpdateStatus
  version?: string
  progress?: number
  error?: 'network' | 'invalidRelease' | 'download' | 'verification' | 'installer'
}

/** A community game/applet opened in its isolated desktop runtime window. */
export interface DesktopAppLaunchRequest {
  name?: string
  /** The topic/post where the app is installed, used for blocks apps and as a fallback. */
  homeUrl?: string
  /** Present when launching an embed directly from cooked post HTML. */
  installId?: number
  surface?: 'blocks' | 'webview'
}

export interface EmbeddedAppBounds {
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  fullscreen?: boolean
}

export interface EmbeddedAppMountRequest extends EmbeddedAppBounds {
  viewId: string
  installId: number
  homeUrl?: string
}

/**
 * - `signedOut`: no key.
 * - `pending`: waiting for the browser to come back with `nodeloc://auth_redirect`.
 * - `signedIn`: a key is stored and was accepted.
 * - `expired`: the stored key was rejected (revoked, expired); sign in again.
 */
export type AuthStatus = 'signedOut' | 'pending' | 'signedIn' | 'expired'

export interface AuthState {
  status: AuthStatus
  username?: string
}

export type AuthCompletion =
  | { ok: true; state: AuthState }
  | { ok: false; reason: 'noPending' | 'invalidCallback' | 'nonceMismatch' | 'rejected' | 'network' }

export type AuthFailureReason = Extract<AuthCompletion, { ok: false }>['reason']

/** A MessageBus message delivered to a window that subscribed to its channel. */
export interface RealtimeMessage {
  channel: string
  messageId: number
  data: unknown
}

/** Unread counts from the account's `/notification/{userId}` channel. */
export interface NotificationCounts {
  unread: number
  unreadHighPriority: number
  allUnread: number
  newPersonalMessages: number
}

export type NotificationCategory = 'replies' | 'likes' | 'messages' | 'chat' | 'rewards' | 'system'

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['replies', 'likes', 'messages', 'chat', 'rewards', 'system']

/** Window and startup behaviour (device-local). */
export interface AppPreferences {
  closeToTray: boolean
  launchAtLogin: boolean
  language: LanguagePreference
}

/** Desktop notification preferences (device-local). */
export interface NotificationSettings {
  enabled: boolean
  sound: boolean
  categories: Record<NotificationCategory, boolean>
}

/** Everything the renderer may ask of the main process. Exposed as `window.nodeloc`. */
export interface NodelocBridge {
  api: {
    request<T = unknown>(request: ApiRequest): Promise<ApiResult<T>>
    upload(request: UploadRequest): Promise<ApiResult<UploadResult>>
  }
  auth: {
    getState(): Promise<AuthState>
    /** Opens the site's authorization page in the system browser. */
    start(): Promise<AuthState>
    reopenBrowser(): Promise<void>
    cancel(): Promise<AuthState>
    /** Finishes sign-in from a pasted `nodeloc://auth_redirect?...` link. */
    completeWithUrl(url: string): Promise<AuthCompletion>
    /** Revokes the key on the server and forgets it locally. */
    signOut(): Promise<AuthState>
  }
  realtime: {
    /** Starts receiving a MessageBus channel in this window. `lastId` -1 = only new messages. */
    subscribe(channel: string, lastId?: number): Promise<void>
    unsubscribe(channel: string): Promise<void>
  }
  notifications: {
    getCounts(): Promise<NotificationCounts | null>
    getSettings(): Promise<NotificationSettings>
    updateSettings(patch: Partial<NotificationSettings>): Promise<NotificationSettings>
  }
  cache: {
    /** Reads a disk snapshot (JSON text) saved with `write`, or null. Keys: [a-z0-9._-]. */
    read(key: string): Promise<string | null>
    write(key: string, value: string): Promise<boolean>
  }
  app: {
    getInfo(): Promise<AppInfo>
    getPreferences(): Promise<AppPreferences>
    updatePreferences(patch: Partial<AppPreferences>): Promise<AppPreferences>
  }
  updates: {
    getState(): Promise<UpdateState>
    /** Checks now; a valid newer release is downloaded and installed automatically. */
    check(): Promise<UpdateState>
  }
  theme: {
    setSource(source: ThemeSource): Promise<void>
  }
  shell: {
    /** Opens http(s) and mailto links in the system; returns false for anything else. */
    openExternal(url: string): Promise<boolean>
    /** Downloads an http(s) file through the save dialog. */
    saveFile(url: string): Promise<boolean>
    copyText(text: string): Promise<void>
  }
  browser: {
    /** Opens an http(s) page in the in-app browser window, logged in with the app session. */
    open(url: string): Promise<boolean>
  }
  apps: {
    /** Runs a community game/applet inside an isolated NodeLoc desktop window. */
    open(request: DesktopAppLaunchRequest): Promise<boolean>
    /** Mounts an isolated app surface over a post's inline placeholder. */
    mount(request: EmbeddedAppMountRequest): Promise<boolean>
    update(viewId: string, bounds: EmbeddedAppBounds): Promise<boolean>
    unmount(viewId: string): Promise<void>
  }
  windows: {
    /**
     * Opens an in-app route (`/t/123`, a path starting with `/`) in a separate,
     * compact app window. Returns false when the route is rejected.
     */
    open(route: string): Promise<boolean>
  }
  events: {
    /** `nodeloc://` links and notification clicks (forum URLs) to route inside the app. */
    onDeepLink(listener: (url: string) => void): () => void
    onAuthChanged(listener: (state: AuthState) => void): () => void
    /** A browser callback arrived but couldn't complete sign-in. */
    onAuthError(listener: (reason: AuthFailureReason) => void): () => void
    onRealtime(listener: (message: RealtimeMessage) => void): () => void
    onNotificationCounts(listener: (counts: NotificationCounts | null) => void): () => void
    onUpdateState(listener: (state: UpdateState) => void): () => void
  }
}

export const IpcChannel = {
  apiRequest: 'api:request',
  apiUpload: 'api:upload',
  authGetState: 'auth:get-state',
  authStart: 'auth:start',
  authReopen: 'auth:reopen',
  authCancel: 'auth:cancel',
  authComplete: 'auth:complete',
  authSignOut: 'auth:sign-out',
  realtimeSubscribe: 'realtime:subscribe',
  realtimeUnsubscribe: 'realtime:unsubscribe',
  notificationsCounts: 'notifications:counts',
  notificationsGetSettings: 'notifications:get-settings',
  notificationsUpdateSettings: 'notifications:update-settings',
  cacheRead: 'cache:read',
  cacheWrite: 'cache:write',
  appInfo: 'app:info',
  appGetPreferences: 'app:get-preferences',
  appUpdatePreferences: 'app:update-preferences',
  updateGetState: 'update:get-state',
  updateCheck: 'update:check',
  themeSetSource: 'theme:set-source',
  openExternal: 'shell:open-external',
  saveFile: 'shell:save-file',
  copyText: 'shell:copy-text',
  browserOpen: 'browser:open',
  appsOpen: 'apps:open',
  appsMount: 'apps:mount',
  appsUpdate: 'apps:update',
  appsUnmount: 'apps:unmount',
  windowOpen: 'window:open',
  deepLink: 'event:deep-link',
  authChanged: 'event:auth-changed',
  authError: 'event:auth-error',
  realtimeMessage: 'event:realtime',
  notificationCounts: 'event:notification-counts',
  updateState: 'event:update-state'
} as const
