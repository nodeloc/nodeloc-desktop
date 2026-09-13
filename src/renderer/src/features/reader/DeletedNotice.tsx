import { RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Post } from '../../api/types'
import { Button } from '../../components/Button'
import { PostContent } from '../content/PostContent'
import { useLocalPost } from '../interactions/post-overrides'
import { useRecoverPost } from '../interactions/use-post-management'
import styles from './DeletedNotice.module.css'

/**
 * Core's deleted-post states. Nested views send soft-deleted replies as
 * `deleted_post_placeholder` (content stripped unless you're staff); an
 * author's own delete is `user_deleted` with the "deleted by author" text.
 * Recover when `can_recover`, or right after deleting it here.
 */
export function DeletedNotice({ post, variant = 'reply' }: { post: Post; variant?: 'reply' | 'topic' }): React.JSX.Element {
  const { t } = useTranslation()
  const local = useLocalPost(post)
  const recover = useRecoverPost()
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)

  const byAuthor = !local.deletedHere && post.user_deleted && !post.deleted_at
  const label = variant === 'topic' ? t('reader.deletedTopic') : byAuthor ? t('reader.deletedByAuthor') : t('reader.deletedReply')
  // Staff get the soft-deleted post in full; everyone else gets an empty body.
  const canPeek = variant === 'reply' && !byAuthor && !local.deletedHere && Boolean(post.cooked)
  const canRecover = Boolean(post.can_recover) || (local.deletedHere && post.can_delete)

  return (
    <div className={styles.notice}>
      <div className={styles.bar}>
        <Trash2 />
        <span className={styles.label}>{label}</span>
        {canPeek && (
          <Button variant="ghost" size="sm" onClick={() => setShown((value) => !value)}>
            {shown ? t('reader.hideDeleted') : t('reader.showDeleted')}
          </Button>
        )}
        {canRecover && (
          <Button
            size="sm"
            icon={<RotateCcw />}
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await recover(post)
              setBusy(false)
            }}
          >
            {t('interactions.manage.recover')}
          </Button>
        )}
      </div>
      {shown && <PostContent html={post.cooked} post={post} size="reply" className={styles.content} />}
    </div>
  )
}
