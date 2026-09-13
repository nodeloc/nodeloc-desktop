import { CircleAlert, Hash, Info, LockKeyhole, MessageSquareText } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button, IconButton } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import styles from './ChatChannelPage.module.css'
import { ChatConversation } from './ChatConversation'
import { ChatSignInPrompt } from './ChatHomePage'
import { useChatStore } from './chat-store'
import { channelTitle, directMessageUsers, isDirectMessage } from './chat-text'
import type { ChatChannel } from './types'
import { useChatChannel } from './use-channels'

export function ChatChannelPage(): React.JSX.Element {
  const { channelId: channelParam, messageId: messageParam } = useParams()
  const signedIn = useIsSignedIn()
  const channelId = Number(channelParam)
  const messageId = messageParam ? Number(messageParam) : undefined

  if (!Number.isInteger(channelId) || (messageParam && !Number.isInteger(messageId))) return <NotFoundPage />
  if (!signedIn) return <ChatSignInPrompt />
  return <ChannelView key={channelId} channelId={channelId} messageId={messageId} />
}

function ChannelView({ channelId, messageId }: { channelId: number; messageId?: number }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const userId = useCurrentUser()?.id
  const { channel, isPending, error, refetch } = useChatChannel(channelId)

  // A thread from another channel doesn't belong in this channel's panel.
  useEffect(() => {
    const { thread, closeThread } = useChatStore.getState()
    if (thread && thread.channelId !== channelId) closeThread()
  }, [channelId])

  if (isPending) {
    return (
      <section className={styles.page}>
        <header className={styles.header}>
          <SkeletonGroup className={styles.headerSkeleton}>
            <SkeletonCircle size={24} />
            <SkeletonLine width={0.6} height={14} />
          </SkeletonGroup>
        </header>
      </section>
    )
  }

  if (!channel) {
    const missing = isApiErrorKind(error, 'notFound', 'forbidden')
    return (
      <EmptyState
        icon={missing ? <LockKeyhole /> : <CircleAlert />}
        title={missing ? t('chat.channel.notFound') : errorMessage(error)}
        action={
          missing ? undefined : (
            <Button variant="primary" onClick={refetch}>
              {t('common.retry')}
            </Button>
          )
        }
      />
    )
  }

  const title = channelTitle(channel, userId)
  return (
    <section className={styles.page}>
      <ChannelHeader channel={channel} title={title} />
      <ChatConversation
        key={messageId ?? 'latest'}
        channel={channel}
        targetMessageId={messageId}
        placeholder={t('chat.composer.placeholder', { title: isDirectMessage(channel) ? title : `#${title}` })}
      />
    </section>
  )
}

function ChannelHeader({ channel, title }: { channel: ChatChannel; title: string }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const userId = useCurrentUser()?.id
  const panel = useChatStore((state) => state.panel)
  const setPanel = useChatStore((state) => state.setPanel)
  const direct = isDirectMessage(channel)
  const members = channel.memberships_count

  return (
    <header className={styles.header}>
      <span className={styles.icon}>
        {direct ? (
          <span className={styles.avatars}>
            {directMessageUsers(channel, userId)
              .slice(0, 3)
              .map((user) => (
                <Avatar key={user.id} template={user.avatar_template} username={user.username} size={24} />
              ))}
          </span>
        ) : (
          <Hash strokeWidth={2.5} />
        )}
      </span>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {channel.description && (
          <p className={styles.description} title={channel.description}>
            {channel.description}
          </p>
        )}
      </div>
      <div className={styles.actions}>
        {!direct && members ? (
          <span className={styles.members}>{t('chat.channel.members', { count: members, formatted: formatCount(members, i18n.language) })}</span>
        ) : null}
        {channel.threading_enabled && (
          <>
            <IconButton
              label={t('chat.channel.threads')}
              aria-pressed={panel === 'threads'}
              className={cx(panel === 'threads' && styles.active)}
              onClick={() => setPanel('threads')}
            >
              <MessageSquareText />
            </IconButton>
            <IconButton
              label={t('chat.channel.info')}
              aria-pressed={panel === 'info'}
              className={cx(panel === 'info' && styles.active)}
              onClick={() => setPanel('info')}
            >
              <Info />
            </IconButton>
          </>
        )}
      </div>
    </header>
  )
}
