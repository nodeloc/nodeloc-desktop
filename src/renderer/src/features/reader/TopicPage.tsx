import { ArrowLeft, CircleAlert, LockKeyhole, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { Virtuoso } from 'react-virtuoso'
import { isApiErrorKind } from '../../api/client'
import { useSite } from '../../api/site'
import type { NestedSort, Post, TopicListItem, TopicResponse, TopicView } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { paths } from '../../lib/routes'
import { useVisitedTopics } from '../feed/visited-store'
import { useReadTracker } from '../interactions/use-read-tracker'
import { ReaderSkeleton } from './ReaderSkeleton'
import { ReaderFrame } from './ReaderFrame'
import { useActiveTopic, useReaderSort } from './reader-store'
import { MoreRepliesRow, ReplyItem } from './ReplyItem'
import { SortSelect } from './SortSelect'
import { flattenThread, mergePosts, type ChildState, type ThreadRow } from './thread-tree'
import { TopicHeader } from './TopicHeader'
import styles from './TopicPage.module.css'
import { fetchChildren, isFlatTopicResponse, useFlatTopic, useNestedTopic, useTopicContext } from './use-topic'
import { useTopicRealtime } from './use-topic-realtime'

/** Stable empty list, so store updates don't fire on every render. */
const NO_TOPICS: TopicListItem[] = []

export function TopicPage(): React.JSX.Element {
  const { topicId: topicParam, postNumber: postParam } = useParams()
  const topicId = Number(topicParam)
  const postNumber = postParam ? Number(postParam) : undefined
  const markVisited = useVisitedTopics((state) => state.markVisited)

  useEffect(() => {
    if (Number.isInteger(topicId)) markVisited(topicId)
  }, [topicId, markVisited])

  if (!Number.isInteger(topicId) || (postParam && !Number.isInteger(postNumber))) return <NotFoundPage />

  return postNumber && postNumber > 1 ? (
    <FocusedThread key={`${topicId}-${postNumber}`} topicId={topicId} postNumber={postNumber} />
  ) : (
    <NestedTopic key={topicId} topicId={topicId} />
  )
}

// ---------------------------------------------------------------------------
// Shared thread state

function useThreadState(topicId: number, sort: NestedSort | null) {
  const [toggles, setToggles] = useState<ReadonlyMap<number, boolean>>(new Map())
  const [childState, setChildState] = useState<Readonly<Record<number, ChildState>>>({})
  // Replies loaded on demand belong to one sort order; start over when it changes.
  const [childSort, setChildSort] = useState(sort)
  if (childSort !== sort) {
    setChildSort(sort)
    setChildState({})
  }

  const toggle = useCallback((postId: number, collapsed: boolean) => {
    setToggles((current) => new Map(current).set(postId, collapsed))
  }, [])

  const loadChildren = useCallback(
    async (parent: Post, depth: number) => {
      let page = 0
      setChildState((current) => {
        const state = current[parent.id]
        page = state?.nextPage ?? 0
        return {
          ...current,
          [parent.id]: { posts: state?.posts ?? [], nextPage: page, loading: true, failed: false }
        }
      })
      try {
        const response = await fetchChildren(topicId, parent.post_number, sort, page, depth)
        setChildState((current) => {
          const state = current[parent.id]
          return {
            ...current,
            [parent.id]: {
              posts: mergePosts(state?.posts.length ? state.posts : (parent.children ?? []), response.children),
              nextPage: response.has_more ? page + 1 : null,
              loading: false,
              failed: false
            }
          }
        })
      } catch {
        setChildState((current) => {
          const state = current[parent.id]
          return { ...current, [parent.id]: { posts: state?.posts ?? [], nextPage: page, loading: false, failed: true } }
        })
      }
    },
    [topicId, sort]
  )

  return { toggles, childState, toggle, loadChildren }
}

function usePublishActiveTopic(topic: TopicView | undefined, op: Post | undefined, related: TopicListItem[]): void {
  const set = useActiveTopic((state) => state.set)
  const clear = useActiveTopic((state) => state.clear)
  useEffect(() => {
    if (topic && op) set(topic, op, related)
  }, [topic, op, related, set])
  useEffect(() => {
    if (!topic) return
    return () => clear(topic.id)
  }, [topic, clear])
}

interface ListContext {
  header: ReactNode
  footer: ReactNode
}

const ListHeader = ({ context }: { context?: ListContext }): ReactNode => context?.header ?? null
const ListFooter = ({ context }: { context?: ListContext }): ReactNode => context?.footer ?? null

function ThreadList({
  topicId,
  rows,
  header,
  footer,
  topicOwnerId,
  highlightPostNumber,
  initialIndex,
  onToggle,
  onLoadChildren,
  onEndReached,
  notice,
  refreshing = false
}: {
  topicId: number
  rows: ThreadRow[]
  header: ReactNode
  footer: ReactNode
  topicOwnerId?: number
  highlightPostNumber?: number
  initialIndex?: number
  onToggle: (postId: number, collapsed: boolean) => void
  onLoadChildren: (parent: Post, depth: number) => void
  onEndReached?: () => void
  /** Floats over the top of the list (live update prompts). */
  notice?: ReactNode
  /** Re-sorting: the current replies stay, dimmed and inert, until the new order arrives. */
  refreshing?: boolean
}): React.JSX.Element {
  const tracked = useRef<HTMLDivElement>(null)
  useReadTracker(topicId, tracked)

  return (
    <div ref={tracked} className={styles.tracked} data-refreshing={refreshing} aria-busy={refreshing || undefined}>
      {notice}
      <Virtuoso
        className={styles.scroller}
        data={rows}
        context={{ header, footer }}
        components={{ Header: ListHeader, Footer: ListFooter }}
        computeItemKey={(_index, row) => row.key}
        increaseViewportBy={{ top: 800, bottom: 1600 }}
        initialTopMostItemIndex={initialIndex !== undefined ? { index: initialIndex, align: 'center' } : undefined}
        endReached={onEndReached}
        itemContent={(_index, row) =>
          row.type === 'post' ? (
            <ReplyItem
              row={row}
              topicOwnerId={topicOwnerId}
              highlighted={row.post.post_number === highlightPostNumber}
              onToggle={onToggle}
            />
          ) : (
            <MoreRepliesRow row={row} onLoad={onLoadChildren} onToggle={onToggle} />
          )
        }
      />
    </div>
  )
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  if (isApiErrorKind(error, 'notFound')) return <NotFoundPage />
  const locked = isApiErrorKind(error, 'unauthorized', 'forbidden')
  return (
    <EmptyState
      icon={locked ? <LockKeyhole /> : isApiErrorKind(error, 'offline') ? <WifiOff /> : <CircleAlert />}
      title={locked ? t('reader.signInRequired') : errorMessage(error)}
      action={
        locked ? undefined : (
          <Button variant="primary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Whole topic, nested replies

function NestedTopic({ topicId }: { topicId: number }): React.JSX.Element {
  const { t } = useTranslation()
  const sort = useReaderSort((state) => state.sort)
  const setSort = useReaderSort((state) => state.setSort)
  const threshold = useSite().data?.vote_collapse_score_threshold
  const nested = useNestedTopic(topicId, sort)
  const { toggles, childState, toggle, loadChildren } = useThreadState(topicId, sort)

  // Private messages may return 404 or redirect to /t and return a post stream.
  const response = nested.data?.pages[0]
  const flatResponse = isFlatTopicResponse(response) ? response : undefined
  const useFlat = Boolean(flatResponse) || (nested.isError && isApiErrorKind(nested.error, 'notFound'))

  const firstPage = isFlatTopicResponse(response) ? undefined : response
  const lastPage = nested.data?.pages[nested.data.pages.length - 1]
  const roots = useMemo(() => nested.data?.pages.flatMap((page) => isFlatTopicResponse(page) ? [] : page.roots) ?? [], [nested.data])
  const rows = useMemo(
    () => flattenThread(roots, { toggles, childState, collapseThreshold: threshold }),
    [roots, toggles, childState, threshold]
  )
  const related = useMemo(() => lastPage?.related_topics ?? lastPage?.suggested_topics ?? NO_TOPICS, [lastPage])
  usePublishActiveTopic(firstPage?.topic, firstPage?.op_post, related)
  const live = useTopicRealtime(useFlat ? undefined : firstPage?.topic)

  if (useFlat) return <FlatTopic topicId={topicId} initialData={flatResponse} />
  if (nested.isPending) {
    return (
      <ReaderFrame>
        <ReaderSkeleton />
      </ReaderFrame>
    )
  }
  if (!firstPage?.topic || !firstPage.op_post) {
    return (
      <ReaderFrame>
        <LoadError error={nested.error} onRetry={() => void nested.refetch()} />
      </ReaderFrame>
    )
  }

  const { topic, op_post: op } = firstPage
  const effectiveSort = sort ?? firstPage.effective_sort ?? firstPage.sort ?? 'top'

  const footer = (
    <div className={styles.footer}>
      {nested.isFetchingNextPage && <Spinner size={24} />}
      {nested.isFetchNextPageError && (
        <Button size="sm" onClick={() => void nested.fetchNextPage()}>
          {t('reader.loadMoreFailed')} · {t('common.retry')}
        </Button>
      )}
      {!nested.hasNextPage && rows.length > 0 && <span className={styles.end}>{t('reader.endOfReplies')}</span>}
    </div>
  )

  return (
    <ReaderFrame topic={topic} controls={topic.posts_count > 1 ? <SortSelect value={effectiveSort} onChange={setSort} /> : undefined}>
    <ThreadList
      topicId={topicId}
      rows={rows}
      header={<TopicHeader topic={topic} op={op} repliesLoading={nested.isPlaceholderData} />}
      refreshing={nested.isPlaceholderData}
      footer={footer}
      topicOwnerId={op.user_id}
      notice={
        live.newReplies > 0 ? (
          <button type="button" className={styles.newReplies} onClick={live.acknowledge}>
            {t('reader.newReplies', { count: live.newReplies })}
          </button>
        ) : undefined
      }
      onToggle={toggle}
      onLoadChildren={(parent, depth) => void loadChildren(parent, depth)}
      onEndReached={() => {
        if (nested.hasNextPage && !nested.isPlaceholderData && !nested.isFetchingNextPage && !nested.isFetchNextPageError) {
          void nested.fetchNextPage()
        }
      }}
    />
    </ReaderFrame>
  )
}

// ---------------------------------------------------------------------------
// One reply's conversation (deep links to a post number)

function FocusedThread({ topicId, postNumber }: { topicId: number; postNumber: number }): React.JSX.Element {
  const { t } = useTranslation()
  const sort = useReaderSort((state) => state.sort)
  const threshold = useSite().data?.vote_collapse_score_threshold
  const context = useTopicContext(topicId, postNumber)
  const { toggles, childState, toggle, loadChildren } = useThreadState(topicId, sort)

  const data = isFlatTopicResponse(context.data) ? undefined : context.data
  const rows = useMemo(() => {
    if (!data) return []
    const ancestors = data.ancestor_chain ?? []
    const ancestorRows: ThreadRow[] = ancestors.map((post, index) => ({
      type: 'post',
      key: `a${post.id}`,
      post,
      depth: index,
      ancestorIds: ancestors.slice(0, index).map((ancestor) => ancestor.id),
      // A single chain: each ancestor is the only one shown, and leads to the next row.
      continues: Array.from({ length: index }, () => false),
      hasChildren: true,
      collapsed: false,
      lowScore: false
    }))
    const thread = flattenThread([data.target_post], {
      toggles,
      childState,
      collapseThreshold: threshold,
      baseDepth: ancestors.length,
      baseAncestors: ancestors.map((ancestor) => ancestor.id)
    })
    return [...ancestorRows, ...thread]
  }, [data, toggles, childState, threshold])

  usePublishActiveTopic(data?.topic, data?.op_post, data?.related_topics ?? NO_TOPICS)

  // A focused flat response may omit the opening post; load the whole stream.
  if (isFlatTopicResponse(context.data)) return <FlatTopic topicId={topicId} />
  if (context.isPending) {
    return (
      <ReaderFrame>
        <ReaderSkeleton />
      </ReaderFrame>
    )
  }
  // If the post can't be focused (deleted, or no nested view), fall back to the whole topic.
  if (context.isError && isApiErrorKind(context.error, 'notFound')) return <NestedTopic topicId={topicId} />
  if (context.isError || !data) {
    return (
      <ReaderFrame>
        <LoadError error={context.error} onRetry={() => void context.refetch()} />
      </ReaderFrame>
    )
  }

  const notice = (
    <div className={styles.focusNotice}>
      <span>{t('reader.focused', { postNumber })}</span>
      <Link to={paths.topic(topicId)} className={styles.focusLink}>
        <ArrowLeft />
        {t('reader.viewWholeTopic')}
      </Link>
    </div>
  )

  return (
    <ReaderFrame topic={data.topic}>
      <ThreadList
        topicId={topicId}
        rows={rows}
        header={<TopicHeader topic={data.topic} op={data.op_post} notice={notice} />}
        footer={<div className={styles.footer} />}
        topicOwnerId={data.op_post.user_id}
        highlightPostNumber={postNumber}
        initialIndex={Math.max(0, (data.ancestor_chain?.length ?? 0))}
        onToggle={toggle}
        onLoadChildren={(parent, depth) => void loadChildren(parent, depth)}
      />
    </ReaderFrame>
  )
}

// ---------------------------------------------------------------------------
// Chronological fallback

function FlatTopic({ topicId, initialData }: { topicId: number; initialData?: TopicResponse }): React.JSX.Element {
  const { t } = useTranslation()
  const { first, more, hasRemaining } = useFlatTopic(topicId, true, initialData)

  const posts = useMemo(() => {
    const initial = first.data?.post_stream.posts ?? []
    const extra = more.data?.pages.flatMap((page) => page.post_stream.posts) ?? []
    return mergePosts(initial, extra)
  }, [first.data, more.data])

  const op = posts.find((post) => post.post_number === 1)
  const rows = useMemo<ThreadRow[]>(
    () =>
      posts
        .filter((post) => post.post_number !== 1)
        .map((post) => ({
          type: 'post',
          key: `f${post.id}`,
          post,
          depth: 0,
          ancestorIds: [],
          continues: [],
          hasChildren: false,
          collapsed: false,
          lowScore: false
        })),
    [posts]
  )

  usePublishActiveTopic(first.data, op, first.data?.related_topics ?? first.data?.suggested_topics ?? NO_TOPICS)

  if (first.isPending) {
    return (
      <ReaderFrame>
        <ReaderSkeleton />
      </ReaderFrame>
    )
  }
  if (first.isError || !first.data) {
    return (
      <ReaderFrame>
        <LoadError error={first.error} onRetry={() => void first.refetch()} />
      </ReaderFrame>
    )
  }
  if (!op) {
    return (
      <ReaderFrame topic={first.data}>
        <EmptyState icon={<CircleAlert />} title={t('reader.privateTopic')} />
      </ReaderFrame>
    )
  }

  const canLoadMore = hasRemaining && (more.data ? more.hasNextPage : true)
  const footer = (
    <div className={styles.footer}>
      {more.isFetching && <Spinner size={24} />}
      {!more.isFetching && canLoadMore && (
        <Button size="sm" onClick={() => void (more.data ? more.fetchNextPage() : more.refetch())}>
          {t('reader.loadMoreReplies')}
        </Button>
      )}
      {!canLoadMore && rows.length > 0 && <span className={styles.end}>{t('reader.endOfReplies')}</span>}
    </div>
  )

  return (
    <ReaderFrame topic={first.data}>
      <ThreadList
        topicId={topicId}
        rows={rows}
        header={<TopicHeader topic={first.data} op={op} />}
        footer={footer}
        topicOwnerId={op.user_id}
        onToggle={() => undefined}
        onLoadChildren={() => undefined}
      />
    </ReaderFrame>
  )
}
