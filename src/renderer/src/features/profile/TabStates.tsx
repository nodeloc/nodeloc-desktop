import { CircleAlert, LockKeyhole, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import styles from './TabStates.module.css'

const LINE_WIDTHS = [0.72, 0.5, 0.84, 0.6]

export function RowsSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.row}>
          <SkeletonCircle size={32} />
          <div className={styles.lines}>
            <SkeletonLine width={0.26} height={11} />
            <SkeletonLine width={LINE_WIDTHS[index % LINE_WIDTHS.length]} height={15} />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** A tab that failed before showing anything. Private data asks for sign-in instead of a retry. */
export function TabError({ error, onRetry }: { error: unknown; onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const needsSignIn = isApiErrorKind(error, 'unauthorized', 'forbidden')
  return (
    <EmptyState
      icon={needsSignIn ? <LockKeyhole /> : isApiErrorKind(error, 'offline') ? <WifiOff /> : <CircleAlert />}
      title={needsSignIn ? t('profile.signInRequired') : errorMessage(error)}
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

interface LoadMoreFooterProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => unknown
}

/**
 * Paging is by button, not on scroll: on narrow windows the side cards sit
 * below the list and would otherwise never be reachable.
 */
export function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage
}: LoadMoreFooterProps): React.JSX.Element {
  const { t } = useTranslation()
  let content: React.JSX.Element
  if (isFetchingNextPage) content = <Spinner size={24} />
  else if (isFetchNextPageError)
    content = (
      <Button size="sm" onClick={() => void fetchNextPage()}>
        {t('profile.loadMoreFailed')} · {t('common.retry')}
      </Button>
    )
  else if (hasNextPage)
    content = (
      <Button size="sm" onClick={() => void fetchNextPage()}>
        {t('profile.loadMore')}
      </Button>
    )
  else content = <span className={styles.end}>{t('profile.end')}</span>

  return <div className={styles.footer}>{content}</div>
}
