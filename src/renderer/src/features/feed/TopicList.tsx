import { CircleAlert, LockKeyhole, MessagesSquare, RotateCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso } from 'react-virtuoso'
import { isApiErrorKind } from '../../api/client'
import { useCategoryIndex } from '../../api/site'
import { useErrorMessage } from '../../api/use-error-message'
import { Button, IconButton } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { ReadingModeSwitch } from './ReadingModeSwitch'
import { useAccountReadingMode, useReadingMode } from './reading-mode-store'
import type { TopicListSource } from './topic-list-source'
import styles from './TopicList.module.css'
import { TopicItem } from './TopicItem'
import { TopicRowSkeleton } from './TopicRowSkeleton'
import { useTopicList } from './use-topic-list'

interface TopicListProps {
  source: TopicListSource
  title: ReactNode
  /** Replaces the visible title at the start of the toolbar (e.g. a node's view tabs); the title stays for assistive tech. */
  nav?: ReactNode
  /** Extra toolbar controls, placed before the reading mode switch. */
  actions?: ReactNode
  /** Rendered above the first topic, scrolling with the list (node banner, tag header…). */
  header?: ReactNode
  emptyTitle?: string
  /** Hide the node chip when every topic belongs to the same node. */
  showCategory?: boolean
}

interface ListContext {
  header?: ReactNode
  footer: ReactNode
}

const ListHeader = ({ context }: { context?: ListContext }): ReactNode => context?.header ?? null
const ListFooter = ({ context }: { context?: ListContext }): ReactNode => context?.footer ?? null

/** A virtualized, infinitely loading topic list with the standard toolbar and states. */
export function TopicList({ source, title, nav, actions, header, emptyTitle, showCategory = true }: TopicListProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const list = useTopicList(source)
  const categories = useCategoryIndex()
  const mode = useReadingMode((state) => state.mode)
  useAccountReadingMode()

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = list
  const hasTopics = list.topics.length > 0

  const toolbar = (
    <header className={styles.toolbar}>
      {nav ? (
        <>
          <h1 className={styles.visuallyHidden}>{title}</h1>
          {nav}
        </>
      ) : (
        <h1 className={styles.title}>{title}</h1>
      )}
      <div className={styles.actions}>
        {actions}
        <ReadingModeSwitch />
        <IconButton label={t('feed.refresh')} onClick={() => void list.refetch()} disabled={list.isFetching}>
          {list.isRefetching && !isFetchingNextPage ? <Spinner size={18} /> : <RotateCw />}
        </IconButton>
      </div>
    </header>
  )

  let body: ReactNode
  if (list.isPending) {
    body = (
      <div className={styles.scroller}>
        {header}
        <TopicRowSkeleton count={10} />
      </div>
    )
  } else if (list.isError && !hasTopics) {
    const needsSignIn = isApiErrorKind(list.error, 'unauthorized', 'forbidden')
    body = (
      <div className={styles.scroller}>
        {header}
        <EmptyState
          icon={needsSignIn ? <LockKeyhole /> : isApiErrorKind(list.error, 'offline') ? <WifiOff /> : <CircleAlert />}
          title={needsSignIn ? t('feed.signInRequired') : errorMessage(list.error)}
          action={
            needsSignIn ? undefined : (
              <Button variant="primary" onClick={() => void list.refetch()}>
                {t('common.retry')}
              </Button>
            )
          }
        />
      </div>
    )
  } else if (!hasTopics) {
    body = (
      <div className={styles.scroller}>
        {header}
        <EmptyState icon={<MessagesSquare />} title={emptyTitle ?? t('feed.empty')} />
      </div>
    )
  } else {
    const footer = (
      <div className={styles.footer}>
        {isFetchingNextPage && <Spinner size={24} />}
        {isFetchNextPageError && (
          <Button size="sm" onClick={() => void fetchNextPage()}>
            {t('feed.loadMoreFailed')} · {t('common.retry')}
          </Button>
        )}
        {!hasNextPage && !isFetchNextPageError && <span className={styles.end}>{t('feed.end')}</span>}
      </div>
    )
    body = (
      <Virtuoso
        className={styles.scroller}
        data={list.topics}
        context={{ header, footer }}
        components={{ Header: ListHeader, Footer: ListFooter }}
        computeItemKey={(_index, topic) => topic.id}
        increaseViewportBy={{ top: 400, bottom: 1200 }}
        endReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
        }}
        itemContent={(_index, topic) => (
          <div className={styles.item} data-mode={mode}>
            <TopicItem
              mode={mode}
              topic={topic}
              category={showCategory && topic.category_id != null ? categories?.byId.get(topic.category_id) : undefined}
              author={topic.posters?.[0] ? list.users.get(topic.posters[0].user_id) : undefined}
            />
          </div>
        )}
      />
    )
  }

  return (
    <section className={styles.page}>
      {toolbar}
      {body}
    </section>
  )
}
