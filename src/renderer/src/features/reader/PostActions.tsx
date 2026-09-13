import { Bookmark, Ellipsis, ExternalLink, Eye, Flag, History, Link, Pencil, Quote, Reply, Rocket, Trash2, Trophy, Wallet, Zap } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSite } from '../../api/site'
import type { Post, TopicView } from '../../api/types'
import { Button, IconButton } from '../../components/Button'
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu'
import { showToast } from '../../components/toast-store'
import { formatCount } from '../../lib/format'
import { useIsSignedIn, useRequireSignIn } from '../account/use-session'
import { useComposer } from '../composer/composer-store'
import { BoostBar } from '../interactions/BoostBar'
import { DeletePostDialog } from '../interactions/DeletePostDialog'
import { FeatureTopicDialog, useCanFeatureTopic } from '../interactions/FeatureTopicDialog'
import { FlagDialog, flagOptions } from '../interactions/FlagDialog'
import { useLocalPost, usePostOverride } from '../interactions/post-overrides'
import { RevisionsDialog } from '../interactions/RevisionsDialog'
import { RewardDialog } from '../interactions/RewardDialog'
import { useBookmarkToggle } from '../interactions/use-bookmark'
import { useDeletePost } from '../interactions/use-post-management'
import { VoteControl } from '../interactions/VoteControl'
import styles from './PostActions.module.css'
import { useActiveTopic } from './reader-store'

interface PostActionsProps {
  post: Post
  /** The opening post also shows topic-level counts. */
  views?: number
  /** Set for the opening post: adds topic-level items (feature, flag topic). */
  topic?: TopicView
}

type ActionDialog = 'reward' | 'history' | 'flagPost' | 'flagTopic' | 'feature' | 'delete'

/** Text to quote: the reader's selection inside this post, else the post's plain text. */
function quoteText(post: Post): string {
  const selection = window.getSelection()?.toString().trim()
  if (selection) return selection
  const doc = new DOMParser().parseFromString(post.cooked, 'text/html')
  return (doc.body.textContent ?? '').trim().slice(0, 600)
}

/** Vote, reply, boost, bookmark, tip and share controls under a post, plus its "more" menu. */
export function PostActions({ post, views, topic }: PostActionsProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const signedIn = useIsSignedIn()
  const requireSignIn = useRequireSignIn()
  const site = useSite().data
  const openReply = useComposer((state) => state.openReply)
  const openEdit = useComposer((state) => state.openEdit)
  const activeTitle = useActiveTopic((state) => (state.topic?.id === post.topic_id ? state.topic.title : ''))
  const override = usePostOverride(post.id)
  const local = useLocalPost(post)
  const toggleBookmark = useBookmarkToggle()
  const deletePost = useDeletePost()
  const canFeature = useCanFeatureTopic(topic)
  const [dialog, setDialog] = useState<ActionDialog | null>(null)
  const [boosting, setBoosting] = useState(false)

  const topicTitle = topic?.title ?? activeTitle
  const url = `${SITE_ORIGIN}${post.post_url}`
  const bookmarked = override?.bookmarked ?? post.bookmarked
  const rewardTotal = (post.rewards ?? []).reduce((sum, reward) => sum + (reward.is_deduct ? -reward.amount : reward.amount), 0)
  const rewardNames = (post.rewards ?? []).map((reward) => `${reward.username} +${reward.amount}${reward.note ? `：${reward.note}` : ''}`)
  const isReply = post.post_number > 1
  const closeDialog = (): void => setDialog(null)

  const reply = (quote?: string): void => {
    if (!requireSignIn()) return
    openReply({
      topicId: post.topic_id,
      topicTitle,
      replyToPostNumber: isReply ? post.post_number : undefined,
      replyToUsername: isReply ? post.username : undefined,
      quote: quote ? { username: post.username, postNumber: post.post_number, text: quote } : undefined
    })
  }

  const copyLink = async (): Promise<void> => {
    await window.nodeloc.shell.copyText(url)
    showToast(t('reader.linkCopied'), 'success')
  }

  const menu: Array<MenuItem | 'separator'> = [
    { key: 'quote', label: t('interactions.quote'), icon: <Quote />, onSelect: () => reply(quoteText(post)) },
    { key: 'copy', label: t('reader.copyLink'), icon: <Link />, onSelect: () => void copyLink() },
    {
      key: 'browser',
      label: t('reader.openInBrowser'),
      icon: <ExternalLink />,
      onSelect: () => void window.nodeloc.shell.openExternal(url)
    }
  ]

  const manage: MenuItem[] = []
  if (post.can_edit && !local.deleted) {
    manage.push({
      key: 'edit',
      label: t('interactions.manage.edit'),
      icon: <Pencil />,
      onSelect: () =>
        openEdit({
          topicId: post.topic_id,
          topicTitle,
          postId: post.id,
          postNumber: post.post_number,
          isFirstPost: post.post_number === 1
        })
    })
  }
  if (post.version > 1 && post.can_view_edit_history !== false) {
    manage.push({ key: 'history', label: t('interactions.manage.history'), icon: <History />, onSelect: () => setDialog('history') })
  }
  if (topic && canFeature) {
    manage.push({
      key: 'feature',
      label: topic.is_featured ? t('interactions.feature.unfeature') : t('interactions.feature.feature'),
      icon: <Trophy />,
      onSelect: () => setDialog('feature')
    })
  }
  // Signed out, offer it anyway: choosing it asks to sign in.
  if (!post.yours && !local.deleted && (!signedIn || flagOptions(site, { kind: 'post', post }).length > 0)) {
    manage.push({
      key: 'flag',
      label: t('interactions.flag.action'),
      icon: <Flag />,
      onSelect: () => {
        if (requireSignIn()) setDialog('flagPost')
      }
    })
  }
  if (topic?.details?.can_flag_topic) {
    manage.push({ key: 'flagTopic', label: t('interactions.flag.topicAction'), icon: <Flag />, onSelect: () => setDialog('flagTopic') })
  }
  if (post.can_delete && !local.deleted) {
    manage.push({ key: 'delete', label: t('interactions.manage.delete'), icon: <Trash2 />, danger: true, onSelect: () => setDialog('delete') })
  }
  if (manage.length > 0) menu.push('separator', ...manage)

  return (
    <>
      <BoostBar post={post} composing={boosting} onCloseComposer={() => setBoosting(false)} />

      <div className={styles.actions}>
        {post.vote_score !== undefined && (
          <VoteControl
            postId={post.id}
            orientation="horizontal"
            base={{
              score: post.vote_score,
              count: post.vote_count ?? 0,
              direction: post.vote_direction ?? 'none',
              canVoteUp: post.can_vote_up ?? false,
              canVoteDown: post.can_vote_down ?? false
            }}
            reactions={post.reactions}
            reactionUsersCount={post.reaction_users_count}
          />
        )}

        <Button variant="ghost" size="sm" icon={<Reply />} onClick={() => reply()}>
          {t('reader.reply')}
        </Button>

        {rewardTotal > 0 && (
          <span className={styles.chip} data-tone="accent2" title={`${t('reader.rewardsTitle')}\n${rewardNames.join('\n')}`}>
            <Zap fill="currentColor" />
            {t('reader.rewards', { amount: formatCount(rewardTotal, i18n.language), count: post.rewards?.length ?? 0 })}
          </span>
        )}

        {post.red_envelope_claim && (
          <span className={styles.chip} data-tone="danger">
            <Wallet />
            {t('reader.claimedEnvelope', { points: post.red_envelope_claim.points_received })}
          </span>
        )}

        {views !== undefined && (
          <span className={styles.stat} title={t('reader.views', { count: views })}>
            <Eye />
            {formatCount(views, i18n.language)}
          </span>
        )}

        <span className={styles.spacer} />

        {local.canBoost && !local.deleted && (
          <IconButton
            label={t('interactions.boost.action')}
            size="sm"
            className={boosting ? styles.boosting : undefined}
            onClick={() => setBoosting((open) => !open)}
          >
            <Rocket />
          </IconButton>
        )}
        {!post.yours && (
          <IconButton
            label={t('interactions.reward.action')}
            size="sm"
            className={styles.reward}
            onClick={() => {
              if (requireSignIn()) setDialog('reward')
            }}
          >
            <Zap />
          </IconButton>
        )}
        <IconButton
          label={bookmarked ? t('interactions.bookmark.remove') : t('interactions.bookmark.add')}
          size="sm"
          className={bookmarked ? styles.bookmarked : undefined}
          onClick={() => void toggleBookmark(post.id, bookmarked)}
        >
          <Bookmark fill={bookmarked ? 'currentColor' : 'none'} />
        </IconButton>
        <DropdownMenu
          trigger={({ toggle }) => (
            <IconButton label={t('interactions.more')} size="sm" onClick={toggle}>
              <Ellipsis strokeWidth={2.5} />
            </IconButton>
          )}
          items={menu}
        />
      </div>

      {dialog === 'reward' && <RewardDialog post={post} open onClose={closeDialog} />}
      {dialog === 'history' && <RevisionsDialog post={post} open onClose={closeDialog} />}
      {dialog === 'flagPost' && <FlagDialog target={{ kind: 'post', post }} open onClose={closeDialog} />}
      {dialog === 'flagTopic' && topic && <FlagDialog target={{ kind: 'topic', topicId: topic.id }} open onClose={closeDialog} />}
      {dialog === 'feature' && topic && <FeatureTopicDialog topic={topic} open onClose={closeDialog} />}
      {dialog === 'delete' && <DeletePostDialog open onClose={closeDialog} onConfirm={() => void deletePost(post)} />}
    </>
  )
}
