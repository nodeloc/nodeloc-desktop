import type { RequestPriority } from '@shared/api'

export interface SchedulerOptions {
  maxConcurrent: number
  /** Requests allowed per rolling minute. User API Keys default to 50 on the server. */
  perMinute: number
}

interface Pending {
  start: () => void
}

const PRIORITIES: readonly RequestPriority[] = ['user', 'foreground', 'background']

/**
 * Share of the per-minute budget a priority may use before it waits, so
 * background refreshes stop well before they could crowd out a user's click.
 */
const BUDGET_SHARE: Record<RequestPriority, number> = {
  user: 1,
  foreground: 0.9,
  background: 0.6
}

const MINUTE = 60_000

/** Queues API requests by priority under a concurrency cap and a rolling rate budget. */
export class RequestScheduler {
  private readonly queues = new Map<RequestPriority, Pending[]>(PRIORITIES.map((p) => [p, []]))
  private readonly startTimes: number[] = []
  private active = 0
  private pausedUntil = 0
  private timer: NodeJS.Timeout | undefined
  private day = ''
  private dayCount = 0

  constructor(private readonly options: SchedulerOptions) {}

  schedule<T>(priority: RequestPriority, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queues.get(priority)!.push({
        start: () => {
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1
              this.drain()
            })
        }
      })
      this.drain()
    })
  }

  /** Holds every queued request until the server's back-off has passed. */
  backOff(seconds: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + seconds * 1000)
    this.drain()
  }

  /** Request counts for diagnostics, and for sizing the server-side limit. */
  stats(): { lastMinute: number; today: number } {
    this.prune(Date.now())
    return { lastMinute: this.startTimes.length, today: this.dayCount }
  }

  private drain(): void {
    clearTimeout(this.timer)
    this.timer = undefined

    const now = Date.now()
    if (now < this.pausedUntil) {
      this.wakeIn(this.pausedUntil - now)
      return
    }

    this.prune(now)
    while (this.active < this.options.maxConcurrent) {
      const next = this.takeNext()
      if (!next) break
      this.active += 1
      this.record(now)
      next.start()
    }

    // Still waiting with free slots means the budget is what's blocking;
    // try again when the oldest request leaves the window.
    if (this.active < this.options.maxConcurrent && this.hasPending() && this.startTimes.length > 0) {
      this.wakeIn(this.startTimes[0] + MINUTE - now)
    }
  }

  private takeNext(): Pending | undefined {
    for (const priority of PRIORITIES) {
      const queue = this.queues.get(priority)!
      if (queue.length === 0) continue
      if (this.startTimes.length < this.options.perMinute * BUDGET_SHARE[priority]) {
        return queue.shift()
      }
    }
    return undefined
  }

  private hasPending(): boolean {
    return PRIORITIES.some((priority) => this.queues.get(priority)!.length > 0)
  }

  private prune(now: number): void {
    while (this.startTimes.length > 0 && this.startTimes[0] <= now - MINUTE) this.startTimes.shift()
  }

  private record(now: number): void {
    this.startTimes.push(now)
    const day = new Date(now).toDateString()
    if (day !== this.day) {
      this.day = day
      this.dayCount = 0
    }
    this.dayCount += 1
  }

  private wakeIn(ms: number): void {
    this.timer = setTimeout(() => this.drain(), Math.max(ms, 50))
  }
}
