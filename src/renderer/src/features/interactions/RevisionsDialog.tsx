import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleAlert, EyeOff } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useCategoryIndex } from '../../api/site'
import type { Post } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button, IconButton } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { cx } from '../../lib/cx'
import { formatRelativeTime } from '../../lib/format'
import { PostContent } from '../content/PostContent'
import styles from './PostDialogs.module.css'

/** Core `PostRevisionSerializer`: one revision compared with the version before it. */
export interface PostRevision {
  created_at: string
  post_id: number
  previous_hidden: boolean
  current_hidden: boolean
  first_revision: number
  previous_revision: number | null
  current_revision: number
  next_revision: number | null
  last_revision: number
  current_version: number
  version_count: number
  username: string
  display_username: string
  acting_user_name?: string | null
  avatar_template: string
  edit_reason?: string | null
  /** HTML diffs from `DiscourseDiff`; null when the change is hidden or too large. */
  body_changes?: { inline: string; side_by_side: string; side_by_side_markdown: string } | null
  title_changes?: { inline: string; side_by_side: string } | null
  tags_changes?: { previous: string[] | null; current: string[] | null } | null
  category_id_changes?: { previous: number | null; current: number | null } | null
  can_edit: boolean
  diff_error?: boolean
}

type DiffView = 'inline' | 'markdown'

/**
 * Edit history: `GET /posts/:id/revisions/latest.json`, then
 * `/revisions/:n.json` (n ≥ 2) to step through. The diff HTML goes through
 * the same sanitizing renderer as post bodies.
 */
export function RevisionsDialog({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const index = useCategoryIndex()
  const [revision, setRevision] = useState<number | null>(null)
  const [view, setView] = useState<DiffView>('inline')

  const query = useQuery({
    queryKey: ['post-revisions', post.id, revision ?? 'latest'],
    queryFn: () =>
      apiRequest<PostRevision>({
        path: revision === null ? `/posts/${post.id}/revisions/latest.json` : `/posts/${post.id}/revisions/${revision}.json`,
        priority: 'user'
      }),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const data = query.data
  const go = (target: number | null | undefined): void => {
    if (target != null && target >= 2) setRevision(target)
  }
  const none = t('interactions.revisions.none')
  const nodeName = (id: number | null): string => (id == null ? none : (index?.byId.get(id)?.name ?? `#${id}`))
  const tagList = (tags: string[] | null): string => (tags?.length ? tags.map((tag) => `#${tag}`).join(' ') : none)

  let content: React.ReactNode
  if (!data) {
    content = query.isError ? (
      <EmptyState
        icon={<CircleAlert />}
        title={errorMessage(query.error)}
        action={<Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>}
      />
    ) : (
      <div className={styles.state}>
        <Spinner size={28} />
      </div>
    )
  } else {
    const hidden = !data.body_changes && !data.diff_error && (data.previous_hidden || data.current_hidden)
    content = (
      <div className={cx(styles.form, query.isPlaceholderData && styles.loading)}>
        <div className={styles.nav}>
          <IconButton
            label={t('interactions.revisions.first')}
            size="sm"
            disabled={data.current_revision <= data.first_revision}
            onClick={() => go(data.first_revision)}
          >
            <ChevronsLeft />
          </IconButton>
          <IconButton
            label={t('interactions.revisions.previous')}
            size="sm"
            disabled={!data.previous_revision}
            onClick={() => go(data.previous_revision)}
          >
            <ChevronLeft />
          </IconButton>
          <span className={styles.position}>
            {t('interactions.revisions.position', {
              from: data.current_version - 1,
              to: data.current_version,
              total: data.version_count
            })}
          </span>
          <IconButton
            label={t('interactions.revisions.next')}
            size="sm"
            disabled={!data.next_revision}
            onClick={() => go(data.next_revision)}
          >
            <ChevronRight />
          </IconButton>
          <IconButton
            label={t('interactions.revisions.last')}
            size="sm"
            disabled={data.current_revision >= data.last_revision}
            onClick={() => go(data.last_revision)}
          >
            <ChevronsRight />
          </IconButton>
          <span className={styles.spacer} />
          {data.body_changes && (
            <div className={styles.segmented} role="radiogroup" aria-label={t('interactions.revisions.view')}>
              {(['inline', 'markdown'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={view === option}
                  className={cx(styles.segment, view === option && styles.segmentActive)}
                  onClick={() => setView(option)}
                >
                  {t(`interactions.revisions.${option}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.meta}>
          <Avatar template={data.avatar_template} username={data.display_username} size={24} />
          <span>
            {t('interactions.revisions.editedBy', {
              username: data.display_username,
              time: formatRelativeTime(data.created_at, i18n.language)
            })}
          </span>
        </div>
        {data.edit_reason && <p className={styles.muted}>{t('interactions.revisions.reason', { reason: data.edit_reason })}</p>}

        {data.title_changes && (
          <section className={styles.change}>
            <h3 className={styles.changeLabel}>{t('interactions.revisions.titleLabel')}</h3>
            <PostContent html={data.title_changes.inline} size="reply" className={styles.diff} />
          </section>
        )}
        {data.category_id_changes && (
          <section className={styles.change}>
            <h3 className={styles.changeLabel}>{t('interactions.revisions.node')}</h3>
            <p className={styles.changeValue}>
              <del>{nodeName(data.category_id_changes.previous)}</del> → {nodeName(data.category_id_changes.current)}
            </p>
          </section>
        )}
        {data.tags_changes && (
          <section className={styles.change}>
            <h3 className={styles.changeLabel}>{t('interactions.revisions.tags')}</h3>
            <p className={styles.changeValue}>
              <del>{tagList(data.tags_changes.previous)}</del> → {tagList(data.tags_changes.current)}
            </p>
          </section>
        )}

        {hidden ? (
          <p className={styles.notice}>
            <EyeOff />
            {t('interactions.revisions.hidden')}
          </p>
        ) : data.diff_error ? (
          <p className={styles.notice}>
            <CircleAlert />
            {t('interactions.revisions.tooComplex')}
          </p>
        ) : data.body_changes ? (
          <section className={styles.change}>
            <h3 className={styles.changeLabel}>{t('interactions.revisions.body')}</h3>
            <PostContent
              key={`${data.current_revision}-${view}`}
              html={view === 'inline' ? data.body_changes.inline : data.body_changes.side_by_side_markdown}
              size="reply"
              className={styles.diff}
            />
          </section>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('interactions.revisions.title')} width={760}>
      {content}
    </Dialog>
  )
}
