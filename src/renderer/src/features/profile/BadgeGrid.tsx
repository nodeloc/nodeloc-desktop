import { Medal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Badge } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { absoluteUrl } from '../../lib/discourse'
import { formatCount } from '../../lib/format'
import styles from './BadgeGrid.module.css'
import { htmlToText, isImageUrl } from './profile-text'
import { TabError } from './TabStates'
import type { UserBadgesResponse } from './types'
import { useUserBadges } from './use-profile'

/** Discourse badge types: 1 gold, 2 silver, 3 bronze. */
const TIERS: Partial<Record<number, string>> = { 1: 'gold', 2: 'silver', 3: 'bronze' }

interface GrantedBadge {
  badge: Badge
  description: string
  count: number
}

/** One card per badge, gold first; repeat grants of a badge add to its count. */
function groupBadges(data: UserBadgesResponse | undefined): GrantedBadge[] {
  if (!data) return []
  const badges = new Map((data.badges ?? []).map((badge) => [badge.id, badge]))
  const grouped = new Map<number, GrantedBadge>()
  for (const grant of data.user_badges) {
    const existing = grouped.get(grant.badge_id)
    if (existing) {
      existing.count += 1
      continue
    }
    const badge = badges.get(grant.badge_id)
    if (!badge) continue
    grouped.set(badge.id, { badge, description: badge.description ? htmlToText(badge.description) : '', count: 1 })
  }
  return [...grouped.values()].sort((a, b) => (a.badge.badge_type_id ?? 9) - (b.badge.badge_type_id ?? 9))
}

export function BadgeGrid({ username }: { username: string }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const query = useUserBadges(username)
  const badges = useMemo(() => groupBadges(query.data), [query.data])

  if (query.isPending) {
    return (
      <SkeletonGroup className={styles.grid}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.card}>
            <SkeletonCircle size={40} />
            <div className={styles.body}>
              <SkeletonLine width={0.5} height={14} />
              <SkeletonLine width={0.9} height={11} />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    )
  }
  if (query.isError) return <TabError error={query.error} onRetry={() => void query.refetch()} />
  if (badges.length === 0) return <EmptyState icon={<Medal />} title={t('profile.empty.badges')} />

  return (
    <ul className={styles.grid}>
      {badges.map(({ badge, description, count }) => (
        <li key={badge.id} className={styles.card}>
          <BadgeIcon badge={badge} />
          <div className={styles.body}>
            <p className={styles.name}>{badge.name}</p>
            {description && (
              <p className={styles.description} title={description}>
                {description}
              </p>
            )}
            <p className={styles.meta}>
              {count > 1 && <span className={styles.times}>{t('profile.badgeTimes', { value: count })}</span>}
              {badge.grant_count != null && (
                <span>{t('profile.badgeGranted', { value: formatCount(badge.grant_count, i18n.language) })}</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Uploaded badge art when there is some; Font Awesome icon names become a tier-coloured medal. */
function BadgeIcon({ badge }: { badge: Badge }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (isImageUrl(badge.image_url) && !failed) {
    return (
      <img
        className={styles.icon}
        src={absoluteUrl(badge.image_url)}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className={styles.icon} data-tier={TIERS[badge.badge_type_id ?? 3] ?? 'bronze'} aria-hidden="true">
      <Medal />
    </span>
  )
}
