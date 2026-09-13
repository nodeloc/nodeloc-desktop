import { Calendar, Clock, Crown, Link, MapPin, MessageCircleMore, Pencil, ShieldCheck, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { absoluteUrl } from '../../lib/discourse'
import { formatCount, formatRelativeTime } from '../../lib/format'
import { useOpenLink } from '../../lib/open-link'
import { useAuthState, useCurrentUser, useRequireSignIn } from '../account/use-session'
import { useComposer } from '../composer/composer-store'
import { HoverSwapButton } from '../social/HoverSwapButton'
import styles from './ProfileHeader.module.css'
import { hexColor, htmlToText, isImageUrl, websiteHref } from './profile-text'
import type { ProfileUser } from './types'
import { useFollowUser } from './use-follow'

export function ProfileHeader({ user }: { user: ProfileUser }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const openLink = useOpenLink()
  const [bannerFailed, setBannerFailed] = useState(false)
  const auth = useAuthState()
  const currentUser = useCurrentUser()
  const myUsername = auth.status === 'signedIn' ? (currentUser?.username ?? auth.username) : undefined
  const isSelf = !!myUsername && myUsername.toLowerCase() === user.username.toLowerCase()

  const banner = user.profile_background_upload_url || user.card_background_upload_url
  const displayName = user.name?.trim() || user.username
  const bio = useMemo(() => (user.bio_excerpt ? htmlToText(user.bio_excerpt) : ''), [user.bio_excerpt])
  const website = user.website ? websiteHref(user.website) : null
  const trustLevel = Math.min(Math.max(user.trust_level ?? 0, 0), 4)
  const fullDate = (iso: string): string => new Date(iso).toLocaleString(i18n.language)

  return (
    <section className={styles.card}>
      <div className={styles.banner}>
        {banner && !bannerFailed && (
          <img src={absoluteUrl(banner)} alt="" draggable={false} onError={() => setBannerFailed(true)} />
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.topRow}>
          <Avatar template={user.avatar_template} username={user.username} size={96} className={styles.avatar} />
          <div className={styles.actions}>
            {isSelf ? (
              <Button
                icon={<Pencil />}
                onClick={() =>
                  void window.nodeloc.browser.open(
                    `https://www.nodeloc.com/u/${encodeURIComponent(user.username)}/preferences/profile`
                  )
                }
              >
                {t('profile.editProfile')}
              </Button>
            ) : (
              <>
                <FollowButton user={user} />
                <MessageButton user={user} />
              </>
            )}
          </div>
        </div>

        <div className={styles.identity}>
          <h1 className={styles.name}>
            <span className={styles.nameText}>{displayName}</span>
            <Flair user={user} />
          </h1>
          <div className={styles.handle}>
            <span>@{user.username}</span>
            {user.title && <span className={styles.userTitle}>{user.title}</span>}
          </div>
          <div className={styles.chips}>
            <span className={styles.chip} data-tone="accent">
              {t(`profile.trustLevels.tl${trustLevel}`)}
            </span>
            {user.admin && (
              <span className={styles.chip} data-tone="accent2">
                <Crown fill="currentColor" />
                {t('profile.admin')}
              </span>
            )}
            {user.moderator && !user.admin && (
              <span className={styles.chip} data-tone="neutral">
                <ShieldCheck />
                {t('profile.moderator')}
              </span>
            )}
          </div>
        </div>

        {bio && <p className={styles.bio}>{bio}</p>}

        <ul className={styles.facts}>
          {user.location && (
            <li>
              <MapPin />
              {user.location}
            </li>
          )}
          {website && (
            <li>
              <Link />
              <button type="button" className={styles.website} title={website} onClick={() => openLink(website)}>
                {user.website_name || user.website}
              </button>
            </li>
          )}
          {user.created_at && (
            <li title={fullDate(user.created_at)}>
              <Calendar />
              {t('profile.joined', {
                date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(user.created_at))
              })}
            </li>
          )}
          {user.last_seen_at && (
            <li title={fullDate(user.last_seen_at)}>
              <Clock />
              {t('profile.lastSeen', { time: formatRelativeTime(user.last_seen_at, i18n.language) })}
            </li>
          )}
        </ul>

        <dl className={styles.counts}>
          <Count label={t('profile.followers')} value={user.total_followers} />
          <Count label={t('profile.following')} value={user.total_following} />
          <Count label={t('profile.energy')} value={user.gamification_score} highlight />
        </dl>
      </div>
    </section>
  )
}

function Count({ label, value, highlight = false }: { label: string; value?: number; highlight?: boolean }): React.JSX.Element | null {
  const { i18n } = useTranslation()
  if (value === undefined) return null
  return (
    <div className={styles.count} data-highlight={highlight || undefined}>
      <dt>{label}</dt>
      <dd title={value.toLocaleString(i18n.language)}>{formatCount(value, i18n.language)}</dd>
    </div>
  )
}

/**
 * 关注, or 已关注 revealing 取消关注 on hover. Signed-out clicks open sign-in;
 * hidden when the server says this user can't be followed.
 */
function FollowButton({ user }: { user: ProfileUser }): React.JSX.Element | null {
  const { t } = useTranslation()
  const signedIn = useAuthState().status === 'signedIn'
  const requireSignIn = useRequireSignIn()
  const follow = useFollowUser(user.username)

  if (signedIn && user.is_followed) {
    return (
      <HoverSwapButton
        label={t('profile.followingState')}
        icon={<UserCheck />}
        hoverLabel={t('profile.unfollow')}
        hoverIcon={<UserMinus />}
        aria-busy={follow.isPending || undefined}
        onClick={() => {
          if (!follow.isPending) follow.mutate(false)
        }}
      />
    )
  }
  if (signedIn && user.can_follow === false) return null

  return (
    <Button
      variant="primary"
      icon={<UserPlus />}
      aria-busy={follow.isPending || undefined}
      onClick={() => {
        if (requireSignIn() && !follow.isPending) follow.mutate(true)
      }}
    >
      {t('profile.follow')}
    </Button>
  )
}

/**
 * 发私信: opens the composer addressed to this user. Signed-out clicks open
 * sign-in; hidden when the server says you can't message them
 * (`can_send_private_message_to_user`).
 */
function MessageButton({ user }: { user: ProfileUser }): React.JSX.Element | null {
  const { t } = useTranslation()
  const signedIn = useAuthState().status === 'signedIn'
  const requireSignIn = useRequireSignIn()
  const openMessage = useComposer((state) => state.openMessage)

  if (signedIn && user.can_send_private_message_to_user === false) return null

  return (
    <Button
      icon={<MessageCircleMore />}
      onClick={() => {
        if (requireSignIn()) openMessage({ recipients: [user.username] })
      }}
    >
      {t('profile.message')}
    </Button>
  )
}

/** Group flair: an uploaded image, or a Font Awesome name we can't draw, shown as a coloured initial. */
function Flair({ user }: { user: ProfileUser }): React.JSX.Element | null {
  const [failed, setFailed] = useState(false)
  const { flair_url: url, flair_name: name } = user
  if (!url) return null

  if (isImageUrl(url)) {
    if (failed) return null
    return (
      <img
        className={styles.flair}
        src={absoluteUrl(url)}
        alt=""
        title={name ?? undefined}
        draggable={false}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      className={styles.flair}
      style={{ background: hexColor(user.flair_bg_color), color: hexColor(user.flair_color) }}
      title={name ?? undefined}
      aria-hidden="true"
    >
      {Array.from(name || url)[0]?.toUpperCase()}
    </span>
  )
}

export function ProfileHeaderSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.card}>
      <div className={styles.banner} />
      <div className={styles.body}>
        <div className={styles.topRow}>
          <SkeletonCircle size={96} />
        </div>
        <SkeletonLine width={0.32} height={22} />
        <SkeletonLine width={0.2} />
        <SkeletonLine width={0.56} />
        <SkeletonLine width={0.4} />
      </div>
    </SkeletonGroup>
  )
}
