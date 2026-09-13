import { SITE_ORIGIN } from '@shared/site'
import type { ChatChannel, ChatUpload, ChatUser } from './types'

export function isDirectMessage(channel: Pick<ChatChannel, 'chatable_type'>): boolean {
  return channel.chatable_type === 'DirectMessage'
}

/** The other participants of a DM; yourself only when it's a note-to-self. */
export function directMessageUsers(channel: ChatChannel, currentUserId: number | undefined): ChatUser[] {
  const users = channel.chatable?.users ?? []
  const others = users.filter((user) => user.id !== currentUserId)
  return others.length > 0 ? others : users
}

/** DMs are titled by who you talk to; a named group DM keeps its name. */
export function channelTitle(channel: ChatChannel, currentUserId: number | undefined): string {
  if (!isDirectMessage(channel)) return channel.title
  if (channel.chatable?.group && channel.chatable.name) return channel.chatable.name
  const names = directMessageUsers(channel, currentUserId).map((user) => user.username)
  return names.length > 0 ? names.join(', ') : channel.title
}

const IMAGE_EXTENSIONS = /^(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif)$/i

export function isImageUpload(upload: ChatUpload): boolean {
  const extension = upload.extension ?? upload.original_filename?.split('.').pop() ?? ''
  return IMAGE_EXTENSIONS.test(extension) || Boolean(upload.width && upload.height)
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** Plain text as minimal cooked HTML, shown for an optimistic message until the server's version arrives. */
export function textToCooked(text: string): string {
  const escaped = text.replace(/[&<>"']/g, (char) => ESCAPES[char])
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

const parser = new DOMParser()

/** Visible text of cooked HTML or an escaped excerpt, for one-line previews. Parsed inertly; rendered as text. */
export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return html
  return (parser.parseFromString(html, 'text/html').body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The forum URL of a channel or message, for "copy link". */
export function chatUrl(channel: Pick<ChatChannel, 'id' | 'slug'>, messageId?: number): string {
  const base = `${SITE_ORIGIN}/chat/c/${encodeURIComponent(channel.slug || '-')}/${channel.id}`
  return messageId ? `${base}/${messageId}` : base
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** A random staged id; the server echoes it back in the `sent` event. */
export function createStagedId(): string {
  return crypto.randomUUID()
}
