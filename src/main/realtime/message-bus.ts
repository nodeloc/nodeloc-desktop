import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { DiscourseClient } from '../api/client'

export interface BusMessage {
  global_id: number
  message_id: number
  channel: string
  data: unknown
}

const MIN_BACKOFF_MS = 4_000
const MAX_BACKOFF_MS = 60_000
/** Discourse holds a long poll ~25 s; debounce subscription churn before re-polling. */
const RESTART_DELAY_MS = 150
/** Keep idle long-polls below the User API Key's daily request budget. */
const IDLE_POLL_CYCLE_MS = 45_000

/**
 * One MessageBus long-poll connection for the whole app (the web client's
 * protocol: `POST /message-bus/{clientId}/poll` with `{channel: lastId}`).
 * Subscriptions from every window are merged; a change aborts the running
 * poll and starts a new one with the updated channel set.
 *
 * `-1` asks for new messages only; the server answers with `/__status`
 * carrying current ids, which then become the positions.
 */
export class MessageBusClient extends EventEmitter<{ message: [BusMessage] }> {
  private readonly clientId = randomUUID().replace(/-/g, '')
  private readonly positions = new Map<string, number>()
  private readonly refs = new Map<string, number>()
  private controller: AbortController | null = null
  private running = false
  private backoff = MIN_BACKOFF_MS
  private seq = 0
  private restartTimer: NodeJS.Timeout | undefined

  constructor(private readonly client: DiscourseClient) {
    super()
  }

  subscribe(channel: string, lastId = -1): void {
    this.refs.set(channel, (this.refs.get(channel) ?? 0) + 1)
    const current = this.positions.get(channel)
    if (current === undefined || (lastId >= 0 && lastId > current)) {
      this.positions.set(channel, lastId)
      this.restart()
    }
  }

  unsubscribe(channel: string): void {
    const count = (this.refs.get(channel) ?? 0) - 1
    if (count > 0) {
      this.refs.set(channel, count)
      return
    }
    this.refs.delete(channel)
    if (this.positions.delete(channel)) this.restart()
  }

  /** Drops every subscription (sign-out, account switch). */
  clear(): void {
    this.refs.clear()
    this.positions.clear()
    this.controller?.abort()
  }

  /** Re-poll now, e.g. after the system resumes from sleep. */
  reconnect(): void {
    this.backoff = MIN_BACKOFF_MS
    this.restart()
  }

  private restart(): void {
    clearTimeout(this.restartTimer)
    this.restartTimer = setTimeout(() => {
      this.controller?.abort()
      void this.loop()
    }, RESTART_DELAY_MS)
  }

  private async loop(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.positions.size > 0) {
        const controller = new AbortController()
        this.controller = controller
        const pollStartedAt = Date.now()

        const fields: Array<[string, number]> = [...this.positions]
        fields.push(['__seq', this.seq++])
        const result = await this.client.pollMessageBus(this.clientId, fields, controller.signal)

        // Aborted on purpose: the channel set changed, poll again straight away.
        if (controller.signal.aborted) continue

        if (!result.ok) {
          const wait = result.error.retryAfterSeconds ? result.error.retryAfterSeconds * 1000 : this.backoff
          this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
          await sleep(wait, controller.signal)
          continue
        }

        this.backoff = MIN_BACKOFF_MS
        const messages = (result.data ?? []) as BusMessage[]
        for (const message of messages) this.handle(message)

        // The server normally holds an idle poll for ~25 seconds. A short gap
        // keeps an always-running desktop client within the daily User API Key
        // allowance. Real messages skip the gap so active chat stays current.
        const hasMessage = messages.some((message) => message.channel !== '/__status')
        if (!hasMessage) {
          await sleep(Math.max(0, IDLE_POLL_CYCLE_MS - (Date.now() - pollStartedAt)), controller.signal)
        }
      }
    } finally {
      this.running = false
      this.controller = null
    }
  }

  private handle(message: BusMessage): void {
    if (message.channel === '/__status') {
      const status = message.data as Record<string, number> | null
      for (const [channel, id] of Object.entries(status ?? {})) {
        if (this.positions.has(channel) && typeof id === 'number') this.positions.set(channel, id)
      }
      return
    }
    if (!this.positions.has(message.channel)) return
    this.positions.set(message.channel, message.message_id)
    this.emit('message', message)
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}
