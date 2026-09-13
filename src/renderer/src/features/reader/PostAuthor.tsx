import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Post } from '../../api/types'
import { UserFlair } from '../../components/UserFlair'
import { cx } from '../../lib/cx'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { UserAvatarButton } from '../profile/UserAvatarButton'
import styles from './PostAuthor.module.css'

interface PostAuthorProps {
  post: Post
  size?: 'op' | 'reply'
  isOriginalPoster?: boolean
  /** Replies draw the avatar in their thread gutter instead. */
  showAvatar?: boolean
}

export function PostAuthor({ post, size = 'reply', isOriginalPoster = false, showAvatar = true }: PostAuthorProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const displayName = post.name && post.name.toLowerCase() !== post.username.toLowerCase() ? post.name : null
  const avatarSize = size === 'op' ? 40 : 28

  return (
    <div className={cx(styles.author, styles[size])}>
      {showAvatar && (
        <UserAvatarButton user={post} size={avatarSize} className={styles.avatarLink} tabIndex={-1} reportTarget={{ kind: 'post', post }} />
      )}
      <div className={styles.lines}>
        <div className={styles.nameLine}>
          <Link to={paths.user(post.username)} className={styles.username}>
            {displayName ?? post.username}
          </Link>
          {displayName && <span className={styles.handle}>@{post.username}</span>}
          <UserFlair flair={post} size={size === 'op' ? 18 : 15} />
          {post.user_title && <span className={styles.title}>{post.user_title}</span>}
          {isOriginalPoster && <span className={styles.badge} data-tone="accent">{t('reader.op')}</span>}
          {post.admin && <span className={styles.badge} data-tone="danger">{t('reader.admin')}</span>}
          {!post.admin && post.moderator && <span className={styles.badge} data-tone="accent2">{t('reader.moderator')}</span>}
          {!post.admin && !post.moderator && post.group_moderator && (
            <span className={styles.badge} data-tone="accent2">{t('reader.nodeModerator')}</span>
          )}
        </div>
        <div className={styles.metaLine}>
          <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString(i18n.language)}>
            {formatRelativeTime(post.created_at, i18n.language)}
          </time>
          {post.version > 1 && (
            <span title={new Date(post.updated_at).toLocaleString(i18n.language)}>· {t('reader.edited')}</span>
          )}
          <span className={styles.postNumber}>#{post.post_number}</span>
        </div>
      </div>
    </div>
  )
}
