const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Parses an API timestamp; missing or malformed values (some plugin payloads) yield null. */
export function parseDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "3 分钟前"-style times for the last month, then a short date. Empty for invalid input. */
export function formatRelativeTime(iso: string | null | undefined, locale: string, now: number = Date.now()): string {
  const date = parseDate(iso)
  if (!date) return ''
  const seconds = (date.getTime() - now) / 1000
  const elapsed = Math.abs(seconds)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })

  if (elapsed < MINUTE) return relative.format(0, 'second')
  if (elapsed < HOUR) return relative.format(Math.round(seconds / MINUTE), 'minute')
  if (elapsed < DAY) return relative.format(Math.round(seconds / HOUR), 'hour')
  if (elapsed < 30 * DAY) return relative.format(Math.round(seconds / DAY), 'day')

  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat(locale, {
    year: sameYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/** Full local date and time for tooltips. Empty for invalid input. */
export function formatDateTime(iso: string | null | undefined, locale: string): string {
  return parseDate(iso)?.toLocaleString(locale) ?? ''
}

/** Compact counts: 1.2万 in Chinese, 12K in English. */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
