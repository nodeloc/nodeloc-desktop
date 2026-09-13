import type { FormField } from '@shared/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { TopicResponse } from '../../api/types'
import { showToast } from '../../components/toast-store'
import { useComposer, type EditTarget } from './composer-store'
import { useComposerErrorMessage } from './errors'
import { runFollowUps } from './follow-ups'
import { createLottery, lotteryBody, validateLotteryOnServer, type LotteryConfig } from './lottery'
import type { EditablePost } from './types'

/** What an edit can change. Title, node, tags and read permission apply to the first post only. */
export interface EditFields {
  raw: string
  title: string
  categoryId?: number
  tags: string[]
  /** Minimum trust level to read; null = everyone. */
  readPermission: number | null
}

export interface EditSource {
  post: EditablePost
  topic?: TopicResponse
}

/** The post body saved, but the topic update after it failed. */
export class PartialEditError extends Error {
  constructor(readonly original: unknown) {
    super('The post was saved; the topic update failed')
    this.name = 'PartialEditError'
  }
}

/** Posts with images can take the server a while. */
const SAVE_TIMEOUT_MS = 60_000

/** The post's Markdown (and, for a first post, the topic), fetched fresh for every edit. */
export function useEditSource(target: EditTarget) {
  return useQuery({
    queryKey: ['composer', 'edit', target.postId],
    queryFn: async (): Promise<EditSource> => {
      const [post, topic] = await Promise.all([
        apiRequest<EditablePost>({ path: `/posts/${target.postId}.json`, priority: 'user' }),
        target.isFirstPost ? apiRequest<TopicResponse>({ path: `/t/${target.topicId}.json`, priority: 'user' }) : Promise.resolve(undefined)
      ])
      // Hidden posts come without `raw`; editing an empty body would wipe the post.
      if (typeof post.raw !== 'string') throw new Error('Post source unavailable')
      return { post, topic }
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false
  })
}

export function editFieldsFrom(source: EditSource): EditFields {
  const topic = source.topic
  const level = topic?.read_permission_trust_level
  return {
    raw: source.post.raw ?? '',
    title: topic?.title ?? '',
    categoryId: topic?.category_id,
    tags: (topic?.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.name)),
    readPermission: typeof level === 'number' && level >= 0 ? level : null
  }
}

export function sameEditFields(a: EditFields, b: EditFields): boolean {
  return (
    a.raw === b.raw &&
    a.title.trim() === b.title.trim() &&
    a.categoryId === b.categoryId &&
    a.readPermission === b.readPermission &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  )
}

export interface EditInput {
  target: EditTarget
  /** The values the edit started from; the body doubles as the conflict check. */
  baseline: EditFields
  next: EditFields
  editReason: string
  lottery: LotteryConfig | null
  /** Called once the body is saved, before the topic update, so a retry doesn't resend it. */
  onBodySaved: (raw: string) => void
}

/**
 * Saves an edit: the body through `PUT /posts/{id}` (409 when the post
 * changed meanwhile), then title, node, tags and read permission through
 * `PUT /t/-/{id}` (409 when the title changed meanwhile).
 */
export function useSaveEdit() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const describe = useComposerErrorMessage()

  return useMutation({
    mutationFn: async ({ target, baseline, next, editReason, lottery, onBodySaved }: EditInput) => {
      const title = next.title.trim() || target.topicTitle
      if (lottery) await validateLotteryOnServer(lotteryBody(lottery, title))

      const bodyChanged = next.raw !== baseline.raw
      if (bodyChanged) {
        const form: FormField[] = [
          ['post[raw]', next.raw],
          ['post[original_text]', baseline.raw]
        ]
        if (editReason.trim()) form.push(['post[edit_reason]', editReason.trim()])
        await apiRequest({ method: 'PUT', path: `/posts/${target.postId}.json`, form, priority: 'user', timeoutMs: SAVE_TIMEOUT_MS })
        onBodySaved(next.raw)
      }

      if (!target.isFirstPost) return
      const changes: Record<string, unknown> = {}
      if (next.title.trim() !== baseline.title.trim()) {
        changes.title = next.title.trim()
        changes.original_title = baseline.title
      }
      if (next.categoryId !== undefined && next.categoryId !== baseline.categoryId) changes.category_id = next.categoryId
      // Tags as objects; no `original_tags`: the server compares against hidden tags we can't see.
      if (next.tags.join('\n') !== baseline.tags.join('\n')) changes.tags = next.tags.map((name) => ({ name }))
      // "" clears the restriction.
      if (next.readPermission !== baseline.readPermission) changes.read_permission_trust_level = next.readPermission ?? ''
      if (Object.keys(changes).length === 0) return

      try {
        await apiRequest({ method: 'PUT', path: `/t/-/${target.topicId}.json`, json: changes, priority: 'user' })
      } catch (error) {
        throw bodyChanged ? new PartialEditError(error) : error
      }
    },
    onSuccess: (_result, { target, next, lottery }) => {
      const { session, close } = useComposer.getState()
      if (session?.kind === 'edit' && session.target === target) close()
      void queryClient.invalidateQueries({ queryKey: ['topic', target.topicId] })
      if (target.isFirstPost) void queryClient.invalidateQueries({ queryKey: ['topic-list'] })
      showToast(t('composer.edit.saved'), 'success')

      if (lottery) {
        const body = lotteryBody(lottery, next.title.trim() || target.topicTitle)
        void runFollowUps(
          [
            {
              kind: 'lottery',
              run: async () => {
                await createLottery(target.postId, body)
                void queryClient.invalidateQueries({ queryKey: ['topic', target.topicId] })
              }
            }
          ],
          { describe, created: (kind) => t(`composer.followUp.created.${kind}`) }
        )
      }
    }
  })
}
