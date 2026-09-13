import { app, BrowserWindow, nativeTheme, powerMonitor, session, type Tray, type WebPreferences } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { IpcChannel } from '@shared/bridge'
import { SESSION_PARTITION, SITE_ORIGIN } from '@shared/site'
import appIconPng from '../../resources/icon.png?asset'
import trayIcon from '../../resources/tray.png?asset'
import { DiscourseClient } from './api/client'
import { RequestScheduler } from './api/scheduler'
import { AuthService, isAuthCallback } from './auth/auth-service'
import { CredentialStore } from './auth/credential-store'
import { CacheStore } from './cache-store'
import { InAppBrowser } from './browser-window'
import { findDeepLink, registerProtocolClient } from './deep-link'
import { HIDDEN_START_ARG, openExternalSafely, registerIpc } from './ipc'
import { MessageBusClient } from './realtime/message-bus'
import { NotificationService } from './realtime/notification-service'
import { SettingsStore } from './settings'
import { UpdateService } from './update-service'
import { setMainLanguage } from './strings'
import { configureMediaEmbeds } from './media-embeds'
import { isDevelopment } from './environment'
import { createTray, updateTrayLanguage, type TrayActions } from './tray'
import { loadWindowState, trackWindowState } from './window-state'

const TITLE_BAR_HEIGHT = 36
/** Runtime windows use the source PNG; electron-builder bakes the multi-resolution ICO into the Windows executable. */
const appIcon = appIconPng

/** Matches `--bg` / `--header-text` in the renderer's tokens. */
const CHROME_COLORS = {
  light: { background: '#FFFFFF', symbol: '#333333' },
  dark: { background: '#0B0F0E', symbol: '#F1F4F2' }
} as const

const rendererDevUrl = isDevelopment ? process.env['ELECTRON_RENDERER_URL'] : undefined
const rendererIndex = join(__dirname, '../renderer/index.html')

let mainWindow: BrowserWindow | null = null
/** Pop-out windows opened through `window:open`. */
const secondaryWindows = new Set<BrowserWindow>()
let tray: Tray | null = null
let auth: AuthService | null = null
let isQuitting = false
let pendingDeepLink = findDeepLink(process.argv)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  bootstrap()
}

function bootstrap(): void {
  // Required for toast notifications and taskbar grouping on Windows.
  app.setAppUserModelId('com.nodeloc.desktop')
  if (isDevelopment) {
    // Development only: keep painting when the window is covered, so automated
    // screenshots over the remote debugging port don't stall.
    app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  }
  registerProtocolClient()

  app.on('second-instance', (_event, argv) => {
    showMainWindow()
    const link = findDeepLink(argv)
    if (link) dispatchDeepLink(link)
  })

  app.on('before-quit', () => {
    isQuitting = true
    // Otherwise the icon lingers in the notification area until hovered.
    tray?.destroy()
    tray = null
  })

  app.on('web-contents-created', (_event, contents) => {
    // Embedded pages will use WebContentsView; the <webview> tag stays off.
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  void app.whenReady().then(() => {
    configureMediaEmbeds(session.defaultSession, isAppUrl)
    const settings = new SettingsStore()
    nativeTheme.themeSource = settings.get().themeSource
    setMainLanguage(settings.get().language, app.getLocale())
    const trayActions: TrayActions = { show: showMainWindow, quit: () => app.quit() }

    const scheduler = new RequestScheduler({ maxConcurrent: 6, perMinute: 50 })
    const client: DiscourseClient = new DiscourseClient({
      origin: SITE_ORIGIN,
      partition: SESSION_PARTITION,
      scheduler,
      getCredentials: () => auth?.getCredentials() ?? null,
      onLoggedOut: () => auth?.markExpired()
    })

    const bus = new MessageBusClient(client)
    const notifications = new NotificationService({
      client,
      bus,
      settings,
      origin: SITE_ORIGIN,
      appIcon,
      getWindow: () => mainWindow,
      getTray: () => tray,
      openUrl: (url) => {
        showMainWindow()
        mainWindow?.webContents.send(IpcChannel.deepLink, url)
      }
    })
    notifications.on('counts', (counts) => sendToAppWindows(IpcChannel.notificationCounts, counts))

    const credentialStore = new CredentialStore()
    const signedInAuth = new AuthService(credentialStore, SITE_ORIGIN, SESSION_PARTITION, () => client)
    auth = signedInAuth
    signedInAuth.on('changed', (state) => {
      sendToAppWindows(IpcChannel.authChanged, state)
      if (state.status === 'signedIn') void notifications.start()
      else if (state.status !== 'pending') notifications.stop()
    })

    restrictPermissions()
    const browser = new InAppBrowser({
      appIcon,
      origin: SITE_ORIGIN,
      createOneTimePassword: () => signedInAuth.createOneTimePassword()
    })
    const cache = new CacheStore()
    const updates = new UpdateService(app.getVersion(), credentialStore.clientId())
    updates.on('state', (state) => sendToAppWindows(IpcChannel.updateState, state))
    let cacheOwner = signedInAuth.state().username
    signedInAuth.on('changed', (state) => {
      // Snapshots belong to one account: drop them on sign-out or when another account signs in.
      if (state.status === 'signedOut' || (state.status === 'signedIn' && state.username !== cacheOwner)) {
        void cache.clear()
      }
      if (state.status !== 'pending') cacheOwner = state.username
    })
    registerIpc({
      client,
      auth: signedInAuth,
      cache,
      bus,
      notifications,
      settings,
      browser,
      getMainWindow: () => mainWindow,
      isAppUrl,
      onLanguageChanged: () => {
        setMainLanguage(settings.get().language, app.getLocale())
        if (tray) updateTrayLanguage(tray, trayActions)
      },
      updates,
      openWindow: (route) => {
        createSecondaryWindow(route)
        return true
      }
    })

    mainWindow = createMainWindow(settings)
    tray = createTray(trayIcon, trayActions)

    // Match the mobile release flow: every launch checks quietly; a newer
    // verified Windows build downloads, installs, and reopens automatically.
    void updates.check()

    nativeTheme.on('updated', applyChromeColors)
    // Long polls die silently across sleep; start over when the system wakes.
    powerMonitor.on('resume', () => bus.reconnect())

    void signedInAuth.verifyStoredKey()
    if (signedInAuth.state().status === 'signedIn') void notifications.start()
  })
}

function createMainWindow(settings: SettingsStore): BrowserWindow {
  const state = loadWindowState()
  const colors = chromeColors()

  const window = new BrowserWindow({
    ...state.bounds,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'NodeLoc',
    icon: appIcon,
    backgroundColor: colors.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: colors.background, symbolColor: colors.symbol, height: TITLE_BAR_HEIGHT },
    webPreferences: appWebPreferences()
  })
  // Explicitly set the runtime icon as well: development runs through
  // electron.exe, whose embedded fallback is Electron's atom logo.
  window.setIcon(appIcon)

  trackWindowState(window)

  window.once('ready-to-show', () => {
    // Started by the login item: stay in the tray until opened.
    if (process.argv.includes(HIDDEN_START_ARG)) return
    if (state.maximized) window.maximize()
    window.show()
  })

  window.on('close', (event) => {
    if (!isQuitting && settings.get().closeToTray) {
      event.preventDefault()
      window.hide()
    }
  })

  window.on('closed', () => {
    mainWindow = null
    // Closing the main window (not to the tray) ends the app, pop-outs included.
    for (const secondary of secondaryWindows) secondary.close()
  })

  guardNavigation(window)

  window.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) dispatchDeepLink(pendingDeepLink)
  })

  loadRenderer(window)

  return window
}

/** Same isolation as the main window: the typed bridge, nothing else. */
function appWebPreferences(): WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    spellcheck: true
  }
}

/** App windows never navigate away from the renderer or open child windows. */
function guardNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    openExternalSafely(url)
  })
}

/** Loads the renderer; `route` (pop-out windows) becomes `?route=` for the memory router. */
function loadRenderer(window: BrowserWindow, route?: string): void {
  if (rendererDevUrl) {
    const url = new URL(rendererDevUrl)
    if (route) url.searchParams.set('route', route)
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(rendererIndex, route ? { query: { route } } : undefined)
  }
}

/**
 * A pop-out window (WIN-*, DESK-09): the same renderer in its compact shell,
 * starting at `route`. Realtime subscriptions are counted per web contents in
 * ipc.ts, so each pop-out holds and releases its own.
 */
function createSecondaryWindow(route: string): BrowserWindow {
  const colors = chromeColors()
  const anchor = BrowserWindow.getFocusedWindow() ?? mainWindow
  const bounds = anchor && !anchor.isDestroyed() ? anchor.getBounds() : undefined
  const width = 960
  const height = bounds ? Math.min(Math.max(bounds.height, 600), 900) : 820

  const window = new BrowserWindow({
    width,
    height,
    ...(bounds ? { x: bounds.x + 36, y: bounds.y + 36 } : {}),
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: 'NodeLoc',
    icon: appIcon,
    backgroundColor: colors.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: colors.background, symbolColor: colors.symbol, height: TITLE_BAR_HEIGHT },
    webPreferences: appWebPreferences()
  })
  window.setIcon(appIcon)

  secondaryWindows.add(window)
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => secondaryWindows.delete(window))
  guardNavigation(window)
  loadRenderer(window, route)
  return window
}

/** Account and unread changes go to every app window; deep links stay with the main window. */
function sendToAppWindows(channel: string, ...args: unknown[]): void {
  for (const window of [mainWindow, ...secondaryWindows]) {
    if (window && !window.isDestroyed()) window.webContents.send(channel, ...args)
  }
}

function showMainWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/**
 * Handles a `nodeloc://` link: the sign-in callback goes to the auth
 * service; anything else is delivered to the renderer once it has loaded.
 */
function dispatchDeepLink(url: string): void {
  if (isAuthCallback(url) && auth) {
    pendingDeepLink = undefined
    void auth.handleCallback(url).then((result) => {
      if (!result.ok) mainWindow?.webContents.send(IpcChannel.authError, result.reason)
    })
    return
  }
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(IpcChannel.deepLink, url)
    pendingDeepLink = undefined
  } else {
    pendingDeepLink = url
  }
}

/**
 * Whether a frame URL is our renderer page, in any window. Compares origin
 * (dev server) or the index file path, so `?route=` pop-outs and hashes pass
 * while look-alike prefixes (another port, a sibling file) don't.
 */
function isAppUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (rendererDevUrl) return parsed.origin === new URL(rendererDevUrl).origin
  const index = pathToFileURL(rendererIndex)
  return parsed.protocol === 'file:' && decodeURIComponent(parsed.pathname).toLowerCase() === decodeURIComponent(index.pathname).toLowerCase()
}

function chromeColors(): { background: string; symbol: string } {
  return nativeTheme.shouldUseDarkColors ? CHROME_COLORS.dark : CHROME_COLORS.light
}

function applyChromeColors(): void {
  const colors = chromeColors()
  for (const window of [mainWindow, ...secondaryWindows]) {
    if (!window || window.isDestroyed()) continue
    window.setBackgroundColor(colors.background)
    window.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbol, height: TITLE_BAR_HEIGHT })
  }
}

/** Grants only what the app uses; everything else (camera, geolocation, …) is denied. */
function restrictPermissions(): void {
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen'])
  for (const target of [session.defaultSession, session.fromPartition(SESSION_PARTITION)]) {
    target.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(allowed.has(permission))
    })
  }
}
