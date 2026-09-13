import { CircleMinus, CirclePlus, FoldVertical } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Post } from '../../api/types'
import { cx } from '../../lib/cx'
import { paths } from '../../lib/routes'
import { PostContent } from '../content/PostContent'
import { useLocalPost } from '../interactions/post-overrides'
import { UserAvatarButton } from '../profile/UserAvatarButton'
import { DeletedNotice } from './DeletedNotice'
import { LotteryCard } from './LotteryCard'
import { PostActions } from './PostActions'
import { PostAuthor } from './PostAuthor'
import styles from './ReplyItem.module.css'
import type { ThreadRow } from './thread-tree'

/** Indentation stops here; deeper replies keep the same inset. */
export const MAX_VISUAL_DEPTH = 8

/**
 * Thread geometry, in px (mirrors ReplyItem.module.css). Each level indents
 * by the avatar plus its gap; a post's line runs down its avatar's centre.
 */
const AVATAR = 28
const INDENT = AVATAR + 8
const LINE_X = AVATAR / 2
/** Post rows: from the row top to the avatar's centre (post padding + half the avatar). */
const POST_ELBOW = 8 + AVATAR / 2
/** "More replies" rows: from the row top to the button's centre. */
const MORE_ELBOW = 18
/** A post's own line starts just below its avatar. */
const OWN_LINE_TOP = 8 + AVATAR + 4

type PostRow = Extract<ThreadRow, { type: 'post' }>
type MoreRow = Extract<ThreadRow, { type: 'more' }>

interface ThreadLinesProps {
  depth: number
  continues: boolean[]
  ancestorIds: number[]
  elbowHeight: number
  onCollapse: (postId: number) => void
}

/**
 * The web's "circuit" lines for one row: pass-through lines for ancestors
 * whose replies continue below, and a rounded connector from the parent's
 * line into this row, continuing down when later siblings follow. Every
 * line spans the row's full height so consecutive rows join up. Clicking a
 * line collapses the post it belongs to.
 */
function ThreadLines({ depth, continues, ancestorIds, elbowHeight, onCollapse }: ThreadLinesProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const visible = Math.min(depth, MAX_VISUAL_DEPTH)
  if (visible === 0) return null
  const flags = continues.slice(-visible)
  const ids = ancestorIds.slice(-visible)
  const parentX = (visible - 1) * INDENT + LINE_X

  const line = (key: string, column: number, top = 0): React.JSX.Element => (
    <button
      key={key}
      type="button"
      tabIndex={-1}
      className={styles.line}
      style={{ left: column * INDENT + LINE_X, top }}
      title={t('reader.collapse')}
      onClick={() => onCollapse(ids[column])}
    />
  )

  return (
    <div className={styles.lines} aria-hidden="true">
      {flags.slice(0, -1).map((continuesHere, column) => (continuesHere ? line(`a${column}`, column) : null))}
      <span className={styles.elbow} style={{ left: parentX, height: elbowHeight, width: INDENT - LINE_X - 2 }} />
      {/* Starts inside the elbow's curve so the two never show a seam. */}
      {flags[visible - 1] && line('next', visible - 1, elbowHeight - 10)}
    </div>
  )
}

function insetStyle(depth: number): CSSProperties {
  return { paddingLeft: Math.min(depth, MAX_VISUAL_DEPTH) * INDENT }
}

interface ReplyItemProps {
  row: PostRow
  topicOwnerId?: number
  highlighted?: boolean
  onToggle: (postId: number, collapsed: boolean) => void
}

/**
 * One reply in the thread: avatar gutter with circuit lines, author line,
 * body and actions. A collapsed reply shrinks to one line: ⊕ in place of the
 * avatar, the username and how much is hidden.
 */
export function ReplyItem({ row, topicOwnerId, highlighted = false, onToggle }: ReplyItemProps): React.JSX.Element {
  const { t } = useTranslation()
  const { post, collapsed, lowScore } = row
  const local = useLocalPost(post)
  const descendants = post.total_descendant_count ?? post.children?.length ?? 0
  // Deleted placeholders sent to non-staff carry ids and counts only, no author.
  const hasAuthor = typeof post.username === 'string'
  const ownX = Math.min(row.depth, MAX_VISUAL_DEPTH) * INDENT + LINE_X

  const toggleSelf = (): void => onToggle(post.id, !collapsed)

  const lines = (
    <ThreadLines
      depth={row.depth}
      continues={row.continues}
      ancestorIds={row.ancestorIds}
      elbowHeight={POST_ELBOW}
      onCollapse={(postId) => onToggle(postId, true)}
    />
  )

  if (collapsed) {
    const summary = lowScore
      ? t('reader.collapsedLowScore', { score: post.vote_score })
      : descendants > 0
        ? t('reader.collapsedReplies', { count: descendants })
        : t('reader.collapsedNoReplies')
    return (
      <div className={cx(styles.row, highlighted && styles.highlighted)} data-depth={row.depth}>
        <div className={styles.inner} style={insetStyle(row.depth)}>
          {lines}
          <article className={cx(styles.post, styles.collapsedPost)} id={`post-${post.post_number}`}>
            <button type="button" className={styles.collapsedRow} aria-expanded={false} title={t('reader.expand')} onClick={toggleSelf}>
              <span className={styles.expandIcon} aria-label={t('reader.expand')}>
                <CirclePlus />
              </span>
              <span className={styles.collapsedName}>{hasAuthor ? post.username : t('reader.deleted')}</span>
              <span className={styles.collapsedCount}>{summary}</span>
            </button>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={cx(styles.row, highlighted && styles.highlighted)} data-depth={row.depth}>
      <div className={styles.inner} style={insetStyle(row.depth)}>
        {lines}
        {row.hasChildren && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={styles.line}
              style={{ left: ownX, top: OWN_LINE_TOP }}
              title={t('reader.collapse')}
              onClick={toggleSelf}
            />
            {/* ⊖ where the post ends and its replies begin. */}
            <button
              type="button"
              className={styles.foldIcon}
              style={{ left: ownX, bottom: 2 }}
              aria-expanded
              aria-label={t('reader.collapse')}
              title={t('reader.collapse')}
              onClick={toggleSelf}
            >
              <CircleMinus />
            </button>
          </>
        )}
        <article className={styles.post} id={`post-${post.post_number}`} data-post-number={post.post_number}>
          <div className={styles.gutter}>
            {hasAuthor ? (
              <UserAvatarButton user={post} size={AVATAR} className={styles.avatar} tabIndex={-1} reportTarget={{ kind: 'post', post }} />
            ) : (
              <span className={styles.avatarPlaceholder} />
            )}
          </div>
          <div className={styles.main}>
            <div className={styles.head}>
              {hasAuthor ? (
                <PostAuthor post={post} showAvatar={false} isOriginalPoster={topicOwnerId !== undefined && post.user_id === topicOwnerId} />
              ) : (
                <span className={styles.deletedAuthor}>
                  {t('reader.deleted')} · #{post.post_number}
                </span>
              )}
              {hasAuthor && post.reply_to_user && row.depth === 0 && (
                <Link to={paths.topic(post.topic_id, post.reply_to_post_number ?? undefined)} className={styles.replyTo}>
                  {t('reader.replyTo', { username: post.reply_to_user.username })}
                </Link>
              )}
            </div>
            <div className={styles.body}>
              {local.deleted ? (
                <DeletedNotice post={post} />
              ) : (
                <>
                  <PostContent html={local.cooked} post={post} size="reply" />
                  {post.lottery && <LotteryCard lottery={post.lottery} />}
                  <PostActions post={post} />
                </>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

interface MoreRepliesRowProps {
  row: MoreRow
  onLoad: (parent: Post, depth: number) => void
  onToggle?: (postId: number, collapsed: boolean) => void
}

export function MoreRepliesRow({ row, onLoad, onToggle }: MoreRepliesRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const label = row.failed
    ? t('reader.loadRepliesFailed')
    : row.remaining > 0
      ? t('reader.moreReplies', { count: row.remaining })
      : t('reader.loadMoreReplies')

  return (
    <div className={styles.row} data-depth={row.depth}>
      <div className={cx(styles.inner, styles.moreInner)} style={insetStyle(row.depth)}>
        <ThreadLines
          depth={row.depth}
          continues={row.continues}
          ancestorIds={row.ancestorIds}
          elbowHeight={MORE_ELBOW}
          onCollapse={(postId) => onToggle?.(postId, true)}
        />
        <button type="button" className={styles.more} disabled={row.loading} onClick={() => onLoad(row.parent, row.depth)}>
          <FoldVertical />
          {row.loading ? t('reader.loadingMore') : label}
        </button>
      </div>
    </div>
  )
}
