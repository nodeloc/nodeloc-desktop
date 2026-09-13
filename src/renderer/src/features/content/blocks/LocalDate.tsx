import { useTranslation } from 'react-i18next'
import { formatRelativeTime } from '../../../lib/format'

/**
 * `discourse-local-date` (data-date, data-time, data-timezone) and
 * `relative-date` (data-time in epoch milliseconds), shown in the reader's
 * own timezone.
 */
export function LocalDate({ element }: { element: Element }): React.JSX.Element {
  const { i18n } = useTranslation()
  const fallback = element.textContent ?? ''

  const date = element.getAttribute('data-date')
  const time = element.getAttribute('data-time')
  let value: Date | null = null
  if (date) {
    const zone = element.getAttribute('data-timezone')
    const iso = `${date}T${time ?? '00:00'}${zone === 'UTC' || !zone ? 'Z' : ''}`
    value = new Date(iso)
  } else if (time && /^\d+$/.test(time)) {
    value = new Date(Number(time))
  }

  if (!value || Number.isNaN(value.getTime())) return <span>{fallback}</span>

  const absolute = value.toLocaleString(i18n.language, date && !time ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <time dateTime={value.toISOString()} title={absolute}>
      {date ? absolute : formatRelativeTime(value.toISOString(), i18n.language)}
    </time>
  )
}
