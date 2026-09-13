import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Post, TopicView } from '../../api/types'
import { Spinner } from '../../components/Spinner'
import { paths } from '../../lib/routes'
import { PostContent } from '../content/PostContent'
import { useLocalPost } from '../interactions/post-overrides'
import { DeletedNotice } from './DeletedNotice'
import { LotteryCard } from './LotteryCard'
import { PostActions } from './PostActions'
import { PostAuthor } from './PostAuthor'
import { RedEnvelopeBanner } from './RedEnvelopeBanner'
import styles from './TopicHeader.module.css'

interface TopicHeaderProps {
  topic: TopicView
  op: Post
  /** Shown between the opening post and the replies (focused-thread notice). */
  notice?: ReactNode
  /** The replies are being reloaded (new sort order). */
  repliesLoading?: boolean
}

/**
 * The opening post and its tags, rendered as the reader list's header. The
 * title and topic actions sit in the reader toolbar; the node is in the sidebar.
 */
export function TopicHeader({ topic, op, notice, repliesLoading = false }: TopicHeaderProps): React.JSX.Element {
  const { t } = useTranslation()
  const local = useLocalPost(op)
  const replyCount = Math.max(topic.posts_count - 1, 0)

  return (
    <div className={styles.header}>
      <PostAuthor post={op} size="op" />

      {topic.tags && topic.tags.length > 0 && (
        <nav className={styles.tags}>
          {topic.tags.map((tag) => {
            const name = typeof tag === 'string' ? tag : tag.name
            const slug = typeof tag === 'string' ? tag : tag.slug
            return (
              <Link key={name} to={paths.tag(slug)} className={styles.tag}>
                #{name}
              </Link>
            )
          })}
        </nav>
      )}

      {local.deleted && <DeletedNotice post={op} variant="topic" />}

      {topic.red_envelope && <RedEnvelopeBanner envelope={topic.red_envelope} />}

      <div className={styles.body} data-post-number={1}>
        <PostContent html={local.cooked} post={op} size="body" />
      </div>

      {op.lottery && <LotteryCard lottery={op.lottery} />}

      <PostActions post={op} views={topic.views} topic={topic} />

      {notice}

      <div className={styles.repliesBar}>
        <h2>{replyCount > 0 ? t('reader.replies', { count: replyCount }) : t('reader.noReplies')}</h2>
        {repliesLoading && <Spinner size={16} />}
      </div>
    </div>
  )
}
