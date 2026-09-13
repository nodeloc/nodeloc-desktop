import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { showToast } from '../../components/toast-store'
import { useAuthState } from '../account/use-session'
import { useWriteErrorMessage } from '../social/use-write-error'
import type { ProfileResponse, ProfileUser } from './types'

function withCount(value: number | undefined, delta: number): number | undefined {
  return value === undefined ? undefined : Math.max(0, value + delta)
}

interface FollowContext {
  previous?: ProfileResponse
  mine?: ProfileResponse
}

/**
 * Follow or unfollow (discourse-follow). The profile's follower count, and the
 * signed-in user's own following count if cached, move at once and roll back
 * on failure.
 */
export function useFollowUser(username: string) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()
  const me = useAuthState().username

  return useMutation<unknown, unknown, boolean, FollowContext>({
    mutationFn: (follow) =>
      apiRequest<unknown>({
        method: follow ? 'PUT' : 'DELETE',
        path: `/follow/${encodeURIComponent(username)}`,
        priority: 'user'
      }),
    onMutate: async (follow) => {
      const key = ['profile', username]
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<ProfileResponse>(key)
      if (!previous || previous.user.is_followed === follow) return { previous }

      const delta = follow ? 1 : -1
      const user: ProfileUser = {
        ...previous.user,
        is_followed: follow,
        total_followers: withCount(previous.user.total_followers, delta)
      }
      queryClient.setQueryData<ProfileResponse>(key, { ...previous, user })

      const mine = me ? queryClient.getQueryData<ProfileResponse>(['profile', me]) : undefined
      if (me && mine) {
        queryClient.setQueryData<ProfileResponse>(['profile', me], {
          ...mine,
          user: { ...mine.user, total_following: withCount(mine.user.total_following, delta) }
        })
      }
      return { previous, mine }
    },
    onError: (error, _follow, context) => {
      if (context?.previous) queryClient.setQueryData(['profile', username], context.previous)
      if (me && context?.mine) queryClient.setQueryData(['profile', me], context.mine)
      showToast(writeError(error), 'danger')
    },
    onSuccess: (_response, follow) => {
      showToast(t(follow ? 'profile.followed' : 'profile.unfollowed', { username }), 'success')
    }
  })
}
