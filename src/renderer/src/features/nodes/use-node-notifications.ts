import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import { showToast } from '../../components/toast-store'
import { useWriteErrorMessage } from '../social/use-write-error'
import type { NodeResponse } from './types'

/** Discourse category notification levels. */
export type NotificationLevel = 0 | 1 | 2 | 3 | 4

export function normalizeLevel(level: number | null | undefined): NotificationLevel {
  return level === 0 || level === 2 || level === 3 || level === 4 ? level : 1
}

interface Variables {
  categoryId: number
  level: NotificationLevel
}

/** Sets a node's notification level, reflected at once in every `['node', slug]` copy. */
export function useNodeNotificationLevel() {
  const queryClient = useQueryClient()
  const writeError = useWriteErrorMessage()

  return useMutation<unknown, unknown, Variables, { previous: Array<[QueryKey, NodeResponse | undefined]> }>({
    mutationFn: ({ categoryId, level }) =>
      apiRequest<unknown>({
        method: 'POST',
        path: `/category/${categoryId}/notifications`,
        form: [['notification_level', level]],
        priority: 'user'
      }),
    onMutate: async ({ categoryId, level }) => {
      await queryClient.cancelQueries({ queryKey: ['node'] })
      const previous = queryClient
        .getQueriesData<NodeResponse>({ queryKey: ['node'] })
        .filter(([, data]) => data?.category.id === categoryId)
      for (const [key, data] of previous) {
        if (data) queryClient.setQueryData<NodeResponse>(key, { ...data, category: { ...data.category, notification_level: level } })
      }
      return { previous }
    },
    onError: (error, _variables, context) => {
      for (const [key, data] of context?.previous ?? []) queryClient.setQueryData(key, data)
      showToast(writeError(error), 'danger')
    }
  })
}
