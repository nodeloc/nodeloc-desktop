import type { AuthCompletion } from '@shared/bridge'
import { ExternalLink, LogIn } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Spinner } from '../../components/Spinner'
import { showToast } from '../../components/toast-store'
import { useSignInDialog } from './sign-in-store'
import styles from './SignInDialog.module.css'
import { AUTH_STATE_KEY, useAuthState } from './use-session'

type FailureReason = Extract<AuthCompletion, { ok: false }>['reason']

/**
 * Sign-in through the site's User API Key page in the system browser. The
 * browser returns via `nodeloc://auth_redirect`; pasting that link is the
 * fallback when the protocol hand-off doesn't happen.
 */
export function SignInDialog(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const open = useSignInDialog((state) => state.open)
  const hide = useSignInDialog((state) => state.hide)
  const show = useSignInDialog((state) => state.show)
  const auth = useAuthState()
  const [callbackUrl, setCallbackUrl] = useState('')
  const [failure, setFailure] = useState<FailureReason | null>(null)
  const [busy, setBusy] = useState(false)
  const previousStatus = useRef(auth.status)

  const appInfo = useQuery({ queryKey: ['app-info'], queryFn: () => window.nodeloc.app.getInfo(), staleTime: Infinity })

  useEffect(() => {
    if (previousStatus.current !== 'signedIn' && auth.status === 'signedIn') {
      hide()
      setCallbackUrl('')
      setFailure(null)
      showToast(t('account.signedIn', { username: auth.username ?? '' }), 'success')
    }
    previousStatus.current = auth.status
  }, [auth.status, auth.username, hide, t])

  useEffect(
    () =>
      window.nodeloc.events.onAuthError((reason) => {
        setFailure(reason)
        show()
      }),
    [show]
  )

  const setState = (state: Awaited<ReturnType<typeof window.nodeloc.auth.getState>>): void => {
    queryClient.setQueryData(AUTH_STATE_KEY, state)
  }

  const start = async (): Promise<void> => {
    setFailure(null)
    setState(await window.nodeloc.auth.start())
  }

  const cancel = async (): Promise<void> => {
    setFailure(null)
    setState(await window.nodeloc.auth.cancel())
  }

  const complete = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!callbackUrl.trim()) return
    setBusy(true)
    const result = await window.nodeloc.auth.completeWithUrl(callbackUrl)
    setBusy(false)
    if (result.ok) setState(result.state)
    else setFailure(result.reason)
  }

  const pending = auth.status === 'pending'
  const expired = auth.status === 'expired'

  return (
    <Dialog
      open={open}
      onClose={hide}
      width={460}
      title={pending ? t('account.waitingTitle') : expired ? t('account.expiredTitle') : t('account.signInTitle')}
    >
      <div className={styles.content}>
        {pending ? (
          <>
            <div className={styles.waiting}>
              <Spinner size={32} />
              <p>{t('account.waitingIntro')}</p>
            </div>
            <div className={styles.row}>
              <Button icon={<ExternalLink />} onClick={() => void window.nodeloc.auth.reopenBrowser()}>
                {t('account.reopenBrowser')}
              </Button>
              <Button variant="ghost" onClick={() => void cancel()}>
                {t('account.cancel')}
              </Button>
            </div>
            <form className={styles.paste} onSubmit={(event) => void complete(event)}>
              <label htmlFor="auth-callback">{t('account.pasteHint')}</label>
              {appInfo.data && !appInfo.data.isPackaged && <p className={styles.hint}>{t('account.devProtocolHint')}</p>}
              <div className={styles.pasteRow}>
                <input
                  id="auth-callback"
                  value={callbackUrl}
                  onChange={(event) => setCallbackUrl(event.target.value)}
                  placeholder={t('account.pastePlaceholder')}
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button type="submit" variant="primary" disabled={!callbackUrl.trim() || busy}>
                  {t('account.complete')}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p>{expired ? t('account.expiredIntro') : t('account.signInIntro')}</p>
            <p className={styles.hint}>{t('account.signInPrivacy')}</p>
            <Button variant="primary" icon={<LogIn strokeWidth={2.5} />} className={styles.primary} onClick={() => void start()}>
              {expired ? t('account.signInAgain') : t('account.openBrowser')}
            </Button>
          </>
        )}
        {failure && (
          <p className={styles.error} role="alert">
            {t(`account.errors.${failure}`)}
          </p>
        )}
      </div>
    </Dialog>
  )
}
