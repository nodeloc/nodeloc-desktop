import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { Boost, Post } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'
import { useCurrentUser } from '../account/use-session'
import { readLocalPost, usePostOverrides } from './post-overrides'

/** The web editor's limits (boost-editor.gjs). The server only requires non-blank text. */
export const BOOST_MAX_LENGTH = 16
export const BOOST_MAX_EMOJI = 5

const SHORTCODE = /:[\w+-]+:/g
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u

/**
 * Counts like the web editor: each emoji (unicode or `:shortcode:`) is one
 * character and one emoji; other text counts by UTF-16 length.
 */
export function boostStats(raw: string): { length: number; emoji: number } {
  let emoji = 0
  const text = raw.replace(SHORTCODE, () => {
    emoji += 1
    return 'x'
  })
  let length = 0
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    if (PICTOGRAPHIC.test(segment)) {
      emoji += 1
      length += 1
    } else {
      length += segment.length
    }
  }
  return { length, emoji }
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/**
 * discourse-boosts: `POST /discourse-boosts/posts/:postId/boosts.json` (`raw`)
 * and `DELETE /discourse-boosts/boosts/:id.json`. Both apply optimistically.
 * One boost per person per post, never on your own post (`can_boost`).
 */
export function useBoostActions(post: Post): { add: (raw: string) => Promise<boolean>; remove: (boost: Boost) => Promise<void> } {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const user = useCurrentUser()
  const patchLocal = usePostOverrides((state) => state.patchLocal)

  const add = async (raw: string): Promise<boolean> => {
    if (!user) return false
    const before = readLocalPost(post)
    const pending: Boost = {
      id: -Date.now(),
      cooked: `<p>${escapeHtml(raw)}</p>`,
      user: { id: user.id, username: user.username, name: user.name, avatar_template: user.avatar_template },
      can_delete: false
    }
    patchLocal(post, { boosts: [...(before.boosts ?? []), pending], canBoost: false })
    try {
      const created = await apiRequest<Boost>({
        method: 'POST',
        path: `/discourse-boosts/posts/${post.id}/boosts.json`,
        form: [['raw', raw]],
        priority: 'user'
      })
      const now = readLocalPost(post)
      patchLocal(post, { boosts: (now.boosts ?? []).map((boost) => (boost.id === pending.id ? created : boost)) })
      showToast(t('interactions.boost.added'), 'success')
      return true
    } catch (error) {
      const now = readLocalPost(post)
      patchLocal(post, { boosts: (now.boosts ?? []).filter((boost) => boost.id !== pending.id), canBoost: before.canBoost })
      showToast(errorMessage(error), 'danger')
      return false
    }
  }

  const remove = async (boost: Boost): Promise<void> => {
    const before = readLocalPost(post)
    const mine = user !== undefined && boost.user.id === user.id
    patchLocal(post, {
      boosts: (before.boosts ?? []).filter((item) => item.id !== boost.id),
      canBoost: mine && !post.yours ? true : before.canBoost
    })
    try {
      await apiRequest<null>({ method: 'DELETE', path: `/discourse-boosts/boosts/${boost.id}.json`, priority: 'user' })
    } catch (error) {
      patchLocal(post, { boosts: before.boosts, canBoost: before.canBoost })
      showToast(errorMessage(error), 'danger')
    }
  }

  return { add, remove }
}
