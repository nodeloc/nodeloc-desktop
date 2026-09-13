import { CircleAlert, LockKeyhole, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import styles from './NodeLoadError.module.css'

interface LoadErrorProps {
  error: unknown
  onRetry: () => void
}

/** Full-area failure: sign-in hint for private content, otherwise the error and a retry. */
export function NodeLoadError({ error, onRetry }: LoadErrorProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const needsSignIn = isApiErrorKind(error, 'unauthorized', 'forbidden')

  return (
    <EmptyState
      icon={needsSignIn ? <LockKeyhole /> : isApiErrorKind(error, 'offline') ? <WifiOff /> : <CircleAlert />}
      title={needsSignIn ? t('feed.signInRequired') : errorMessage(error)}
      action={
        needsSignIn ? undefined : (
          <Button variant="primary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    />
  )
}

/** One-line failure for a block inside a page that otherwise loaded. */
export function InlineRetry({ error, onRetry }: LoadErrorProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()

  return (
    <div className={styles.inline}>
      {isApiErrorKind(error, 'offline') ? <WifiOff /> : <CircleAlert />}
      <span>{errorMessage(error)}</span>
      <Button size="sm" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  )
}
