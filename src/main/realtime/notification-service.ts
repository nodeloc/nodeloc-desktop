import { Notification, type BrowserWindow, type Tray } from 'electron'
import type { NotificationCategory, NotificationCounts } from '@shared/bridge'
import { EventEmitter } from 'node:events'
import type { DiscourseClient } from '../api/client'
import type { SettingsStore } from '../settings'
import { strings } from '../strings'
import { unreadBadge } from './badge'
import type { BusMessage, MessageBusClient } from './message-bus'

interface CurrentUserResponse {
  current_user?: {
    id: number
    unread_notifications?: number
    unread_high_priority_notifications?: number
    all_unread_notifications_count?: number
    new_personal_messages_notifications_count?: number
    notification_channel_position?: number
  }
}

interface NotificationPayload {
  unread_notifications?: number
  unread_high_priority_notifications?: number
  all_unread_notifications_count?: number
  new_personal_messages_notifications_count?: number
}

/** `/notification-alert/{userId}` payload (PostAlerter). */
interface AlertPayload {
  notification_type?: number
  topic_title?: string
  excerpt?: string
  username?: string
  post_url?: string
}

/** Discourse notification type ids, as reported by this site's site.json. */
const CATEGORY_BY_TYPE: Record<number, NotificationCategory> = {
  1: 'replies',
  2: 'replies',
  3: 'replies',
  9: 'replies',
  15: 'replies',
  17: 'replies',
  36: 'replies',
  800: 'replies',
  801: 'replies',
  802: 'replies',
  5: 'likes',
  19: 'likes',
  25: 'likes',
  43: 'likes',
  6: 'messages',
  7: 'messages',
  16: 'messages',
  29: 'chat',
  30: 'chat',
  31: 'chat',
  32: 'chat',
  33: 'chat',
  40: 'chat',
  5000: 'rewards',
  6001: 'rewards',
  6002: 'rewards'
}

function alertTitle(alert: AlertPayload): string {
  const user = alert.username ?? ''
  const titles = strings.notification
  switch (alert.notification_type) {
    case 1:
      return titles.mentioned(user)
    case 2:
      return titles.replied(user)
    case 3:
      return titles.quoted(user)
    case 5:
    case 19:
    case 25:
      return titles.liked(user)
    case 6:
      return titles.privateMessage(user)
    case 7:
      return titles.invitedToMessage(user)
    case 9:
      return titles.posted(user)
    case 12:
      return titles.badge
    case 15:
      return titles.groupMentioned(user)
    case 17:
      return titles.watchingFirstPost(user)
    case 29:
    case 32:
      return titles.chatMention(user)
    case 30:
      return titles.chatMessage(user)
    case 43:
      return titles.boost(user)
    case 5000:
      return titles.reward(user)
    case 6001:
      return titles.featured
    case 6002:
      return titles.lottery
    default:
      return titles.generic(user)
  }
}

export interface NotificationServiceOptions {
  client: DiscourseClient
  bus: MessageBusClient
  settings: SettingsStore
  origin: string
  appIcon: string
  getWindow: () => BrowserWindow | null
  getTray: () => Tray | null
  /** Brings the app forward and routes to a forum URL. */
  openUrl: (url: string) => void
}

/**
 * The signed-in account's notification channels: keeps unread counts (taskbar
 * overlay, tray tooltip, renderer badge) and turns alerts into Windows
 * notifications while the app isn't in front. Runs only while the app runs;
 * there is no push relay for desktop clients.
 */
export class NotificationService extends EventEmitter<{ counts: [NotificationCounts | null] }> {
  private userId: number | null = null
  private counts: NotificationCounts | null = null
  private starting: Promise<void> | null = null
  private readonly onMessage = (message: BusMessage): void => this.handle(message)

  constructor(private readonly options: NotificationServiceOptions) {
    super()
    options.bus.on('message', this.onMessage)
  }

  getCounts(): NotificationCounts | null {
    return this.counts
  }

  start(): Promise<void> {
    this.starting ??= this.run().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  stop(): void {
    if (this.userId !== null) {
      this.options.bus.unsubscribe(this.notificationChannel(this.userId))
      this.options.bus.unsubscribe(this.alertChannel(this.userId))
    }
    this.userId = null
    this.apply(null)
  }

  private async run(): Promise<void> {
    const result = await this.options.client.request<CurrentUserResponse>({ path: '/session/current.json', priority: 'background' })
    const user = result.ok ? result.data?.current_user : undefined
    if (!user) return
    if (this.userId === user.id) return
    if (this.userId !== null) this.stop()

    this.userId = user.id
    this.apply(toCounts(user))
    this.options.bus.subscribe(this.notificationChannel(user.id), user.notification_channel_position ?? -1)
    this.options.bus.subscribe(this.alertChannel(user.id), -1)
  }

  private notificationChannel(userId: number): string {
    return `/notification/${userId}`
  }

  private alertChannel(userId: number): string {
    return `/notification-alert/${userId}`
  }

  private handle(message: BusMessage): void {
    if (this.userId === null) return
    if (message.channel === this.notificationChannel(this.userId)) {
      this.apply(toCounts(message.data as NotificationPayload))
    } else if (message.channel === this.alertChannel(this.userId)) {
      this.notify(message.data as AlertPayload)
    }
  }

  private notify(alert: AlertPayload): void {
    const { notifications } = this.options.settings.get()
    if (!notifications.enabled || !Notification.isSupported()) return
    const category = CATEGORY_BY_TYPE[alert.notification_type ?? -1] ?? 'system'
    if (!notifications.categories[category]) return

    const window = this.options.getWindow()
    // In front and focused: the in-app badge is enough.
    if (window && window.isVisible() && window.isFocused()) return

    const body = [alert.topic_title, alert.excerpt].filter(Boolean).join('\n')
    const notification = new Notification({
      title: alertTitle(alert),
      body: body.slice(0, 280),
      icon: this.options.appIcon,
      silent: !notifications.sound
    })
    notification.on('click', () => {
      if (alert.post_url) this.options.openUrl(new URL(alert.post_url, this.options.origin).toString())
    })
    notification.show()
    window?.flashFrame(true)
  }

  private apply(counts: NotificationCounts | null): void {
    this.counts = counts
    const total = counts ? counts.allUnread : 0
    const window = this.options.getWindow()
    if (window && !window.isDestroyed()) {
      window.setOverlayIcon(total > 0 ? unreadBadge() : null, total > 0 ? strings.unreadOverlay(total) : '')
    }
    this.options.getTray()?.setToolTip(total > 0 ? strings.trayUnread(total) : strings.appName)
    this.emit('counts', counts)
  }
}

function toCounts(source: NotificationPayload): NotificationCounts {
  const unread = source.unread_notifications ?? 0
  const unreadHighPriority = source.unread_high_priority_notifications ?? 0
  return {
    unread,
    unreadHighPriority,
    allUnread: source.all_unread_notifications_count ?? unread + unreadHighPriority,
    newPersonalMessages: source.new_personal_messages_notifications_count ?? 0
  }
}
