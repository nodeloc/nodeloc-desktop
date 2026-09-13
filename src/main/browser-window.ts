import {
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  nativeTheme,
  session,
  webContents,
  type MenuItemConstructorOptions,
  type Rectangle
} from 'electron'
import { SESSION_PARTITION } from '@shared/site'
import { openExternalSafely } from './ipc'
import { strings } from './strings'

const WEB_PROTOCOLS = new Set(['http:', 'https:'])

/** Discourse's auth cookie. */
const AUTH_COOKIE = '_t'

function isWebUrl(value: string): boolean {
  try {
    return WEB_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

export interface InAppBrowserOptions {
  appIcon: string
  origin: string
  /** A one-time password for the signed-in account, or null when there is none. */
  createOneTimePassword: () => Promise<string | null>
}

export interface DesktopAppWindowOptions {
  key: string
  name: string
  url: string
  fallbackUrl?: string
}

interface EmbeddedAppViewOptions {
  viewId: string
  installId: number
  bounds: Rectangle
  visible: boolean
  fallbackUrl?: string
}

/**
 * In-app browser for forum pages without a native screen (and anything else
 * the user opens here). It shares the forum session partition; before the
 * first forum page it signs that session in with a one-time password, so
 * these pages use the app's account. No preload: pages get nothing from the app.
 */
export class InAppBrowser {
  private window: BrowserWindow | null = null
  private readonly appWindows = new Map<string, BrowserWindow>()
  private readonly appFallbacks = new Map<number, { directUrl: string; fallbackUrl: string }>()
  private readonly embeddedApps = new Map<string, { owner: BrowserWindow; view: WebContentsView }>()
  private readonly observedOwners = new Set<number>()
  private sessionSignIn: Promise<void> | null = null
  private signingIn = false

  constructor(private readonly options: InAppBrowserOptions) {
    // A blocks app has no webview route. When an inline embed does not tell us
    // its surface, a 404 here falls back to the post that hosts the blocks UI.
    session.fromPartition(SESSION_PARTITION).webRequest.onCompleted(
      { urls: [`${this.options.origin}/apps/installs/*/webview`] },
      (details) => {
        if (details.resourceType !== 'mainFrame' || details.webContentsId == null) return
        const fallback = this.appFallbacks.get(details.webContentsId)
        if (!fallback || new URL(details.url).pathname !== new URL(fallback.directUrl).pathname) return
        if (details.statusCode >= 400) {
          this.appFallbacks.delete(details.webContentsId)
          const contents = details.webContents ?? webContents.fromId(details.webContentsId)
          if (contents && !contents.isDestroyed()) loadContents(contents, fallback.fallbackUrl)
        } else if (details.statusCode >= 200 && details.statusCode < 300) {
          this.appFallbacks.delete(details.webContentsId)
        }
      }
    )
  }

  open(url: string): boolean {
    if (!isWebUrl(url)) return false

    if (!this.window || this.window.isDestroyed()) {
      this.window = this.create()
    }
    const window = this.window
    void this.navigate(window, url)
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    return true
  }

  /** Opens a game/applet as a first-class desktop window, without browser chrome or preload access. */
  openApp(options: DesktopAppWindowOptions): boolean {
    if (!isWebUrl(options.url) || new URL(options.url).origin !== this.options.origin) return false
    if (options.fallbackUrl && (!isWebUrl(options.fallbackUrl) || new URL(options.fallbackUrl).origin !== this.options.origin)) {
      return false
    }

    let window = this.appWindows.get(options.key)
    if (!window || window.isDestroyed()) {
      window = this.createAppWindow(options.key, options.name)
      this.appWindows.set(options.key, window)
    }
    if (options.fallbackUrl) {
      this.appFallbacks.set(window.webContents.id, { directUrl: options.url, fallbackUrl: options.fallbackUrl })
    }
    void this.navigate(window, options.url)
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    return true
  }

  async mountAppView(owner: BrowserWindow, options: EmbeddedAppViewOptions): Promise<boolean> {
    if (owner.isDestroyed()) return false
    this.unmountAppView(owner, options.viewId)

    const directUrl = `${this.options.origin}/apps/installs/${options.installId}/webview`
    const view = new WebContentsView({
      webPreferences: {
        partition: SESSION_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })
    const key = embeddedKey(owner, options.viewId)
    this.embeddedApps.set(key, { owner, view })
    owner.contentView.addChildView(view)
    view.setBounds(options.bounds)
    view.setVisible(options.visible)

    if (options.fallbackUrl) {
      this.appFallbacks.set(view.webContents.id, { directUrl, fallbackUrl: options.fallbackUrl })
    }
    this.guardAppContents(view.webContents, (url) => loadContents(view.webContents, url))
    if (!this.observedOwners.has(owner.id)) {
      this.observedOwners.add(owner.id)
      owner.once('closed', () => this.destroyOwnerViews(owner))
    }
    await this.ensureSiteSession()
    const current = this.embeddedApps.get(key)
    if (owner.isDestroyed() || current?.view !== view || view.webContents.isDestroyed()) return false
    loadContents(view.webContents, directUrl)
    return true
  }

  updateAppView(owner: BrowserWindow, viewId: string, bounds: Rectangle, visible: boolean, fullscreen = false): boolean {
    const entry = this.embeddedApps.get(embeddedKey(owner, viewId))
    if (!entry || entry.owner !== owner || entry.view.webContents.isDestroyed()) return false
    entry.view.setBounds(bounds)
    entry.view.setVisible(visible)
    if (fullscreen) owner.contentView.addChildView(entry.view, owner.contentView.children.length)
    return true
  }

  unmountAppView(owner: BrowserWindow, viewId: string): void {
    const key = embeddedKey(owner, viewId)
    const entry = this.embeddedApps.get(key)
    if (!entry || entry.owner !== owner) return
    this.embeddedApps.delete(key)
    this.appFallbacks.delete(entry.view.webContents.id)
    if (!owner.isDestroyed()) owner.contentView.removeChildView(entry.view)
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close()
  }

  private async navigate(window: BrowserWindow, url: string): Promise<void> {
    if (!this.signingIn && (await this.needsSignIn(url))) {
      this.signingIn = true
      const token = await this.options.createOneTimePassword().catch(() => null)
      if (token && !window.isDestroyed()) {
        this.signInThenLoad(window, token, url)
        return
      }
      this.signingIn = false
    }
    if (!window.isDestroyed()) load(window, url)
  }

  private async needsSignIn(url: string): Promise<boolean> {
    if (new URL(url).origin !== this.options.origin) return false
    const cookies = await session.fromPartition(SESSION_PARTITION).cookies.get({ url: this.options.origin, name: AUTH_COOKIE })
    return cookies.length === 0
  }

  /**
   * Opens the one-time password page, submits its confirmation form (which
   * signs the session in and redirects home), then loads the page asked for.
   */
  private signInThenLoad(window: BrowserWindow, token: string, target: string): void {
    const contents = window.webContents
    const otpUrl = `${this.options.origin}/session/otp/${token}`

    const finish = (): void => {
      contents.off('did-finish-load', onLoad)
      contents.off('did-fail-load', onFail)
      this.signingIn = false
      if (!window.isDestroyed()) load(window, target)
    }
    const onFail = (_event: unknown, _code: number, _description: string, _url: string, isMainFrame: boolean): void => {
      if (isMainFrame) finish()
    }
    const onLoad = (): void => {
      if (!contents.getURL().startsWith(otpUrl)) {
        finish()
        return
      }
      const submit = "(() => { const form = document.querySelector('form'); if (!form) return false; form.submit(); return true })()"
      void contents
        .executeJavaScript(submit)
        .then((submitted) => {
          // No form means the token was refused; show the page anyway.
          if (!submitted) finish()
        })
        .catch(finish)
    }

    contents.on('did-finish-load', onLoad)
    contents.on('did-fail-load', onFail)
    window.once('closed', () => {
      this.signingIn = false
    })
    load(window, otpUrl)
  }

  private create(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 480,
      minHeight: 360,
      title: 'NodeLoc',
      icon: this.options.appIcon,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B0F0E' : '#FFFFFF',
      webPreferences: {
        partition: SESSION_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })
    window.setIcon(this.options.appIcon)

    const contents = window.webContents
    // target=_blank and window.open stay in this window.
    contents.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url)) load(window, url)
      else openExternalSafely(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (isWebUrl(url)) return
      event.preventDefault()
      openExternalSafely(url)
    })
    contents.on('page-title-updated', (_event, title) => window.setTitle(title ? `${title} · NodeLoc` : 'NodeLoc'))

    window.setMenu(Menu.buildFromTemplate(this.menuTemplate(window)))
    window.on('closed', () => {
      if (this.window === window) this.window = null
    })
    return window
  }

  private createAppWindow(key: string, name: string): BrowserWindow {
    const window = new BrowserWindow({
      width: 1040,
      height: 780,
      minWidth: 480,
      minHeight: 360,
      show: false,
      title: `${name} · NodeLoc`,
      icon: this.options.appIcon,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0B0F0E' : '#FFFFFF',
      autoHideMenuBar: true,
      webPreferences: {
        partition: SESSION_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })
    window.setIcon(this.options.appIcon)

    const contents = window.webContents
    this.guardAppContents(contents, (url) => load(window, url))
    window.setMenu(null)
    window.on('closed', () => {
      this.appWindows.delete(key)
      this.appFallbacks.delete(contents.id)
    })
    return window
  }

  private guardAppContents(contents: Electron.WebContents, navigate: (url: string) => void): void {
    contents.setWindowOpenHandler(({ url }) => {
      if (isWebUrl(url) && new URL(url).origin === this.options.origin) navigate(url)
      else openExternalSafely(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (isWebUrl(url) && new URL(url).origin === this.options.origin) return
      event.preventDefault()
      openExternalSafely(url)
    })
  }

  private destroyOwnerViews(owner: BrowserWindow): void {
    this.observedOwners.delete(owner.id)
    for (const [key, entry] of this.embeddedApps) {
      if (entry.owner !== owner) continue
      this.embeddedApps.delete(key)
      this.appFallbacks.delete(entry.view.webContents.id)
      if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close()
    }
  }

  private async ensureSiteSession(): Promise<void> {
    if (!(await this.needsSignIn(this.options.origin))) return
    if (!this.sessionSignIn) {
      this.sessionSignIn = this.signInHidden().finally(() => {
        this.sessionSignIn = null
      })
    }
    await this.sessionSignIn
  }

  private async signInHidden(): Promise<void> {
    const token = await this.options.createOneTimePassword().catch(() => null)
    if (!token) return
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        partition: SESSION_PARTITION,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    const contents = window.webContents
    const otpUrl = `${this.options.origin}/session/otp/${token}`
    try {
      await contents.loadURL(otpUrl)
      const navigated = new Promise<void>((resolve) => contents.once('did-finish-load', () => resolve()))
      const submitted = await contents.executeJavaScript(
        "(() => { const form = document.querySelector('form'); if (!form) return false; form.submit(); return true })()"
      )
      if (submitted) await Promise.race([navigated, delay(10_000)])
    } catch {
      // The app can still load as a guest when OTP setup is unavailable.
    } finally {
      if (!window.isDestroyed()) window.destroy()
    }
  }

  private menuTemplate(window: BrowserWindow): MenuItemConstructorOptions[] {
    const contents = window.webContents
    const history = contents.navigationHistory
    return [
      {
        label: strings.browser.navigation,
        submenu: [
          { label: strings.browser.back, accelerator: 'Alt+Left', click: () => history.canGoBack() && history.goBack() },
          { label: strings.browser.forward, accelerator: 'Alt+Right', click: () => history.canGoForward() && history.goForward() },
          { label: strings.browser.reload, accelerator: 'F5', click: () => contents.reload() },
          { type: 'separator' },
          { label: strings.browser.openExternal, accelerator: 'Ctrl+Shift+O', click: () => openExternalSafely(contents.getURL()) },
          { label: strings.browser.copyLink, accelerator: 'Ctrl+Shift+C', click: () => clipboard.writeText(contents.getURL()) },
          { type: 'separator' },
          { label: strings.browser.close, accelerator: 'Ctrl+W', click: () => window.close() }
        ]
      },
      {
        label: strings.browser.view,
        submenu: [
          { label: strings.browser.zoomIn, accelerator: 'Ctrl+=', click: () => contents.setZoomLevel(contents.getZoomLevel() + 0.5) },
          { label: strings.browser.zoomOut, accelerator: 'Ctrl+-', click: () => contents.setZoomLevel(contents.getZoomLevel() - 0.5) },
          { label: strings.browser.actualSize, accelerator: 'Ctrl+0', click: () => contents.setZoomLevel(0) }
        ]
      }
    ]
  }
}

/** A navigation replaced by the next one rejects with ERR_ABORTED; that's expected. */
function load(window: BrowserWindow, url: string): void {
  window.loadURL(url).catch(() => undefined)
}

function loadContents(contents: Electron.WebContents, url: string): void {
  contents.loadURL(url).catch(() => undefined)
}

function embeddedKey(owner: BrowserWindow, viewId: string): string {
  return `${owner.id}:${viewId}`
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
