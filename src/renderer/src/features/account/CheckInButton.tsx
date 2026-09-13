import { CalendarHeart } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException, apiRequest } from '../../api/client'
import { useFeatures } from '../../api/site'
import { useErrorMessage } from '../../api/use-error-message'
import { IconButton } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { showToast } from '../../components/toast-store'
import styles from './CheckInButton.module.css'
import { CURRENT_USER_KEY } from './use-session'

interface CheckInResponse {
  success: boolean
  points?: number
  message?: string
  user_date?: string
}

// The plugin exposes duplicate check-ins as localized text, without an error code.
const ALREADY_CHECKED_IN = new Set(['您今天已经签到过了', "You've already checked in today"])

/** discourse-checkin counts days in Asia/Shanghai by default. */
function checkInDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

function storageKey(userId: number): string {
  return `nodeloc.checkin.${userId}`
}

function readDone(userId: number): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === checkInDay()
  } catch {
    return false
  }
}

function writeDone(userId: number, day = checkInDay()): void {
  try {
    localStorage.setItem(storageKey(userId), day)
  } catch {
    // The button just offers check-in again; the server refuses duplicates.
  }
}

/**
 * Daily check-in. The server has no "checked in today?" endpoint, so the
 * result is remembered locally per user and day; a repeat attempt comes
 * back as HTTP 200 with `success: false` and an already-checked-in message.
 * Other HTTP 200 failures must remain retryable.
 */
export function CheckInButton({ userId }: { userId: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const features = useFeatures()
  const [done, setDone] = useState(() => readDone(userId))
  const [busy, setBusy] = useState(false)

  if (features && features.checkin === false) return null

  const checkIn = async (): Promise<void> => {
    if (done || busy) return
    setBusy(true)
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
    try {
      const response = await apiRequest<CheckInResponse>({
        method: 'POST',
        path: '/checkin',
        headers: { 'X-Discourse-Checkin': 'true', 'X-Checkin-Nonce': nonce },
        form: [
          ['nonce', nonce],
          ['timestamp', Date.now()]
        ],
        priority: 'user'
      })
      if (response.success) {
        showToast(t('account.checkin.success', { points: response.points ?? 0 }), 'success')
      } else if (response.message && ALREADY_CHECKED_IN.has(response.message.trim())) {
        showToast(response.message || t('account.checkin.already'))
      } else {
        showToast(t('account.checkin.failed', { message: response.message || t('errors.unknown') }), 'danger')
        return
      }
      writeDone(userId, response.user_date)
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
    } catch (error) {
      const message = error instanceof ApiException && error.error.serverMessage ? error.error.serverMessage : errorMessage(error)
      showToast(t('account.checkin.failed', { message }), 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <IconButton
      size="sm"
      label={done ? t('account.checkin.done') : t('account.checkin.action')}
      className={done ? undefined : styles.pending}
      disabled={done || busy}
      onClick={() => void checkIn()}
    >
      {busy ? <Spinner size={14} /> : <CalendarHeart strokeWidth={done ? 2 : 2.5} />}
    </IconButton>
  )
}
