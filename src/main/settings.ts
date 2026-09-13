import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type NotificationSettings,
  type LanguagePreference,
  type ThemeSource
} from '@shared/bridge'

export interface Settings {
  themeSource: ThemeSource
  language: LanguagePreference
  /** Closing the window hides it to the tray instead of quitting. */
  closeToTray: boolean
  notifications: NotificationSettings
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: true,
  sound: true,
  categories: { replies: true, likes: true, messages: true, chat: true, rewards: true, system: true }
}

const DEFAULTS: Settings = {
  themeSource: 'system',
  language: 'system',
  closeToTray: true,
  notifications: DEFAULT_NOTIFICATIONS
}

const THEME_SOURCES: readonly ThemeSource[] = ['system', 'light', 'dark']
const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ['system', 'zh-CN', 'en']

/** Device-local preferences, kept as one small JSON file in userData. */
export class SettingsStore {
  private readonly file = join(app.getPath('userData'), 'settings.json')
  private current: Settings

  constructor() {
    this.current = this.read()
  }

  get(): Settings {
    return this.current
  }

  update(patch: Partial<Settings>): Settings {
    this.current = { ...this.current, ...patch }
    try {
      writeFileSync(this.file, JSON.stringify(this.current, null, 2))
    } catch (error) {
      console.error('[settings] could not save', error)
    }
    return this.current
  }

  updateNotifications(patch: Partial<NotificationSettings>): NotificationSettings {
    const merged = sanitizeNotifications({ ...this.current.notifications, ...patch })
    this.update({ notifications: merged })
    return merged
  }

  private read(): Settings {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>
      return {
        themeSource: isThemeSource(raw.themeSource) ? raw.themeSource : DEFAULTS.themeSource,
        language: isLanguagePreference(raw.language) ? raw.language : DEFAULTS.language,
        closeToTray: typeof raw.closeToTray === 'boolean' ? raw.closeToTray : DEFAULTS.closeToTray,
        notifications: sanitizeNotifications(raw.notifications)
      }
    } catch {
      return { ...DEFAULTS }
    }
  }
}

export function isThemeSource(value: unknown): value is ThemeSource {
  return THEME_SOURCES.includes(value as ThemeSource)
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return LANGUAGE_PREFERENCES.includes(value as LanguagePreference)
}

function sanitizeNotifications(value: unknown): NotificationSettings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<NotificationSettings>
  const categories = {} as Record<NotificationCategory, boolean>
  for (const category of NOTIFICATION_CATEGORIES) {
    const flag = raw.categories?.[category]
    categories[category] = typeof flag === 'boolean' ? flag : DEFAULT_NOTIFICATIONS.categories[category]
  }
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_NOTIFICATIONS.enabled,
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_NOTIFICATIONS.sound,
    categories
  }
}
