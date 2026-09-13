import { ArrowDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { cx } from '../../lib/cx'
import { useCurrentUser } from '../account/use-session'
import { MessageItem, type MessageActions } from './MessageItem'
import styles from './MessageList.module.css'
import type { ChatChannel, TimelineMessage } from './types'
import type { Timeline } from './use-timeline'

/** Virtuoso wants a positive first index that shrinks as older pages are prepended. */
const FIRST_INDEX_BASE = 1_000_000

interface Row {
  message: TimelineMessage
  previous?: TimelineMessage
}

interface ListContext {
  header: ReactNode
  footer: ReactNode
}

const ListHeader = ({ context }: { context?: ListContext }): ReactNode => context?.header ?? null
const ListFooter = ({ context }: { context?: ListContext }): ReactNode => context?.footer ?? null

interface MessageListProps {
  timeline: Timeline
  channel: ChatChannel
  inThread: boolean
  highlightId?: number
  /** The read position when the conversation opened; the first later message from others gets a divider. */
  unreadAfterId?: number
  actions: MessageActions
  onAtBottomChange: (atBottom: boolean) => void
}

/**
 * Newest at the bottom. Scrolling to the top loads older pages (kept in place
 * with `firstItemIndex`); new messages follow only while at the bottom, and
 * a pill offers the way back otherwise.
 */
export function MessageList({
  timeline,
  channel,
  inThread,
  highlightId,
  unreadAfterId,
  actions,
  onAtBottomChange
}: MessageListProps): React.JSX.Element {
  const { t } = useTranslation()
  const userId = useCurrentUser()?.id
  const virtuoso = useRef<VirtuosoHandle>(null)
  const [atBottom, setAtBottom] = useState(true)
  const { messages, generation } = timeline

  const rows = useMemo<Row[]>(() => messages.map((message, index) => ({ message, previous: messages[index - 1] })), [messages])

  // Prepending must lower firstItemIndex by exactly the number of new rows, so count rows above a fixed anchor.
  const anchor = useRef<{ generation: number; id: number } | null>(null)
  if (anchor.current?.generation !== generation && messages.length > 0 && !messages[0].staged_id) {
    anchor.current = { generation, id: messages[0].id }
  }
  const anchorId = anchor.current?.generation === generation ? anchor.current.id : undefined
  const firstItemIndex = useMemo(() => {
    if (anchorId === undefined) return FIRST_INDEX_BASE
    let above = 0
    for (const message of messages) {
      if (message.staged_id || message.id >= anchorId) break
      above++
    }
    return FIRST_INDEX_BASE - above
  }, [messages, anchorId])

  // Decided once the network has answered, so the divider doesn't move as messages arrive.
  const divider = useRef<{ decided: boolean; id?: number }>({ decided: false })
  if (!divider.current.decided && timeline.status === 'ready' && !timeline.fromSnapshot) {
    const first =
      unreadAfterId === undefined
        ? undefined
        : messages.find((message) => !message.staged_id && message.id > unreadAfterId && message.user.id !== userId)
    divider.current = { decided: true, id: first?.id }
  }
  const dividerId = divider.current.id

  const initialIndex = useMemo(() => {
    const target = highlightId ?? dividerId
    const index = target === undefined ? -1 : messages.findIndex((message) => message.id === target)
    if (index === -1) return { index: 'LAST' as const, align: 'end' as const }
    return { index, align: highlightId !== undefined ? ('center' as const) : ('start' as const) }
    // Only read when the scroller mounts (and remounts per generation).
  }, [generation])

  const scrollToEnd = (behavior: 'auto' | 'smooth'): void => {
    virtuoso.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior })
  }

  const scrollRequest = useRef(timeline.scrollToLatest)
  useEffect(() => {
    if (timeline.scrollToLatest === scrollRequest.current) return
    scrollRequest.current = timeline.scrollToLatest
    scrollToEnd('smooth')
  }, [timeline.scrollToLatest])

  // Your own message always brings you to the bottom.
  const pendingCount = timeline.pending.length
  const previousPending = useRef(pendingCount)
  useEffect(() => {
    if (pendingCount > previousPending.current) scrollToEnd('auto')
    previousPending.current = pendingCount
  }, [pendingCount])

  const newestId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index--) if (!messages[index].staged_id) return messages[index].id
    return 0
  }, [messages])
  const seenId = useRef(0)
  useEffect(() => {
    if (atBottom) seenId.current = newestId
  }, [atBottom, newestId])
  const unseen = atBottom ? 0 : messages.filter((message) => !message.staged_id && message.id > seenId.current && message.user.id !== userId).length

  const header = (
    <div className={styles.header}>
      {timeline.loadingPast && <Spinner size={22} />}
      {timeline.pastFailed && !timeline.loadingPast && (
        <Button size="sm" onClick={() => timeline.loadPast(true)}>
          {t('common.retry')}
        </Button>
      )}
      {!inThread && !timeline.canLoadPast && !timeline.fromSnapshot && timeline.status === 'ready' && (
        <p className={styles.start}>{t('chat.channel.start')}</p>
      )}
    </div>
  )
  const footer = <div className={styles.footer}>{timeline.loadingFuture && <Spinner size={22} />}</div>

  return (
    <div className={styles.wrap}>
      <Virtuoso
        key={generation}
        ref={virtuoso}
        className={styles.scroller}
        data={rows}
        context={{ header, footer }}
        components={{ Header: ListHeader, Footer: ListFooter }}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={initialIndex}
        alignToBottom
        followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
        atBottomThreshold={96}
        atBottomStateChange={(value) => {
          setAtBottom(value)
          onAtBottomChange(value)
        }}
        startReached={() => timeline.loadPast()}
        endReached={() => timeline.loadFuture()}
        increaseViewportBy={{ top: 600, bottom: 400 }}
        computeItemKey={(_index, row) => row.message.staged_id ?? row.message.id}
        itemContent={(_index, row) => (
          <MessageItem
            message={row.message}
            previous={row.previous}
            channel={channel}
            inThread={inThread}
            highlighted={!row.message.staged_id && row.message.id === highlightId}
            unreadDivider={!row.message.staged_id && row.message.id === dividerId}
            actions={actions}
          />
        )}
      />
      {(!atBottom || timeline.canLoadFuture) && (
        <button
          type="button"
          className={cx(styles.pill, unseen > 0 && styles.pillNew)}
          onClick={() => (timeline.canLoadFuture ? timeline.jumpToLatest() : scrollToEnd('smooth'))}
        >
          <ArrowDown strokeWidth={2.5} />
          {unseen > 0 ? t('chat.channel.newMessages') : t('chat.channel.jumpToLatest')}
        </button>
      )}
    </div>
  )
}
