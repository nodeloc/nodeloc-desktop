import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { Post } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'
import { readLocalPost, usePostOverrides } from './post-overrides'

/**
 * `DELETE /posts/:id`. The post shows as deleted at once and comes back if the
 * request fails. Staff and node moderators soft-delete it; an author's own
 * post is marked "deleted by author" pending removal. Both can be recovered.
 * The first post can't be deleted this way (`can_delete` is false for it).
 */
export function useDeletePost(): (post: Post) => Promise<boolean> {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const patchLocal = usePostOverrides((state) => state.patchLocal)

  return useCallback(
    async (post) => {
      const before = readLocalPost(post).deleted
      patchLocal(post, { deleted: true })
      try {
        await apiRequest<null>({ method: 'DELETE', path: `/posts/${post.id}.json`, priority: 'user' })
      } catch (error) {
        patchLocal(post, { deleted: before })
        showToast(errorMessage(error), 'danger')
        return false
      }
      showToast(t('interactions.manage.deleted'), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic', post.topic_id] })
      return true
    },
    [patchLocal, errorMessage, queryClient, t]
  )
}

/** `PUT /posts/:id/recover`, which answers with the restored post. */
export function useRecoverPost(): (post: Post) => Promise<boolean> {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const patchLocal = usePostOverrides((state) => state.patchLocal)

  return useCallback(
    async (post) => {
      try {
        const restored = await apiRequest<Partial<Post> | null>({
          method: 'PUT',
          path: `/posts/${post.id}/recover.json`,
          priority: 'user'
        })
        patchLocal(post, restored?.cooked ? { deleted: false, cooked: restored.cooked } : { deleted: false })
      } catch (error) {
        showToast(errorMessage(error), 'danger')
        return false
      }
      showToast(t('interactions.manage.recovered'), 'success')
      void queryClient.invalidateQueries({ queryKey: ['topic', post.topic_id] })
      return true
    },
    [patchLocal, errorMessage, queryClient, t]
  )
}
