import { Lock, Rss } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NodeIcon } from '../../components/NodeIcon'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { SidebarLink, SidebarSection } from '../../layout/SidebarNav'
import { paths } from '../../lib/routes'
import { CreateCustomFeedButton } from '../custom-feeds/CreateCustomFeedButton'
import styles from './PersonalSections.module.css'
import { useCustomFeeds, useRecentlyVisitedNodes } from './use-personal-nav'

const RECENT_LIMIT = 8

/** Home sidebar: nodes the signed-in user opened lately. */
export function RecentNodesSection(): React.JSX.Element {
  const { t } = useTranslation()
  const recent = useRecentlyVisitedNodes()

  let body: React.JSX.Element
  if (recent.data) {
    const nodes = recent.data.communities.slice(0, RECENT_LIMIT)
    body =
      nodes.length > 0 ? (
        <>
          {nodes.map((node) => (
            <SidebarLink
              key={node.id}
              to={paths.node(node.slug)}
              end={false}
              icon={
                <NodeIcon
                  name={node.name}
                  color={node.color}
                  logo={node.uploaded_logo}
                  logoDark={node.uploaded_logo_dark}
                  size={18}
                />
              }
            >
              {node.name}
            </SidebarLink>
          ))}
        </>
      ) : (
        <p className={styles.hint}>{t('social.recentEmpty')}</p>
      )
  } else if (recent.isError) {
    body = <SectionRetry onRetry={() => void recent.refetch()} />
  } else {
    body = <SectionSkeleton />
  }

  return <SidebarSection title={t('social.recentlyVisited')}>{body}</SidebarSection>
}

/** Home sidebar: the signed-in user's custom feeds. */
export function CustomFeedsSection(): React.JSX.Element {
  const { t } = useTranslation()
  const feeds = useCustomFeeds()

  let body: React.JSX.Element
  if (feeds.data) {
    const list = feeds.data.custom_feeds
    body =
      list.length > 0 ? (
        <>
          {list.map((feed) => (
            <SidebarLink
              key={feed.id}
              to={paths.customFeed(feed.username, feed.slug)}
              icon={<Rss strokeWidth={2.5} style={{ color: feedColor(feed.color) }} />}
              trailing={
                <span className={styles.trailing} title={t('social.feedNodes', { value: feed.node_count })}>
                  {feed.private && <Lock aria-label={t('social.privateFeed')} />}
                  {feed.node_count}
                </span>
              }
            >
              {feed.name}
            </SidebarLink>
          ))}
        </>
      ) : (
        <p className={styles.hint}>{t('social.customFeedsEmpty')}</p>
      )
  } else if (feeds.isError) {
    body = <SectionRetry onRetry={() => void feeds.refetch()} />
  } else {
    body = <SectionSkeleton />
  }

  return (
    <SidebarSection title={t('social.customFeeds')}>
      {body}
      <CreateCustomFeedButton />
    </SidebarSection>
  )
}

function feedColor(color: string | null | undefined): string | undefined {
  if (!color) return undefined
  return color.startsWith('#') ? color : `#${color}`
}

function SectionSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup>
      {[0.62, 0.48, 0.55].map((width, index) => (
        <div key={index} className={styles.skeletonRow}>
          <SkeletonCircle size={18} />
          <SkeletonLine width={width} />
        </div>
      ))}
    </SkeletonGroup>
  )
}

function SectionRetry({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <p className={styles.hint}>
      {t('social.loadFailed')}
      <button type="button" className={styles.retry} onClick={onRetry}>
        {t('common.retry')}
      </button>
    </p>
  )
}
