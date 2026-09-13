import { ArrowLeft } from 'lucide-react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button, IconButton } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { PanelCard } from '../../components/PanelCard'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { showToast } from '../../components/toast-store'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { PostContent } from '../content/PostContent'
import { ChannelAvatar } from './ChannelAvatar'
import { fetchMessages, fetchThread, fetchThreads, sendMessage, THREADS_PAGE_SIZE } from './chat-api'
import { ChatComposer } from './ChatComposer'
import { ChatConversation } from './ChatConversation'
import styles from './ChatDetailPanel.module.css'
import { useChatStore, type OpenThread } from './chat-store'
import { channelTitle, createStagedId, directMessageUsers, htmlToText, isDirectMessage } from './chat-text'
import type { ChatChannel, ChatMessage, ChatThread, ChatUpload } from './types'
import { useChatChannel } from './use-channels'

/** How long to wait for `thread_created` before asking the server which thread a first reply made. */
const THREAD_LOOKUP_DELAY_MS = 3000

/** Right-hand panel while a chat channel is open: its threads, its info, or one open thread. */
export function ChatDetailPanel({ channelId }: { channelId: number }): React.JSX.Element | null {
  return useIsSignedIn() ? <ChannelPanel channelId={channelId} /> : null
}

function ChannelPanel({ channelId }: { channelId: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const { channel, isPending } = useChatChannel(channelId)
  const panel = useChatStore((state) => state.panel)
  const thread = useChatStore((state) => state.thread)

  if (isPending) {
    return (
      <PanelCard title={t('chat.channel.info')}>
        <SkeletonGroup className={styles.skeleton}>
          <SkeletonLine width={1} />
          <SkeletonLine width={0.7} />
        </SkeletonGroup>
      </PanelCard>
    )
  }
  // Load errors are shown by the page.
  if (!channel) return null
  if (thread && thread.channelId === channelId) return <ThreadPanel channel={channel} thread={thread} />
  if (panel === 'threads' && channel.threading_enabled) return <ThreadsCard channel={channel} />
  return <ChannelInfoCard channel={channel} />
}

function ChannelInfoCard({ channel }: { channel: ChatChannel }): React.JSX.Element {
  const { t } = useTranslation()
  const userId = useCurrentUser()?.id
  const direct = isDirectMessage(channel)
  const users = direct ? directMessageUsers(channel, userId) : []

  return (
    <PanelCard title={t('chat.channel.info')}>
      <div className={styles.infoHead}>
        <ChannelAvatar channel={channel} size={40} />
        <div className={styles.infoText}>
          <p className={styles.infoTitle}>{channelTitle(channel, userId)}</p>
          {!direct && channel.memberships_count ? (
            <p className={styles.muted}>{t('chat.channel.members', { count: channel.memberships_count })}</p>
          ) : null}
        </div>
      </div>
      {channel.description && <p className={styles.description}>{channel.description}</p>}
      {users.length > 0 && (
        <ul className={styles.people}>
          {users.map((user) => (
            <li key={user.id}>
              <Link to={paths.user(user.username)} className={styles.person}>
                <Avatar template={user.avatar_template} username={user.username} size={28} />
                <span className={styles.personNames}>
                  <span className={styles.username}>{user.username}</span>
                  {user.name && <span className={styles.fullName}>{user.name}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
}

function ThreadsCard({ channel }: { channel: ChatChannel }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const threads = useInfiniteQuery({
    queryKey: ['chat', 'threads', channel.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchThreads(channel.id, pageParam),
    getNextPageParam: (lastPage, pages) => (lastPage.threads.length >= THREADS_PAGE_SIZE ? pages.length * THREADS_PAGE_SIZE : undefined)
  })
  const items = threads.data?.pages.flatMap((page) => page.threads) ?? []

  return (
    <PanelCard title={t('chat.threads.title')}>
      {threads.isPending && (
        <SkeletonGroup className={styles.skeleton}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={styles.skeletonRow}>
              <SkeletonCircle size={28} />
              <div className={styles.skeletonText}>
                <SkeletonLine width={0.9} />
                <SkeletonLine width={0.4} height={11} />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      )}
      {threads.isError && (
        <div className={styles.inlineError}>
          <span>{errorMessage(threads.error)}</span>
          <Button size="sm" onClick={() => void threads.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}
      {threads.isSuccess && items.length === 0 && <p className={styles.muted}>{t('chat.threads.empty')}</p>}
      {items.length > 0 && (
        <ul className={styles.threads}>
          {items.map((thread) => (
            <li key={thread.id}>
              <ThreadRow channelId={channel.id} thread={thread} />
            </li>
          ))}
        </ul>
      )}
      {threads.hasNextPage && (
        <Button size="sm" variant="ghost" className={styles.more} disabled={threads.isFetchingNextPage} onClick={() => void threads.fetchNextPage()}>
          {t('chat.threads.loadMore')}
        </Button>
      )}
    </PanelCard>
  )
}

function ThreadRow({ channelId, thread }: { channelId: number; thread: ChatThread }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const openThread = useChatStore((state) => state.openThread)
  const original = thread.original_message
  const author = original?.user ?? thread.original_message_user
  const title = thread.title || (original ? htmlToText(original.excerpt || original.cooked || '') : '') || t('chat.threads.untitled')
  const replies = thread.preview?.reply_count ?? thread.reply_count ?? 0
  const lastReply = thread.preview?.last_reply_created_at

  return (
    <button type="button" className={styles.thread} onClick={() => openThread({ channelId, threadId: thread.id })}>
      {author && <Avatar template={author.avatar_template} username={author.username} size={28} />}
      <span className={styles.threadText}>
        <span className={styles.threadTitle}>{title}</span>
        <span className={styles.threadMeta}>
          {t('chat.message.replies', { count: replies })}
          {lastReply ? ` · ${formatRelativeTime(lastReply, i18n.language)}` : ''}
        </span>
      </span>
    </button>
  )
}

function ThreadPanel({ channel, thread }: { channel: ChatChannel; thread: OpenThread }): React.JSX.Element {
  const { t } = useTranslation()
  const closeThread = useChatStore((state) => state.closeThread)
  const details = useQuery({
    queryKey: ['chat', 'thread', channel.id, thread.threadId],
    queryFn: () => fetchThread(channel.id, thread.threadId!),
    enabled: thread.threadId !== null
  })
  const heading = thread.threadId === null ? t('chat.threads.newThread') : details.data?.title || t('chat.threads.title')

  return (
    <section className={styles.threadPanel}>
      <header className={styles.threadHeader}>
        <IconButton size="sm" label={t('chat.threads.back')} onClick={closeThread}>
          <ArrowLeft />
        </IconButton>
        <h2 className={styles.threadHeading}>{heading}</h2>
      </header>
      {thread.threadId !== null ? (
        <ChatConversation
          key={thread.threadId}
          channel={channel}
          threadId={thread.threadId}
          placeholder={t('chat.composer.threadPlaceholder')}
        />
      ) : (
        thread.originalMessage && <ThreadDraft channel={channel} original={thread.originalMessage} />
      )}
    </section>
  )
}

/**
 * Replying to a message that has no thread yet: the first reply creates it.
 * The channel's `thread_created` event upgrades the panel; if that's late,
 * the original message is fetched to find its new thread.
 */
function ThreadDraft({ channel, original }: { channel: ChatChannel; original: ChatMessage }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!starting) return
    let cancelled = false
    const timer = setTimeout(() => {
      fetchMessages(channel.id, undefined, { targetMessageId: original.id })
        .then((page) => page.messages.find((message) => message.id === original.id)?.thread_id)
        .catch(() => undefined)
        .then((threadId) => {
          if (cancelled) return
          const store = useChatStore.getState()
          if (threadId) store.threadCreated(channel.id, original.id, threadId)
          else store.closeThread()
        })
    }, THREAD_LOOKUP_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [starting, channel.id, original.id])

  const submit = async (text: string, uploads: ChatUpload[]): Promise<boolean> => {
    setStarting(true)
    try {
      await sendMessage(channel.id, {
        message: text,
        uploadIds: uploads.map((upload) => upload.id),
        inReplyToId: original.id,
        stagedId: createStagedId()
      })
      return true
    } catch (error) {
      setStarting(false)
      showToast(errorMessage(error), 'danger')
      return false
    }
  }

  return (
    <div className={styles.draft}>
      <div className={styles.original}>
        <div className={styles.originalMeta}>
          <Avatar template={original.user.avatar_template} username={original.user.username} size={24} />
          <span>{original.user.username}</span>
        </div>
        <PostContent html={original.cooked} size="reply" />
      </div>
      <div className={styles.draftStatus}>
        {starting && (
          <>
            <Spinner size={18} />
            <span>{t('chat.threads.starting')}</span>
          </>
        )}
      </div>
      <ChatComposer placeholder={t('chat.composer.threadPlaceholder')} disabled={starting} onSubmit={submit} />
    </div>
  )
}
