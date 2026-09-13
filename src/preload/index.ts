import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IpcChannel,
  type AuthFailureReason,
  type AuthState,
  type NodelocBridge,
  type NotificationCounts,
  type RealtimeMessage,
  type UpdateState
} from '@shared/bridge'

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, ...args: unknown[]): void => listener(...(args as T))
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const bridge: NodelocBridge = {
  api: {
    request: (request) => ipcRenderer.invoke(IpcChannel.apiRequest, request),
    upload: (request) => ipcRenderer.invoke(IpcChannel.apiUpload, request)
  },
  auth: {
    getState: () => ipcRenderer.invoke(IpcChannel.authGetState),
    start: () => ipcRenderer.invoke(IpcChannel.authStart),
    reopenBrowser: () => ipcRenderer.invoke(IpcChannel.authReopen),
    cancel: () => ipcRenderer.invoke(IpcChannel.authCancel),
    completeWithUrl: (url) => ipcRenderer.invoke(IpcChannel.authComplete, url),
    signOut: () => ipcRenderer.invoke(IpcChannel.authSignOut)
  },
  realtime: {
    subscribe: (channel, lastId) => ipcRenderer.invoke(IpcChannel.realtimeSubscribe, channel, lastId),
    unsubscribe: (channel) => ipcRenderer.invoke(IpcChannel.realtimeUnsubscribe, channel)
  },
  notifications: {
    getCounts: () => ipcRenderer.invoke(IpcChannel.notificationsCounts),
    getSettings: () => ipcRenderer.invoke(IpcChannel.notificationsGetSettings),
    updateSettings: (patch) => ipcRenderer.invoke(IpcChannel.notificationsUpdateSettings, patch)
  },
  cache: {
    read: (key) => ipcRenderer.invoke(IpcChannel.cacheRead, key),
    write: (key, value) => ipcRenderer.invoke(IpcChannel.cacheWrite, key, value)
  },
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.appInfo),
    getPreferences: () => ipcRenderer.invoke(IpcChannel.appGetPreferences),
    updatePreferences: (patch) => ipcRenderer.invoke(IpcChannel.appUpdatePreferences, patch)
  },
  updates: {
    getState: () => ipcRenderer.invoke(IpcChannel.updateGetState),
    check: () => ipcRenderer.invoke(IpcChannel.updateCheck)
  },
  theme: {
    setSource: (source) => ipcRenderer.invoke(IpcChannel.themeSetSource, source)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IpcChannel.openExternal, url),
    saveFile: (url) => ipcRenderer.invoke(IpcChannel.saveFile, url),
    copyText: (text) => ipcRenderer.invoke(IpcChannel.copyText, text)
  },
  browser: {
    open: (url) => ipcRenderer.invoke(IpcChannel.browserOpen, url)
  },
  apps: {
    open: (request) => ipcRenderer.invoke(IpcChannel.appsOpen, request),
    mount: (request) => ipcRenderer.invoke(IpcChannel.appsMount, request),
    update: (viewId, bounds) => ipcRenderer.invoke(IpcChannel.appsUpdate, viewId, bounds),
    unmount: (viewId) => ipcRenderer.invoke(IpcChannel.appsUnmount, viewId)
  },
  windows: {
    open: (route) => ipcRenderer.invoke(IpcChannel.windowOpen, route)
  },
  events: {
    onDeepLink: (listener) => subscribe<[string]>(IpcChannel.deepLink, listener),
    onAuthChanged: (listener) => subscribe<[AuthState]>(IpcChannel.authChanged, listener),
    onAuthError: (listener) => subscribe<[AuthFailureReason]>(IpcChannel.authError, listener),
    onRealtime: (listener) => subscribe<[RealtimeMessage]>(IpcChannel.realtimeMessage, listener),
    onNotificationCounts: (listener) => subscribe<[NotificationCounts | null]>(IpcChannel.notificationCounts, listener),
    onUpdateState: (listener) => subscribe<[UpdateState]>(IpcChannel.updateState, listener)
  }
}

contextBridge.exposeInMainWorld('nodeloc', bridge)
