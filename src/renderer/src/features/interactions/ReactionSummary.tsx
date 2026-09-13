import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiRequest } from '../../api/client'
import type { Reaction, ReactionUsersResponse } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Spinner } from '../../components/Spinner'
import { paths } from '../../lib/routes'
import { emojiUrl, useEmojiIndex } from '../content/use-emoji'
import styles from './ReactionSummary.module.css'

const MAX_SUMMARY_EMOJI = 3
const PAGE_SIZE = 20

interface ReactionSummaryProps {
  postId: number
  reactions: Reaction[]
  total: number
}

/** The web client shows at most three reaction emoji, ordered by usage. */
export function ReactionSummary({ postId, reactions, total }: ReactionSummaryProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const emoji = useEmojiIndex()
  const [open, setOpen] = useState(false)
  const visible = useMemo(
    () => [...reactions].filter((reaction) => reaction.count > 0).sort(compareReactions).slice(0, MAX_SUMMARY_EMOJI),
    [reactions]
  )

  if (total <= 0 || visible.length === 0) return null

  return (
    <>
      <button
        type="button"
        className={styles.summary}
        aria-label={t('interactions.reactions.open', { count: total })}
        title={t('interactions.reactions.open', { count: total })}
        data-reaction-summary
        onClick={() => setOpen(true)}
      >
        {visible.map((reaction) => (
          <img key={reaction.id} src={emojiUrl(emoji, reaction.id)} alt={`:${reaction.id}:`} draggable={false} />
        ))}
      </button>
      <ReactionDetailsDialog postId={postId} reactions={reactions} total={total} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function compareReactions(a: Reaction, b: Reaction): number {
  return b.count - a.count || a.id.localeCompare(b.id)
}

function ReactionDetailsDialog({
  postId,
  reactions,
  total,
  open,
  onClose
}: ReactionSummaryProps & { open: boolean; onClose: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const emoji = useEmojiIndex()
  const ordered = useMemo(() => [...reactions].filter((reaction) => reaction.count > 0).sort(compareReactions), [reactions])
  const [filter, setFilter] = useState<string | null>(null)
  const users = useInfiniteQuery({
    queryKey: ['post-reaction-users', postId, filter ?? 'all'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiRequest<ReactionUsersResponse>({
        path: `/discourse-reactions/posts/${postId}/reactions-users-list.json`,
        query: { page: pageParam, limit: PAGE_SIZE, reaction_value: filter ?? undefined },
        priority: 'user'
      }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.users.length, 0)
      return loaded < lastPage.total_rows ? pages.length : undefined
    },
    enabled: open,
    staleTime: 60_000
  })
  const rows = users.data?.pages.flatMap((page) => page.users) ?? []
  const selectedTotal = filter ? (ordered.find((reaction) => reaction.id === filter)?.count ?? 0) : total

  return (
    <Dialog open={open} onClose={onClose} title={t('interactions.reactions.title', { count: selectedTotal })} width={420}>
      {ordered.length > 1 && (
        <div className={styles.filters} role="tablist" aria-label={t('interactions.reactions.filter')}>
          <button type="button" role="tab" aria-selected={filter === null} className={styles.filter} onClick={() => setFilter(null)}>
            {t('interactions.reactions.all')}
          </button>
          {ordered.map((reaction) => (
            <button
              key={reaction.id}
              type="button"
              role="tab"
              aria-selected={filter === reaction.id}
              className={styles.filter}
              data-reaction-filter={reaction.id}
              onClick={() => setFilter(reaction.id)}
            >
              <img src={emojiUrl(emoji, reaction.id)} alt={`:${reaction.id}:`} draggable={false} />
              <span>{reaction.count}</span>
            </button>
          ))}
        </div>
      )}

      {users.isPending ? (
        <div className={styles.status}><Spinner size={24} /></div>
      ) : users.isError ? (
        <div className={styles.status}>
          <span>{t('interactions.reactions.loadFailed')}</span>
          <Button size="sm" onClick={() => void users.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.status}>{t('interactions.reactions.empty')}</div>
      ) : (
        <div className={styles.users}>
          {rows.map((user) => (
            <Link key={`${filter ?? 'all'}-${user.id}-${user.reaction}`} to={paths.user(user.username)} className={styles.user} onClick={onClose}>
              <Avatar template={user.avatar_template} username={user.username} size={36} />
              <span className={styles.identity}>
                <strong>{user.name || user.username}</strong>
                {user.name && <span>@{user.username}</span>}
              </span>
              <img className={styles.userReaction} src={emojiUrl(emoji, user.reaction)} alt={`:${user.reaction}:`} draggable={false} />
            </Link>
          ))}
          {users.hasNextPage && (
            <Button size="sm" disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
              {users.isFetchingNextPage ? <Spinner size={14} /> : t('interactions.reactions.loadMore')}
            </Button>
          )}
        </div>
      )}
    </Dialog>
  )
}
