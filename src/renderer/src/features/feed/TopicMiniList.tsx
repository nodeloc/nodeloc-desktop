import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import type { TopicListItem } from '../../api/types'
import { NodeIcon } from '../../components/NodeIcon'
import { cx } from '../../lib/cx'
import { absoluteUrl } from '../../lib/discourse'
import { formatCount, formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './TopicMiniList.module.css'

/** What a side-panel topic row shows. Missing fields are simply left out. */
export interface TopicMiniItem {
  id: number
  title: string
  categoryId?: number
  createdAt?: string
  likeCount?: number
  replyCount?: number
  imageUrl?: string | null
  /** Posts since the last read one; only known for topics the account has read. */
  unread?: number
}

export function toTopicMiniItem(topic: TopicListItem): TopicMiniItem {
  const lastRead = topic.last_read_post_number
  return {
    id: topic.id,
    title: topic.title,
    categoryId: topic.category_id ?? undefined,
    createdAt: topic.created_at,
    likeCount: topic.like_count,
    replyCount: Math.max(topic.posts_count - 1, 0),
    imageUrl: topic.topic_thumbnails?.[0] ?? topic.image_url,
    unread: lastRead != null ? Math.max((topic.highest_post_number ?? 0) - lastRead, 0) : undefined
  }
}

/**
 * Compact topic rows for side panels (recently viewed, related topics): node
 * and age, title, likes · replies · new replies, and a thumbnail. Meant to sit
 * directly inside a `PanelCard`; rows run edge to edge with dividers.
 */
export function TopicMiniList({ items }: { items: readonly TopicMiniItem[] }): React.JSX.Element {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id}>
          <TopicMiniRow item={item} />
        </li>
      ))}
    </ul>
  )
}

function TopicMiniRow({ item }: { item: TopicMiniItem }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const index = useCategoryIndex()
  const category = item.categoryId !== undefined ? index?.byId.get(item.categoryId) : undefined
  const unread = item.unread ?? 0
  const hasStats = item.likeCount !== undefined || item.replyCount !== undefined

  return (
    <Link to={paths.topic(item.id)} className={styles.row}>
      <span className={styles.main}>
        {(category || item.createdAt) && (
          <span className={styles.source}>
            {category && (
              <>
                <NodeIcon
                  name={category.name}
                  color={category.color}
                  logo={category.uploaded_logo}
                  logoDark={category.uploaded_logo_dark}
                  size={20}
                  shape="circle"
                />
                <span className={styles.node}>{category.name}</span>
              </>
            )}
            {item.createdAt && (
              <span className={styles.time}>
                {category && ' · '}
                {formatRelativeTime(item.createdAt, i18n.language)}
              </span>
            )}
          </span>
        )}
        <span className={cx(styles.title, unread > 0 && styles.titleUnread)}>{item.title}</span>
        {(hasStats || unread > 0) && (
          <span className={styles.stats}>
            {item.likeCount !== undefined && <span>{t('topicStats.likes', { count: formatCount(item.likeCount, i18n.language) })}</span>}
            {item.replyCount !== undefined && <span>{t('topicStats.replies', { count: formatCount(item.replyCount, i18n.language) })}</span>}
            {unread > 0 && <span className={styles.unread}>{t('topicStats.newReplies', { count: unread })}</span>}
          </span>
        )}
      </span>
      {item.imageUrl && <img className={styles.thumbnail} src={absoluteUrl(item.imageUrl)} alt="" loading="lazy" draggable={false} />}
    </Link>
  )
}
