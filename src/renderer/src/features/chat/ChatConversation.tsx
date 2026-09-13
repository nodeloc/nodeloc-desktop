import { CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { paths } from '../../lib/routes'
import { useCurrentUser } from '../account/use-session'
import { ChatComposer } from './ChatComposer'
import styles from './ChatConversation.module.css'
import { useChatStore } from './chat-store'
import type { MessageActions } from './MessageItem'
import { MessageList } from './MessageList'
import type { ChatChannel, ChatUpload, TimelineMessage } from './types'
import { useMarkRead } from './use-mark-read'
import { useTimeline } from './use-timeline'

interface ChatConversationProps {
  channel: ChatChannel
  threadId?: number
  targetMessageId?: number
  placeholder: string
}

/**
 * Messages and a composer: a channel in the main column, or a thread in the
 * detail panel. Key it by channel, thread and target message.
 */
export function ChatConversation({ channel, threadId, targetMessageId, placeholder }: ChatConversationProps): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const userId = useCurrentUser()?.id
  const inThread = threadId !== undefined
  const timeline = useTimeline({ channelId: channel.id, threadId, targetMessageId })
  const openThread = useChatStore((state) => state.openThread)
  const setViewing = useChatStore((state) => state.setViewing)
  const [atBottom, setAtBottom] = useState(true)
  const [replyTo, setReplyTo] = useState<TimelineMessage | null>(null)
  const [editing, setEditing] = useState<TimelineMessage | null>(null)
  const [deleting, setDeleting] = useState<TimelineMessage | null>(null)
  const [highlightId, setHighlightId] = useState(targetMessageId)
  // The read position as the channel opened, for the "new" divider.
  const [unreadAfterId] = useState(() => (inThread ? undefined : (channel.current_user_membership?.last_read_message_id ?? undefined)))
  const list = useRef<HTMLDivElement>(null)

  useMarkRead({ channelId: channel.id, threadId, timeline, atBottom })

  useEffect(() => {
    if (!inThread) setViewing({ channelId: channel.id, atBottom })
  }, [inThread, channel.id, atBottom, setViewing])

  useEffect(() => {
    if (inThread) return
    return () => setViewing(null)
  }, [inThread, setViewing])

  const startThread = (message: TimelineMessage): void => {
    openThread(
      message.thread_id
        ? { channelId: channel.id, threadId: message.thread_id }
        : { channelId: channel.id, threadId: null, originalMessage: message }
    )
  }

  const actions: MessageActions = {
    reply: (message) => {
      // In a threaded channel the server files replies into a thread, so answer there.
      if (!inThread && channel.threading_enabled) {
        startThread(message)
        return
      }
      setEditing(null)
      setReplyTo(message)
    },
    openThread: startThread,
    edit: (message) => {
      setReplyTo(null)
      setEditing(message)
    },
    requestDelete: setDeleting,
    restore: (message) => void timeline.restore(message),
    toggleReaction: timeline.toggleReaction,
    retry: timeline.retrySend,
    discard: timeline.discard,
    jumpTo: (messageId) => {
      const element = list.current?.querySelector(`[data-message-id="${messageId}"]`)
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setHighlightId(messageId)
      } else if (!inThread) {
        navigate(paths.chat(channel.id, messageId))
      }
    }
  }

  const submit = (text: string, uploads: ChatUpload[]): boolean | Promise<boolean> => {
    if (editing) {
      const target = editing
      if (text === target.message) {
        setEditing(null)
        return true
      }
      return timeline.edit(target, text).then((ok) => {
        if (ok) setEditing(null)
        return ok
      })
    }
    timeline.send({ text, uploads, inReplyTo: replyTo })
    setReplyTo(null)
    return true
  }

  const editLast = (): void => {
    const last = [...timeline.confirmed].reverse().find((message) => message.user.id === userId && !message.deleted_at)
    if (last) setEditing(last)
  }

  const confirmDelete = (): void => {
    const target = deleting
    setDeleting(null)
    if (target) void timeline.remove(target)
  }

  let body: React.JSX.Element
  if (timeline.status === 'loading') {
    body = (
      <SkeletonGroup className={styles.skeleton}>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <SkeletonCircle size={inThread ? 28 : 36} />
            <div className={styles.skeletonText}>
              <SkeletonLine width={0.25} height={12} />
              <SkeletonLine width={index % 2 ? 0.8 : 0.55} />
            </div>
          </div>
        ))}
      </SkeletonGroup>
    )
  } else if (timeline.status === 'error') {
    body = (
      <EmptyState
        icon={<CircleAlert />}
        title={errorMessage(timeline.error)}
        action={<Button onClick={timeline.reload}>{t('common.retry')}</Button>}
      />
    )
  } else {
    body = (
      <MessageList
        timeline={timeline}
        channel={channel}
        inThread={inThread}
        highlightId={highlightId}
        unreadAfterId={unreadAfterId}
        actions={actions}
        onAtBottomChange={setAtBottom}
      />
    )
  }

  return (
    <div className={styles.conversation}>
      {timeline.status === 'ready' && timeline.error !== null && (
        <div className={styles.banner} role="status">
          <CircleAlert />
          <span className={styles.bannerText}>{errorMessage(timeline.error)}</span>
          <Button size="sm" variant="ghost" onClick={timeline.reload}>
            {t('common.retry')}
          </Button>
        </div>
      )}
      <div ref={list} className={styles.list}>
        {body}
      </div>
      <ChatComposer
        placeholder={placeholder}
        replyTo={replyTo}
        editing={editing}
        disabled={timeline.status === 'error'}
        inset={!inThread}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSubmit={submit}
        onEditLast={editLast}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('chat.message.deleteTitle')}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={confirmDelete}>
              {t('chat.message.delete')}
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>{t('chat.message.deleteConfirm')}</p>
      </Dialog>
    </div>
  )
}
