import { CircleAlert, LockKeyhole, LogIn, MessagesSquare, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { useSignInDialog } from '../account/sign-in-store'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { ChannelAvatar, UnreadBadge } from './ChannelAvatar'
import styles from './ChatHomePage.module.css'
import { channelTitle, htmlToText } from './chat-text'
import { NewDirectMessageDialog } from './NewDirectMessageDialog'
import type { ChatChannel } from './types'
import { lastActivity, useChatChannels, useSortedChannels } from './use-channels'

const RECENT_LIMIT = 12

export function ChatSignInPrompt(): React.JSX.Element {
  const { t } = useTranslation()
  const showSignIn = useSignInDialog((state) => state.show)
  return (
    <EmptyState
      icon={<LockKeyhole />}
      title={t('chat.signInRequired')}
      action={
        <Button variant="primary" icon={<LogIn strokeWidth={2.5} />} onClick={showSignIn}>
          {t('account.signIn')}
        </Button>
      }
    />
  )
}

/** /chat with nothing open: a welcome and the most recent conversations. */
export function ChatHomePage(): React.JSX.Element {
  return useIsSignedIn() ? <ChatHome /> : <ChatSignInPrompt />
}

function ChatHome(): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const channels = useChatChannels()
  const { publicChannels, directChannels } = useSortedChannels()
  const [dialogOpen, setDialogOpen] = useState(false)
  const recent = useMemo(
    () => [...publicChannels, ...directChannels].sort((a, b) => lastActivity(b) - lastActivity(a)).slice(0, RECENT_LIMIT),
    [publicChannels, directChannels]
  )

  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <span className={styles.heroIcon}>
            <MessagesSquare />
          </span>
          <h1 className={styles.title}>{t('chat.home.welcome')}</h1>
          <p className={styles.intro}>{t('chat.home.intro')}</p>
          <Button variant="primary" icon={<Plus strokeWidth={2.5} />} onClick={() => setDialogOpen(true)}>
            {t('chat.newDirectMessage')}
          </Button>
        </header>

        <h2 className={styles.sectionTitle}>{t('chat.home.recent')}</h2>
        {channels.isPending && (
          <SkeletonGroup className={styles.grid}>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={styles.skeletonCard}>
                <SkeletonCircle size={36} />
                <div className={styles.cardText}>
                  <SkeletonLine width={0.5} />
                  <SkeletonLine width={0.8} height={11} />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        )}
        {channels.isError && (
          <EmptyState
            icon={<CircleAlert />}
            title={errorMessage(channels.error)}
            action={<Button onClick={() => void channels.refetch()}>{t('common.retry')}</Button>}
          />
        )}
        {channels.isSuccess && recent.length === 0 && <EmptyState icon={<MessagesSquare />} title={t('chat.home.empty')} />}
        {recent.length > 0 && (
          <ul className={styles.grid}>
            {recent.map((channel) => (
              <li key={channel.id}>
                <ChannelCard channel={channel} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <NewDirectMessageDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </section>
  )
}

function ChannelCard({ channel }: { channel: ChatChannel }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const userId = useCurrentUser()?.id
  const last = channel.last_message
  const excerpt = last ? htmlToText(last.excerpt ?? last.message ?? '') : ''
  const author = last?.user?.username
  let preview = t('chat.home.noMessages')
  if (excerpt) preview = author ? `${author}: ${excerpt}` : excerpt
  else if (author) preview = author

  return (
    <Link to={paths.chat(channel.id)} className={styles.card}>
      <ChannelAvatar channel={channel} size={36} />
      <div className={styles.cardText}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{channelTitle(channel, userId)}</span>
          {last?.created_at && <time className={styles.cardTime}>{formatRelativeTime(last.created_at, i18n.language)}</time>}
        </div>
        <p className={styles.cardExcerpt}>{preview}</p>
      </div>
      <UnreadBadge tracking={channel.tracking} muted={Boolean(channel.current_user_membership?.muted)} />
    </Link>
  )
}
