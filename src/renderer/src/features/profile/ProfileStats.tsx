import { useTranslation } from 'react-i18next'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { formatCount } from '../../lib/format'
import styles from './ProfileStats.module.css'
import { useProfileSummary } from './use-profile'

const STATS = [
  ['topic_count', 'profile.stats.topics'],
  ['post_count', 'profile.stats.replies'],
  ['likes_received', 'profile.stats.likesReceived'],
  ['likes_given', 'profile.stats.likesGiven'],
  ['days_visited', 'profile.stats.daysVisited']
] as const

/** Supporting numbers: when the summary is unavailable the strip is simply left out. */
export function ProfileStats({ username }: { username: string }): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const summary = useProfileSummary(username)

  if (summary.isPending) {
    return (
      <SkeletonGroup className={styles.strip}>
        {Array.from({ length: STATS.length + 1 }, (_, index) => (
          <SkeletonLine key={index} width={0.7} height={38} />
        ))}
      </SkeletonGroup>
    )
  }

  const stats = summary.data?.user_summary
  if (!stats || stats.can_see_summary_stats === false) return null

  return (
    <dl className={styles.strip}>
      {STATS.map(([key, label]) => (
        <div key={key} className={styles.stat}>
          <dt>{t(label)}</dt>
          <dd title={stats[key].toLocaleString(i18n.language)}>{formatCount(stats[key], i18n.language)}</dd>
        </div>
      ))}
      <div className={styles.stat}>
        <dt>{t('profile.stats.readTime')}</dt>
        <dd>
          {formatCount(Math.round(stats.time_read / 3600), i18n.language)}
          <span className={styles.unit}>{t('profile.stats.hours')}</span>
        </dd>
      </div>
    </dl>
  )
}
