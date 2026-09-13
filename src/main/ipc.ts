import {
  BrowserWindow,
  app,
  clipboard,
  ipcMain,
  nativeTheme,
  shell,
  webContents,
  type IpcMainInvokeEvent
} from 'electron'
import type { ApiRequest, UploadRequest } from '@shared/api'
import {
  IpcChannel,
  type AppInfo,
  type AppPreferences,
  type DesktopAppLaunchRequest,
  type EmbeddedAppBounds,
  type EmbeddedAppMountRequest,
  type NotificationSettings,
  type UpdateState
} from '@shared/bridge'
import { SITE_ORIGIN } from '@shared/site'
import type { DiscourseClient } from './api/client'
import { isAuthCallback, type AuthService } from './auth/auth-service'
import type { CacheStore } from './cache-store'
import type { InAppBrowser } from './browser-window'
import { isPackagedBuild } from './environment'
import type { MessageBusClient } from './realtime/message-bus'
import type { NotificationService } from './realtime/notification-service'
import { isLanguagePreference, isThemeSource, type SettingsStore } from './settings'
import { strings } from './strings'
import type { UpdateService } from './update-service'

export interface IpcDependencies {
  client: DiscourseClient
  auth: AuthService
  cache: CacheStore
  bus: MessageBusClient
  notifications: NotificationService
  settings: SettingsStore
  browser: InAppBrowser
  getMainWindow: () => BrowserWindow | null
  /** Whether a frame URL belongs to our own renderer. */
  isAppUrl: (url: string) => boolean
  /** Opens a validated in-app route in a secondary app window. */
  openWindow: (route: string) => boolean
  onLanguageChanged: () => void
  updates: UpdateService
}

export function registerIpc({
  client,
  auth,
  cache,
  bus,
  notifications,
  settings,
  browser,
  getMainWindow,
  isAppUrl,
  openWindow,
  onLanguageChanged,
  updates
}: IpcDependencies): void {
  const handle = (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void => {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      // Only our own pages get the bridge; a navigated-away or embedded frame is refused.
      if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame || !isAppUrl(event.senderFrame.url)) {
        throw new Error(`Refused IPC "${channel}" from untrusted frame`)
      }
      return handler(event, ...args)
    })
  }

  handle(IpcChannel.apiRequest, (_event, request) => {
    if (!isApiRequest(request)) return { ok: false, error: { kind: 'invalidRequest' } }
    return client.request(request)
  })

  handle(IpcChannel.apiUpload, (_event, request) => {
    if (!isUploadRequest(request)) return { ok: false, error: { kind: 'invalidRequest' } }
    return client.upload(request)
  })

  handle(IpcChannel.authGetState, () => auth.state())
  handle(IpcChannel.authStart, () => auth.start())
  handle(IpcChannel.authReopen, () => auth.reopenBrowser())
  handle(IpcChannel.authCancel, () => auth.cancel())
  handle(IpcChannel.authComplete, (_event, url) => {
    if (typeof url !== 'string' || !isAuthCallback(url.trim())) return { ok: false, reason: 'invalidCallback' }
    return auth.handleCallback(url.trim())
  })
  handle(IpcChannel.authSignOut, () => auth.signOut())

  registerRealtime(handle, bus)

  handle(IpcChannel.notificationsCounts, () => notifications.getCounts())
  handle(IpcChannel.notificationsGetSettings, () => settings.get().notifications)
  handle(IpcChannel.notificationsUpdateSettings, (_event, patch) => {
    if (typeof patch !== 'object' || patch === null) return settings.get().notifications
    return settings.updateNotifications(patch as Partial<NotificationSettings>)
  })

  handle(IpcChannel.cacheRead, (_event, key) => (typeof key === 'string' ? cache.read(key) : null))
  handle(IpcChannel.cacheWrite, (_event, key, value) =>
    typeof key === 'string' && typeof value === 'string' ? cache.write(key, value) : false
  )

  handle(IpcChannel.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    isPackaged: isPackagedBuild,
    themeSource: settings.get().themeSource
  }))

  const preferences = (): AppPreferences => ({
    closeToTray: settings.get().closeToTray,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
    language: settings.get().language
  })
  handle(IpcChannel.appGetPreferences, preferences)
  handle(IpcChannel.appUpdatePreferences, (_event, patch) => {
    if (typeof patch !== 'object' || patch === null) return preferences()
    const { closeToTray, launchAtLogin, language } = patch as Partial<AppPreferences>
    if (typeof closeToTray === 'boolean') settings.update({ closeToTray })
    if (isLanguagePreference(language)) {
      settings.update({ language })
      onLanguageChanged()
    }
    // Packaged builds only: a dev build would register the bare Electron binary.
    if (typeof launchAtLogin === 'boolean' && isPackagedBuild) {
      app.setLoginItemSettings({ openAtLogin: launchAtLogin, args: [HIDDEN_START_ARG] })
    }
    return preferences()
  })

  handle(IpcChannel.updateGetState, (): UpdateState => updates.state())
  handle(IpcChannel.updateCheck, () => updates.check())

  handle(IpcChannel.themeSetSource, (_event, source) => {
    if (!isThemeSource(source)) return
    settings.update({ themeSource: source })
    nativeTheme.themeSource = source
  })

  handle(IpcChannel.openExternal, (_event, url) => typeof url === 'string' && openExternalSafely(url))

  handle(IpcChannel.saveFile, (_event, url) => {
    const window = getMainWindow()
    if (typeof url !== 'string' || !window || !isHttpUrl(url)) return false
    // No save path set, so Electron asks where to save.
    window.webContents.downloadURL(url)
    return true
  })

  handle(IpcChannel.copyText, (_event, text) => {
    if (typeof text === 'string') clipboard.writeText(text)
  })

  handle(IpcChannel.browserOpen, (_event, url) => typeof url === 'string' && browser.open(url))

  handle(IpcChannel.appsOpen, async (_event, request) => {
    if (!isDesktopAppLaunchRequest(request)) return false
    const homeUrl = request.homeUrl ? normalizeSiteUrl(request.homeUrl) : undefined
    if (request.homeUrl && !homeUrl) return false

    let installId = request.installId
    if (!installId && request.surface === 'webview' && homeUrl) {
      installId = await findAppInstallId(client, homeUrl)
    }
    const directUrl = installId ? `${SITE_ORIGIN}/apps/installs/${installId}/webview` : homeUrl
    if (!directUrl) return false

    return browser.openApp({
      key: installId ? `install:${installId}` : `home:${new URL(directUrl).pathname}`,
      name: cleanAppName(request.name),
      url: directUrl,
      // Inline embeds do not include their surface. A blocks install returns
      // 404 from /webview and is then loaded at its owning topic instead.
      fallbackUrl: installId && request.surface === undefined ? homeUrl : undefined
    })
  })

  handle(IpcChannel.appsMount, async (event, request) => {
    if (!isEmbeddedAppMountRequest(request)) return false
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) return false
    const homeUrl = request.homeUrl ? normalizeSiteUrl(request.homeUrl) : undefined
    if (request.homeUrl && !homeUrl) return false
    const bounded = appViewBounds(owner, request)
    return browser.mountAppView(owner, {
      viewId: request.viewId,
      installId: request.installId,
      bounds: bounded.bounds,
      visible: request.visible && bounded.visible,
      fallbackUrl: homeUrl
    })
  })

  handle(IpcChannel.appsUpdate, (event, viewId, bounds) => {
    if (!isViewId(viewId) || !isEmbeddedAppBounds(bounds)) return false
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) return false
    const bounded = appViewBounds(owner, bounds)
    return browser.updateAppView(owner, viewId, bounded.bounds, bounds.visible && bounded.visible, bounds.fullscreen === true)
  })

  handle(IpcChannel.appsUnmount, (event, viewId) => {
    if (!isViewId(viewId)) return
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (owner) browser.unmountAppView(owner, viewId)
  })

  handle(IpcChannel.windowOpen, (_event, route) => isAppRoute(route) && openWindow(route))
}

interface AppHomeTopic {
  post_stream?: { posts?: Array<{ post_number?: number; cooked?: string }> }
}

function isDesktopAppLaunchRequest(value: unknown): value is DesktopAppLaunchRequest {
  if (typeof value !== 'object' || value === null) return false
  const request = value as DesktopAppLaunchRequest
  return (
    (request.name === undefined || (typeof request.name === 'string' && request.name.length <= 120)) &&
    (request.homeUrl === undefined || (typeof request.homeUrl === 'string' && request.homeUrl.length <= 2048)) &&
    (request.installId === undefined || (Number.isSafeInteger(request.installId) && request.installId > 0)) &&
    (request.surface === undefined || request.surface === 'blocks' || request.surface === 'webview') &&
    (request.homeUrl !== undefined || request.installId !== undefined)
  )
}

function isViewId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(value)
}

function isEmbeddedAppBounds(value: unknown): value is EmbeddedAppBounds {
  if (typeof value !== 'object' || value === null) return false
  const bounds = value as EmbeddedAppBounds
  return (
    [bounds.x, bounds.y, bounds.width, bounds.height].every((entry) => typeof entry === 'number' && Number.isFinite(entry)) &&
    typeof bounds.visible === 'boolean' &&
    (bounds.fullscreen === undefined || typeof bounds.fullscreen === 'boolean')
  )
}

function isEmbeddedAppMountRequest(value: unknown): value is EmbeddedAppMountRequest {
  if (!isEmbeddedAppBounds(value)) return false
  const request = value as EmbeddedAppMountRequest
  return (
    isViewId(request.viewId) &&
    Number.isSafeInteger(request.installId) &&
    request.installId > 0 &&
    (request.homeUrl === undefined || (typeof request.homeUrl === 'string' && request.homeUrl.length <= 2048))
  )
}

function appViewBounds(owner: BrowserWindow, value: EmbeddedAppBounds): { bounds: Electron.Rectangle; visible: boolean } {
  const content = owner.getContentBounds()
  const x = Math.max(0, Math.round(value.x))
  const y = Math.max(0, Math.round(value.y))
  const width = Math.max(1, Math.min(Math.round(value.width), content.width - x))
  const height = Math.max(1, Math.min(Math.round(value.height), content.height - y))
  return { bounds: { x, y, width, height }, visible: x < content.width && y < content.height && width > 1 && height > 1 }
}

function normalizeSiteUrl(value: string): string | undefined {
  try {
    const url = new URL(value, SITE_ORIGIN)
    if (url.origin !== SITE_ORIGIN || !url.pathname.startsWith('/t/')) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

function cleanAppName(value: string | undefined): string {
  const name = value?.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return name || strings.miniApp
}

async function findAppInstallId(client: DiscourseClient, homeUrl: string): Promise<number | undefined> {
  const home = new URL(homeUrl)
  const parts = home.pathname.split('/').filter(Boolean)
  if (parts[0] !== 't') return undefined

  const idIndex = parts.findIndex((part, index) => index > 0 && /^\d+$/.test(part))
  if (idIndex < 0) return undefined
  const topicId = Number(parts[idIndex])
  const postNumber = /^\d+$/.test(parts[idIndex + 1] ?? '') ? Number(parts[idIndex + 1]) : 1
  const response = await client.request<AppHomeTopic>({ path: `/t/${topicId}.json`, priority: 'user' })
  if (!response.ok) return undefined

  const posts = response.data.post_stream?.posts ?? []
  const post = posts.find((entry) => entry.post_number === postNumber) ?? posts[0]
  const match = post?.cooked?.match(/\bdata-app-install=["'](\d+)["']/i)
  const installId = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(installId) && installId > 0 ? installId : undefined
}

/** An in-app router path such as `/t/123` or `/search?q=vps`: never a URL or protocol-relative path. */
function isAppRoute(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    value.length <= 2048 &&
    // eslint-disable-next-line no-control-regex
    !/[\s\\\u0000-\u001f\u007f]/.test(value)
  )
}

type Handle = (channel: string, handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => void

/**
 * MessageBus subscriptions per window. Each window's channels are counted so
 * two views watching one channel share it, and a closed window releases
 * everything it held.
 */
function registerRealtime(handle: Handle, bus: MessageBusClient): void {
  const byWindow = new Map<number, Map<string, number>>()

  const release = (senderId: number, channel: string): void => {
    const channels = byWindow.get(senderId)
    const count = channels?.get(channel)
    if (!channels || !count) return
    if (count > 1) channels.set(channel, count - 1)
    else channels.delete(channel)
    bus.unsubscribe(channel)
  }

  handle(IpcChannel.realtimeSubscribe, (event, channel, lastId) => {
    if (!isChannel(channel)) return
    let channels = byWindow.get(event.sender.id)
    if (!channels) {
      channels = new Map()
      byWindow.set(event.sender.id, channels)
      const senderId = event.sender.id
      event.sender.once('destroyed', () => {
        for (const [held, count] of byWindow.get(senderId) ?? []) {
          for (let i = 0; i < count; i++) bus.unsubscribe(held)
        }
        byWindow.delete(senderId)
      })
    }
    channels.set(channel, (channels.get(channel) ?? 0) + 1)
    bus.subscribe(channel, typeof lastId === 'number' && Number.isInteger(lastId) ? lastId : -1)
  })

  handle(IpcChannel.realtimeUnsubscribe, (event, channel) => {
    if (isChannel(channel)) release(event.sender.id, channel)
  })

  bus.on('message', (message) => {
    for (const [senderId, channels] of byWindow) {
      if (!channels.has(message.channel)) continue
      webContents.fromId(senderId)?.send(IpcChannel.realtimeMessage, {
        channel: message.channel,
        messageId: message.message_id,
        data: message.data
      })
    }
  })
}

function isChannel(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 200 && !/\s/.test(value)
}

/** Passed by the login item so an automatic start stays in the tray. */
export const HIDDEN_START_ARG = '--hidden'

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function openExternalSafely(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false
  void shell.openExternal(parsed.toString())
  return true
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

function isApiRequest(value: unknown): value is ApiRequest {
  return typeof value === 'object' && value !== null && typeof (value as ApiRequest).path === 'string'
}

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

function isUploadRequest(value: unknown): value is UploadRequest {
  if (typeof value !== 'object' || value === null) return false
  const request = value as UploadRequest
  return (
    typeof request.fileName === 'string' &&
    typeof request.mimeType === 'string' &&
    typeof request.uploadType === 'string' &&
    request.data instanceof ArrayBuffer &&
    request.data.byteLength > 0 &&
    request.data.byteLength <= MAX_UPLOAD_BYTES
  )
}
