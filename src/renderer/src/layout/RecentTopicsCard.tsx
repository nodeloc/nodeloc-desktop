import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../api/client'
import type { TopicListResponse } from '../api/types'
import { PanelCard } from '../components/PanelCard'
import { SkeletonGroup, SkeletonLine } from '../components/Skeleton'
import { useCurrentUser, useIsSignedIn } from '../features/account/use-session'
import { TopicMiniList, toTopicMiniItem, type TopicMiniItem } from '../features/feed/TopicMiniList'
import { useVisitedTopics } from '../features/feed/visited-store'
import styles from './RecentTopicsCard.module.css'

const LIMIT = 10

interface RecentItem extends TopicMiniItem {
  /** How far the server list says it was read; lets "clear" hide it until read further. */
  lastReadPostNumber?: number
}

/**
 * Recently viewed topics, as on the web. Signed in, the server's read list
 * (`/read.json`, newest visit first) so it matches other devices and can show
 * new replies; guests, or when that list can't load, the topics opened here.
 * Hidden when the account turned the rail off on the web.
 */
export function RecentTopicsCard(): React.JSX.Element | null {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const user = useCurrentUser()
  const local = useVisitedTopics((state) => state.recent)
  const hiddenRead = useVisitedTopics((state) => state.hiddenRead)
  const clearRecent = useVisitedTopics((state) => state.clearRecent)

  const read = useQuery({
    queryKey: ['recent-topics', user?.id],
    queryFn: () => apiRequest<TopicListResponse>({ path: '/read.json', priority: 'background' }),
    enabled: signedIn && user !== undefined,
    staleTime: 15_000
  })

  if (user?.user_option?.community_show_recent_posts === false) return null

  const loading = signedIn && (read.isPending || user === undefined)
  let items: RecentItem[]
  if (signedIn && read.data) {
    items = read.data.topic_list.topics
      .filter((topic) => {
        const hiddenAt = hiddenRead[topic.id]
        return hiddenAt === undefined || (topic.last_read_post_number ?? 0) > hiddenAt
      })
      .slice(0, LIMIT)
      .map((topic) => ({ ...toTopicMiniItem(topic), lastReadPostNumber: topic.last_read_post_number ?? 0 }))
  } else {
    items = local.slice(0, LIMIT)
  }

  const clear = (): void =>
    clearRecent(items.flatMap((item) => (item.lastReadPostNumber === undefined ? [] : [{ id: item.id, lastReadPostNumber: item.lastReadPostNumber }])))

  let body: React.JSX.Element
  if (loading) {
    body = (
      <SkeletonGroup className={styles.skeleton}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <SkeletonLine width={0.4} height={12} />
            <SkeletonLine width={0.9} height={16} />
            <SkeletonLine width={0.5} height={12} />
          </div>
        ))}
      </SkeletonGroup>
    )
  } else if (items.length === 0) {
    body = <p className={styles.empty}>{t('recentTopics.empty')}</p>
  } else {
    body = <TopicMiniList items={items} />
  }

  return (
    <PanelCard
      title={t('recentTopics.title')}
      action={
        !loading && items.length > 0 ? (
          <button type="button" className={styles.clear} onClick={clear}>
            {t('recentTopics.clear')}
          </button>
        ) : undefined
      }
    >
      {body}
    </PanelCard>
  )
}
