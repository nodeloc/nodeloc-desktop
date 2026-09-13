import { Eye, LockKeyhole, MessageCircle, Pin, Play, Ticket, Trophy } from 'lucide-react'
import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, type Location } from 'react-router'
import type { BasicUser, Category, TopicListItem } from '../../api/types'
import { IconButton } from '../../components/Button'
import { NodeIcon } from '../../components/NodeIcon'
import { cx } from '../../lib/cx'
import { absoluteUrl } from '../../lib/discourse'
import { formatCount, formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { decodeHtmlEntities } from '../../lib/text'
import { topicDetailState } from '../../lib/topic-detail-navigation'
import { VoteControl } from '../interactions/VoteControl'
import { UserAvatarButton } from '../profile/UserAvatarButton'
import type { ReadingMode } from './reading-mode-store'
import styles from './TopicItem.module.css'
import { useVisitedTopics } from './visited-store'

interface TopicItemProps {
  mode: ReadingMode
  topic: TopicListItem
  category?: Category
  author?: BasicUser
}

export function TopicItem({ mode, topic, category, author }: TopicItemProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const visited = useVisitedTopics((state) => state.visited.has(topic.id))
  const markVisited = useVisitedTopics((state) => state.markVisited)

  const unread =
    !visited &&
    (topic.unseen === true ||
      (topic.last_read_post_number != null &&
        topic.highest_post_number != null &&
        topic.last_read_post_number < topic.highest_post_number))

  const open = (): void => {
    markVisited(topic.id)
    navigate(paths.topic(topic.id), { state: topicDetailState(location) })
  }

  // Clicks on inner links and buttons keep their own behaviour.
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as Element).closest('a, button')) return
    open()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && event.target === event.currentTarget) open()
  }

  const shared = { topic, category, author, unread, onOpen: () => markVisited(topic.id), backgroundLocation: location }

  return (
    <article
      className={cx(styles.item, styles[mode])}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      aria-label={topic.title}
      // J/K keyboard navigation (features/shortcuts) steps through rows by this.
      data-topic-id={topic.id}
    >
      {mode === 'compact' && <CompactBody {...shared} />}
      {mode === 'expanded' && <ExpandedBody {...shared} />}
      {mode === 'card' && <CardBody {...shared} />}
    </article>
  )
}

interface BodyProps {
  topic: TopicListItem
  category?: Category
  author?: BasicUser
  unread: boolean
  onOpen: () => void
  backgroundLocation: Location
}

function Vote({ topic, horizontal = false }: { topic: TopicListItem; horizontal?: boolean }): React.JSX.Element | null {
  if (topic.op_vote_score === undefined || topic.op_post_id === undefined) return null
  return (
    <VoteControl
      postId={topic.op_post_id}
      orientation={horizontal ? 'horizontal' : 'vertical'}
      base={{
        score: topic.op_vote_score,
        count: topic.op_vote_count ?? 0,
        direction: topic.op_vote_direction ?? 'none',
        canVoteUp: topic.op_can_vote_up ?? false,
        canVoteDown: topic.op_can_vote_down ?? false
      }}
    />
  )
}

function Title(props: BodyProps & { clamp: number }): React.JSX.Element {
  const { topic, unread, onOpen, clamp } = props
  return (
    <h2 className={styles.title} style={{ WebkitLineClamp: clamp }}>
      {unread && <span className={styles.unreadDot} aria-hidden="true" />}
      {topic.has_read_permission_restriction && <LockKeyhole className={styles.inlineIcon} />}
      <Link
        to={paths.topic(topic.id)}
        state={topicDetailState(props.backgroundLocation)}
        className={styles.titleLink}
        onClick={onOpen}
        tabIndex={-1}
      >
        {topic.title}
      </Link>
    </h2>
  )
}

function Meta({
  topic,
  category,
  author,
  showAuthor = true,
  showAuthorAvatar = true
}: BodyProps & { showAuthor?: boolean; showAuthorAvatar?: boolean }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  return (
    <div className={styles.meta}>
      {category && (
        <Link to={paths.node(category.slug)} className={styles.category}>
          <NodeIcon
            name={category.name}
            color={category.color}
            logo={category.uploaded_logo}
            logoDark={category.uploaded_logo_dark}
            size={16}
          />
          n/{category.slug}
        </Link>
      )}
      {showAuthor && author && (
        <span className={styles.author}>
          {showAuthorAvatar && <UserAvatarButton user={author} size={18} reportTarget={{ kind: 'topic', topicId: topic.id }} />}
          <Link to={paths.user(author.username)} className={styles.authorName}>
            {author.username}
          </Link>
        </span>
      )}
      <time dateTime={topic.created_at} title={new Date(topic.created_at).toLocaleString(i18n.language)}>
        {formatRelativeTime(topic.created_at, i18n.language)}
      </time>
      {topic.pinned && (
        <span className={styles.chip} data-tone="accent">
          <Pin fill="currentColor" />
          {t('feed.pinned')}
        </span>
      )}
      {topic.is_featured && (
        <span className={styles.chip} data-tone="accent2">
          <Trophy />
          {t('feed.featured')}
        </span>
      )}
      {topic.lottery_status && (
        <span className={styles.chip} data-tone={topic.lottery_status === 'open' ? 'accent2' : 'neutral'}>
          <Ticket />
          {t(`lottery.${topic.lottery_status}`)}
        </span>
      )}
    </div>
  )
}

function Tags({ topic }: { topic: TopicListItem }): React.JSX.Element | null {
  if (!topic.tags?.length) return null
  return (
    <div className={styles.tags}>
      {topic.tags.slice(0, 4).map((tag) => {
        const name = typeof tag === 'string' ? tag : tag.name
        const slug = typeof tag === 'string' ? tag : tag.slug
        return (
          <Link key={name} to={paths.tag(slug)} className={styles.tag}>
            #{name}
          </Link>
        )
      })}
    </div>
  )
}

function Stats({ topic }: { topic: TopicListItem }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  return (
    <div className={styles.stats}>
      <span title={t('feed.replies', { count: topic.reply_count })}>
        <MessageCircle />
        {formatCount(Math.max(topic.posts_count - 1, 0), i18n.language)}
      </span>
      <span title={t('feed.views', { count: topic.views })}>
        <Eye />
        {formatCount(topic.views, i18n.language)}
      </span>
    </div>
  )
}

function CompactBody(props: BodyProps): React.JSX.Element {
  const { topic, author } = props
  return (
    <>
      <Vote topic={topic} />
      {author ? (
        <UserAvatarButton user={author} size={32} className={styles.compactAvatar} reportTarget={{ kind: 'topic', topicId: topic.id }} />
      ) : (
        <span className={styles.compactAvatar} />
      )}
      <div className={styles.body}>
        <Title {...props} clamp={1} />
        <div className={styles.compactFooter}>
          <Meta {...props} showAuthor showAuthorAvatar={false} />
          <Stats topic={topic} />
        </div>
      </div>
    </>
  )
}

function ExpandedBody(props: BodyProps): React.JSX.Element {
  const { topic } = props
  const thumbnail = topic.topic_thumbnails?.[0] ?? topic.image_url
  return (
    <>
      <Vote topic={topic} />
      <div className={styles.body}>
        <Meta {...props} />
        <Title {...props} clamp={2} />
        {topic.excerpt && <p className={styles.excerpt}>{decodeHtmlEntities(topic.excerpt)}</p>}
        <div className={styles.footer}>
          <Tags topic={topic} />
          <Stats topic={topic} />
        </div>
      </div>
      {thumbnail && (
        <img className={styles.thumbnail} src={absoluteUrl(thumbnail)} alt="" loading="lazy" draggable={false} />
      )}
    </>
  )
}

function CardBody(props: BodyProps): React.JSX.Element {
  const { topic } = props
  return (
    <div className={styles.body}>
      <Meta {...props} />
      <Title {...props} clamp={3} />
      <Tags topic={topic} />
      {topic.excerpt && <p className={styles.excerpt}>{decodeHtmlEntities(topic.excerpt)}</p>}
      <CardMedia topic={topic} />
      <div className={styles.footer}>
        <Vote topic={topic} horizontal />
        <Stats topic={topic} />
      </div>
    </div>
  )
}

function CardMedia({ topic }: { topic: TopicListItem }): React.JSX.Element | null {
  const { t } = useTranslation()
  const images = topic.topic_images?.length ? topic.topic_images : topic.image_url ? [topic.image_url] : []
  const [index, setIndex] = useState(0)
  if (images.length === 0) return null

  const hasVideo = Boolean(topic.topic_video_url)
  const step = (delta: number) => (event: MouseEvent) => {
    event.stopPropagation()
    setIndex((current) => (current + delta + images.length) % images.length)
  }

  return (
    <div className={styles.media}>
      <img src={absoluteUrl(images[index])} alt="" loading="lazy" draggable={false} />
      {hasVideo && (
        <span className={styles.play} aria-hidden="true">
          <Play fill="currentColor" />
        </span>
      )}
      {images.length > 1 && (
        <>
          <IconButton label={t('feed.previousImage')} className={cx(styles.mediaNav, styles.mediaPrev)} onClick={step(-1)}>
            ‹
          </IconButton>
          <IconButton label={t('feed.nextImage')} className={cx(styles.mediaNav, styles.mediaNext)} onClick={step(1)}>
            ›
          </IconButton>
          <span className={styles.mediaCounter}>
            {index + 1}/{images.length}
          </span>
        </>
      )}
    </div>
  )
}
