import { Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '../../components/EmptyState'
import { formatRelativeTime } from '../../lib/format'
import styles from './PointsHistory.module.css'
import { htmlToText } from './profile-text'
import { LoadMoreFooter, RowsSkeleton, TabError } from './TabStates'
import type { PointsEntry } from './types'
import { usePointsHistory } from './use-profile'

/** Energy ledger (discourse-points-service). The server only shows it to signed-in users. */
export function PointsHistory({ username }: { username: string }): React.JSX.Element {
  const { t } = useTranslation()
  const history = usePointsHistory(username)

  if (history.isPending) return <RowsSkeleton count={8} />
  if (history.isError && history.entries.length === 0) {
    return <TabError error={history.error} onRetry={() => void history.refetch()} />
  }
  if (history.entries.length === 0) return <EmptyState icon={<Zap />} title={t('profile.empty.points')} />

  return (
    <div className={styles.list}>
      {history.entries.map((entry, index) => (
        <PointsRow key={`${entry.created_at}-${index}`} entry={entry} />
      ))}
      <LoadMoreFooter
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        isFetchNextPageError={history.isFetchNextPageError}
        fetchNextPage={history.fetchNextPage}
      />
    </div>
  )
}

function PointsRow({ entry }: { entry: PointsEntry }): React.JSX.Element {
  const { i18n } = useTranslation()
  // The server's `is_positive` is `points > 0`, so a zero entry would read as a loss.
  const tone = entry.points > 0 ? 'positive' : entry.points < 0 ? 'negative' : 'neutral'
  const sign = entry.points > 0 ? '+' : entry.points < 0 ? '−' : ''
  const amount = new Intl.NumberFormat(i18n.language).format(Math.abs(entry.points))
  const timestamp = entry.created_at || entry.date

  return (
    <div className={styles.row}>
      <span className={styles.icon} data-tone={tone} aria-hidden="true">
        <Zap fill="currentColor" />
      </span>
      <div className={styles.body}>
        <p className={styles.description}>{htmlToText(entry.description)}</p>
        {timestamp && (
          <time dateTime={timestamp} title={new Date(timestamp).toLocaleString(i18n.language)}>
            {formatRelativeTime(timestamp, i18n.language)}
          </time>
        )}
      </div>
      <span className={styles.amount} data-tone={tone}>
        {sign}
        {amount}
      </span>
    </div>
  )
}
