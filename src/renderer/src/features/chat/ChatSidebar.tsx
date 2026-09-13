import { Hash, LogIn, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../components/Button'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { SidebarHeader, SidebarLink, SidebarSection } from '../../layout/SidebarNav'
import { cx } from '../../lib/cx'
import { paths } from '../../lib/routes'
import { useSignInDialog } from '../account/sign-in-store'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { ChannelAvatar, hasBadge, UnreadBadge } from './ChannelAvatar'
import styles from './ChatSidebar.module.css'
import { channelTitle } from './chat-text'
import { NewDirectMessageDialog } from './NewDirectMessageDialog'
import type { ChatChannel } from './types'
import { useChatChannels, useSortedChannels } from './use-channels'

/** Second column under /chat: followed channels and DMs with live unread counts. */
export function ChatSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <SidebarHeader>
        <span className={styles.title}>{t('chat.title')}</span>
        {signedIn && (
          <IconButton size="sm" label={t('chat.newDirectMessage')} onClick={() => setDialogOpen(true)}>
            <Plus strokeWidth={2.5} />
          </IconButton>
        )}
      </SidebarHeader>
      {signedIn ? <ChannelNav /> : <SignedOut />}
      <NewDirectMessageDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  )
}

function SignedOut(): React.JSX.Element {
  const { t } = useTranslation()
  const showSignIn = useSignInDialog((state) => state.show)
  return (
    <div className={styles.notice}>
      <p>{t('chat.signInRequired')}</p>
      <Button size="sm" variant="primary" icon={<LogIn strokeWidth={2.5} />} onClick={showSignIn}>
        {t('account.signIn')}
      </Button>
    </div>
  )
}

function ChannelNav(): React.JSX.Element {
  const { t } = useTranslation()
  const userId = useCurrentUser()?.id
  const channels = useChatChannels()
  const { publicChannels, directChannels } = useSortedChannels()

  if (channels.isPending) {
    return (
      <SkeletonGroup className={styles.skeleton}>
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className={styles.skeletonRow}>
            <SkeletonCircle size={18} />
            <SkeletonLine width={index % 3 === 0 ? 0.5 : 0.7} />
          </div>
        ))}
      </SkeletonGroup>
    )
  }

  if (channels.isError) {
    return (
      <div className={styles.notice}>
        <p>{t('chat.loadFailed')}</p>
        <Button size="sm" onClick={() => void channels.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const row = (channel: ChatChannel, icon: React.JSX.Element): React.JSX.Element => {
    const muted = Boolean(channel.current_user_membership?.muted)
    return (
      <SidebarLink
        key={channel.id}
        to={paths.chat(channel.id)}
        end={false}
        icon={icon}
        trailing={hasBadge(channel.tracking, muted) ? <UnreadBadge tracking={channel.tracking} muted={muted} /> : undefined}
      >
        <span className={cx(hasBadge(channel.tracking, muted) && styles.unreadName)}>{channelTitle(channel, userId)}</span>
      </SidebarLink>
    )
  }

  return (
    <>
      <SidebarSection title={t('chat.channels')}>
        {publicChannels.length === 0 ? (
          <p className={styles.empty}>{t('chat.noChannels')}</p>
        ) : (
          publicChannels.map((channel) => row(channel, <Hash strokeWidth={2.5} />))
        )}
      </SidebarSection>
      <SidebarSection title={t('chat.directMessages')}>
        {directChannels.length === 0 ? (
          <p className={styles.empty}>{t('chat.noDirectMessages')}</p>
        ) : (
          directChannels.map((channel) => row(channel, <ChannelAvatar channel={channel} size={20} />))
        )}
      </SidebarSection>
    </>
  )
}
