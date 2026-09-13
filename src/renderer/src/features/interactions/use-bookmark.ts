import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'
import { useRequireSignIn } from '../account/use-session'
import { usePostOverrides } from './post-overrides'

/**
 * Bookmarks a post (`POST /bookmarks`) or removes it. Removal goes through
 * `DELETE /posts/:id/bookmark`, which needs no bookmark id — cached posts
 * don't always carry one.
 */
export function useBookmarkToggle(): (postId: number, bookmarked: boolean) => Promise<void> {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const requireSignIn = useRequireSignIn()
  const patch = usePostOverrides((state) => state.patch)

  return useCallback(
    async (postId, bookmarked) => {
      if (!requireSignIn()) return
      patch(postId, { bookmarked: !bookmarked })
      try {
        if (bookmarked) {
          await apiRequest({ method: 'DELETE', path: `/posts/${postId}/bookmark.json`, priority: 'user' })
          showToast(t('interactions.bookmark.removed'))
        } else {
          await apiRequest({
            method: 'POST',
            path: '/bookmarks.json',
            form: [
              ['bookmarkable_id', postId],
              ['bookmarkable_type', 'Post']
            ],
            priority: 'user'
          })
          showToast(t('interactions.bookmark.added'), 'success')
        }
      } catch (error) {
        patch(postId, { bookmarked })
        showToast(errorMessage(error), 'danger')
      }
    },
    [requireSignIn, patch, errorMessage, t]
  )
}
