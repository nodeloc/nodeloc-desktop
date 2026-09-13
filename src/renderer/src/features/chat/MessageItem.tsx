import { CircleAlert, Copy, Ellipsis, LinkIcon, Paperclip, Pencil, Reply, Smile, Trash2 } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { IconButton } from '../../components/Button'
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { absoluteUrl } from '../../lib/discourse'
import { formatDateTime, formatRelativeTime, parseDate } from '../../lib/format'
import { paths } from '../../lib/routes'
import { useCurrentUser } from '../account/use-session'
import { PostContent } from '../content/PostContent'
import { emojiUrl, useEmojiIndex } from '../content/use-emoji'
import { useLightbox, type LightboxImage } from '../media/lightbox-store'
import { chatUrl, htmlToText, isImageUpload, isSameDay } from './chat-text'
import { EmojiPicker } from './EmojiPicker'
import styles from './MessageItem.module.css'
import type { ChatChannel, ChatMessage, ChatUpload, TimelineMessage } from './types'

/** Consecutive messages from one person within this window share a header. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

export interface MessageActions {
  reply: (message: TimelineMessage) => void
  openThread: (message: TimelineMessage) => void
  edit: (message: TimelineMessage) => void
  requestDelete: (message: TimelineMessage) => void
  restore: (message: TimelineMessage) => void
  toggleReaction: (message: TimelineMessage, emoji: string) => void
  retry: (stagedId: string) => void
  discard: (stagedId: string) => void
  jumpTo: (messageId: number) => void
}

interface MessageItemProps {
  message: TimelineMessage
  previous?: TimelineMessage
  channel: ChatChannel
  inThread: boolean
  highlighted: boolean
  /** Draws the "new" line above this message. */
  unreadDivider: boolean
  actions: MessageActions
}

/** One chat message: grouped header, body, uploads, reactions, thread summary and hover actions. */
export function MessageItem({ message, previous, channel, inThread, highlighted, unreadDivider, actions }: MessageItemProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const me = useCurrentUser()
  const emoji = useEmojiIndex()
  const [picker, setPicker] = useState(false)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')

  const created = parseDate(message.created_at)
  const previousCreated = parseDate(previous?.created_at)
  const newDay = Boolean(created) && (!previousCreated || !isSameDay(previousCreated, created!))
  const grouped =
    previous !== undefined &&
    created !== null &&
    previousCreated !== null &&
    !newDay &&
    !unreadDivider &&
    !message.in_reply_to &&
    !previous.deleted_at &&
    previous.user.id === message.user.id &&
    created.getTime() - previousCreated.getTime() < GROUP_WINDOW_MS

  const pending = Boolean(message.staged_id)
  const own = me?.id === message.user.id
  const staff = Boolean(me?.admin || me?.moderator || me?.staff)
  const deleted = Boolean(message.deleted_at)
  const reactions = message.reactions ?? []
  const replyCount = message.thread?.preview?.reply_count ?? 0
  const avatarSize = inThread ? 28 : 36
  const time = created ? new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(created) : ''
  const fullTime = formatDateTime(message.created_at, i18n.language)

  const copy = (text: string): void => {
    void window.nodeloc.shell.copyText(text).then(() => showToast(t('common.copied'), 'success'))
  }

  const menuItems: Array<MenuItem | 'separator'> = [
    { key: 'copy', label: t('chat.message.copyText'), icon: <Copy />, onSelect: () => copy(message.message) },
    { key: 'link', label: t('chat.message.copyLink'), icon: <LinkIcon />, onSelect: () => copy(chatUrl(channel, message.id)) }
  ]
  if (!deleted && (own || staff)) {
    menuItems.push('separator')
    if (own) menuItems.push({ key: 'edit', label: t('chat.message.edit'), icon: <Pencil />, onSelect: () => actions.edit(message) })
    menuItems.push({ key: 'delete', label: t('chat.message.delete'), icon: <Trash2 />, danger: true, onSelect: () => actions.requestDelete(message) })
  }

  // Menus open away from the nearer window edge.
  const choosePlacement = (event: MouseEvent<HTMLDivElement>): void => {
    setPlacement(event.currentTarget.getBoundingClientRect().top > window.innerHeight / 2 ? 'top' : 'bottom')
  }

  return (
    <div className={cx(styles.item, inThread && styles.inThread)} data-message-id={pending ? undefined : message.id}>
      {newDay && created && <DateSeparator date={created} />}
      {unreadDivider && (
        <div className={styles.unreadDivider} role="separator">
          <span>{t('chat.channel.unreadDivider')}</span>
        </div>
      )}
      <div
        className={cx(
          styles.message,
          grouped && styles.grouped,
          highlighted && styles.highlighted,
          message.send_state === 'sending' && styles.sending
        )}
        onMouseEnter={choosePlacement}
      >
        {message.in_reply_to && <ReplyPreview reply={message.in_reply_to} onClick={() => actions.jumpTo(message.in_reply_to!.id)} />}
        <div className={styles.line}>
          <div className={styles.gutter}>
            {grouped ? (
              <time className={styles.hoverTime} dateTime={message.created_at} title={fullTime}>
                {time}
              </time>
            ) : (
              <Link to={paths.user(message.user.username)} tabIndex={-1} aria-hidden="true">
                <Avatar template={message.user.avatar_template} username={message.user.username} size={avatarSize} />
              </Link>
            )}
          </div>
          <div className={styles.main}>
            {!grouped && (
              <div className={styles.meta}>
                <Link to={paths.user(message.user.username)} className={styles.username}>
                  {message.user.username}
                </Link>
                <time className={styles.time} dateTime={message.created_at} title={fullTime}>
                  {time}
                </time>
              </div>
            )}

            {deleted ? (
              <div className={styles.deleted}>
                <Trash2 />
                <span>{t('chat.message.deleted')}</span>
                {(own || staff) && (
                  <button type="button" className={styles.linkButton} onClick={() => actions.restore(message)}>
                    {t('chat.message.restore')}
                  </button>
                )}
              </div>
            ) : (
              <>
                {(message.message || !message.uploads?.length) && (
                  <div className={styles.body}>
                    <PostContent html={message.cooked} size="reply" />
                    {message.edited && <span className={styles.edited}>({t('chat.message.edited')})</span>}
                  </div>
                )}
                {message.uploads && message.uploads.length > 0 && <MessageUploads uploads={message.uploads} />}
                {reactions.length > 0 && (
                  <div className={styles.reactions}>
                    {reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        className={cx(styles.reaction, reaction.reacted && styles.reacted)}
                        aria-pressed={reaction.reacted}
                        title={t('chat.message.reactedBy', {
                          users: (reaction.users ?? []).map((user) => user.username).join(', '),
                          emoji: reaction.emoji
                        })}
                        disabled={pending}
                        onClick={() => actions.toggleReaction(message, reaction.emoji)}
                      >
                        <img src={emojiUrl(emoji, reaction.emoji)} alt={reaction.emoji} draggable={false} />
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!inThread && replyCount > 0 && message.thread && (
                  <button type="button" className={styles.threadChip} onClick={() => actions.openThread(message)}>
                    <span className={styles.threadAvatars}>
                      {(message.thread.preview?.participant_users ?? []).slice(0, 3).map((user) => (
                        <Avatar key={user.id} template={user.avatar_template} username={user.username} size={18} />
                      ))}
                    </span>
                    <span className={styles.threadCount}>{t('chat.message.replies', { count: replyCount })}</span>
                    {message.thread.preview?.last_reply_created_at && (
                      <span className={styles.threadTime}>
                        {formatRelativeTime(message.thread.preview.last_reply_created_at, i18n.language)}
                      </span>
                    )}
                  </button>
                )}
                {message.send_state === 'sending' && <div className={styles.sendState}>{t('chat.message.sending')}</div>}
                {message.send_state === 'failed' && message.staged_id && (
                  <div className={cx(styles.sendState, styles.sendFailed)}>
                    <CircleAlert />
                    <span>{t('chat.message.failed')}</span>
                    <button type="button" className={styles.linkButton} onClick={() => actions.retry(message.staged_id!)}>
                      {t('chat.message.retry')}
                    </button>
                    <button type="button" className={styles.linkButton} onClick={() => actions.discard(message.staged_id!)}>
                      {t('chat.message.discard')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {!pending && (
          <div className={cx(styles.toolbar, picker && styles.toolbarOpen)}>
            {!deleted && (
              <>
                <div className={styles.pickerAnchor}>
                  <IconButton size="sm" label={t('chat.message.react')} onClick={() => setPicker((open) => !open)}>
                    <Smile />
                  </IconButton>
                  {picker && (
                    <EmojiPicker
                      placement={placement}
                      onSelect={(name) => {
                        setPicker(false)
                        actions.toggleReaction(message, name)
                      }}
                      onClose={() => setPicker(false)}
                    />
                  )}
                </div>
                <IconButton size="sm" label={t('chat.message.reply')} onClick={() => actions.reply(message)}>
                  <Reply />
                </IconButton>
              </>
            )}
            <DropdownMenu
              placement={placement}
              items={menuItems}
              trigger={({ toggle }) => (
                <IconButton size="sm" label={t('chat.message.more')} onClick={toggle}>
                  <Ellipsis strokeWidth={2.5} />
                </IconButton>
              )}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function DateSeparator({ date }: { date: Date }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const label = isSameDay(date, now)
    ? t('chat.channel.today')
    : isSameDay(date, yesterday)
      ? t('chat.channel.yesterday')
      : new Intl.DateTimeFormat(i18n.language, {
          year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short'
        }).format(date)
  return (
    <div className={styles.dateSeparator} role="separator">
      <span>{label}</span>
    </div>
  )
}

function ReplyPreview({ reply, onClick }: { reply: NonNullable<ChatMessage['in_reply_to']>; onClick: () => void }): React.JSX.Element {
  const text = htmlToText(reply.excerpt || reply.cooked || '')
  return (
    <button type="button" className={styles.replyPreview} onClick={onClick}>
      <Reply />
      {reply.user && (
        <>
          <Avatar template={reply.user.avatar_template} username={reply.user.username} size={16} />
          <span className={styles.replyUser}>{reply.user.username}</span>
        </>
      )}
      <span className={styles.replyExcerpt}>{text}</span>
    </button>
  )
}

/** Images as thumbnails that open the lightbox together; other files open in the system. */
function MessageUploads({ uploads }: { uploads: ChatUpload[] }): React.JSX.Element {
  const { t } = useTranslation()
  const openLightbox = useLightbox((state) => state.open)
  const images = uploads.filter(isImageUpload)
  const files = uploads.filter((upload) => !isImageUpload(upload))
  const gallery: LightboxImage[] = images.map((upload) => ({
    src: absoluteUrl(upload.url),
    thumb: upload.thumbnail?.url ? absoluteUrl(upload.thumbnail.url) : undefined,
    alt: upload.original_filename,
    width: upload.width ?? undefined,
    height: upload.height ?? undefined
  }))

  return (
    <div className={styles.uploads}>
      {images.length > 0 && (
        <div className={styles.images}>
          {gallery.map((image, index) => (
            <button
              key={images[index].id}
              type="button"
              className={styles.imageButton}
              title={t('content.image.open')}
              onClick={() => openLightbox(gallery, index)}
            >
              <img
                src={image.thumb ?? image.src}
                alt={image.alt ?? ''}
                loading="lazy"
                draggable={false}
                style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : undefined }}
              />
            </button>
          ))}
        </div>
      )}
      {files.map((file) => (
        <button key={file.id} type="button" className={styles.file} onClick={() => void window.nodeloc.shell.openExternal(absoluteUrl(file.url))}>
          <Paperclip />
          <span className={styles.fileName}>{file.original_filename ?? t('chat.message.attachment')}</span>
          {file.human_filesize && <span className={styles.fileSize}>{file.human_filesize}</span>}
        </button>
      ))}
    </div>
  )
}
