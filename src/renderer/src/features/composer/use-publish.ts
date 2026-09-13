import type { FormField } from '@shared/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { apiRequest } from '../../api/client'
import { showToast } from '../../components/toast-store'
import { paths } from '../../lib/routes'
import { CURRENT_USER_KEY } from '../account/use-session'
import { useComposer, type ReplyTarget } from './composer-store'
import { replyDraftKey, useDrafts } from './drafts-store'
import { useComposerErrorMessage } from './errors'
import { runFollowUps, type FollowUpTask } from './follow-ups'
import { createLottery, lotteryBody, validateLotteryOnServer, type LotteryConfig } from './lottery'
import { createRedEnvelope, type RedEnvelopeConfig } from './red-envelope'
import { isEnqueued, type CreatePostResponse } from './types'
import { NEW_MESSAGE_DRAFT_KEY, NEW_TOPIC_DRAFT_KEY, topicDraftKey } from './use-server-draft'

/** Posts with images can take the server a while; don't give up at the default 20s and invite a double post. */
const POST_TIMEOUT_MS = 60_000

export interface NewTopicInput {
  categoryId: number
  title: string
  raw: string
  tags?: string[]
  /** Minimum trust level to read; null or undefined = everyone. */
  readPermission?: number | null
  lottery?: LotteryConfig | null
  redEnvelope?: RedEnvelopeConfig | null
}

export function useSubmitReply() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ target, raw }: { target: ReplyTarget; raw: string }) => {
      const form: FormField[] = [
        ['raw', raw],
        ['topic_id', target.topicId],
        // Lets the server clear the synced draft once the post exists.
        ['draft_key', topicDraftKey(target.topicId)]
      ]
      if (target.replyToPostNumber) form.push(['reply_to_post_number', target.replyToPostNumber])
      return apiRequest<CreatePostResponse>({ method: 'POST', path: '/posts.json', form, priority: 'user', timeoutMs: POST_TIMEOUT_MS })
    },
    onSuccess: (response, { target }) => {
      useDrafts.getState().clearReply(replyDraftKey(target))
      // Close only this reply; the user may have opened another one meanwhile.
      const { session, close } = useComposer.getState()
      if (session?.kind === 'reply' && session.target === target) close()

      if (isEnqueued(response)) {
        showToast(t('composer.enqueued'), 'success')
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['topic', target.topicId] })
      showToast(t('composer.reply.sent'), 'success')
      navigate(paths.topic(target.topicId, response.post_number))
    }
  })
}

export function useSubmitTopic() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const describe = useComposerErrorMessage()

  return useMutation({
    mutationFn: async (input: NewTopicInput) => {
      // Ask before posting, so a refused lottery doesn't leave a topic that promises one.
      if (input.lottery) await validateLotteryOnServer(lotteryBody(input.lottery, input.title))

      const form: FormField[] = [
        ['title', input.title],
        ['raw', input.raw],
        ['category', input.categoryId],
        ['archetype', 'regular'],
        ['draft_key', NEW_TOPIC_DRAFT_KEY]
      ]
      // Tag objects by name; bare `tags[]` strings are deprecated in core.
      for (const tag of input.tags ?? []) form.push(['tags[][name]', tag])
      if (input.readPermission !== null && input.readPermission !== undefined) {
        form.push(['read_permission_trust_level', input.readPermission])
      }
      return apiRequest<CreatePostResponse>({ method: 'POST', path: '/posts.json', form, priority: 'user', timeoutMs: POST_TIMEOUT_MS })
    },
    onSuccess: (response, input) => {
      useDrafts.getState().clearTopic()
      const { session, close } = useComposer.getState()
      if (session?.kind === 'topic') close()

      if (isEnqueued(response)) {
        showToast(t(input.lottery || input.redEnvelope ? 'composer.enqueuedExtras' : 'composer.enqueued'), 'success')
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['topic-list'] })
      showToast(t('composer.topic.published'), 'success')
      navigate(paths.topic(response.topic_id))

      const topicId = response.topic_id
      const tasks: FollowUpTask[] = []
      // The red envelope first: it can only be created before anyone replies.
      if (input.redEnvelope) {
        const config = input.redEnvelope
        tasks.push({
          kind: 'redEnvelope',
          run: async () => {
            await createRedEnvelope(topicId, config)
            void queryClient.invalidateQueries({ queryKey: ['topic', topicId] })
            void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })
          }
        })
      }
      if (input.lottery) {
        const body = lotteryBody(input.lottery, input.title)
        tasks.push({
          kind: 'lottery',
          run: async () => {
            await createLottery(response.id, body)
            void queryClient.invalidateQueries({ queryKey: ['topic', topicId] })
          }
        })
      }
      if (tasks.length > 0) {
        void runFollowUps(tasks, { describe, created: (kind) => t(`composer.followUp.created.${kind}`) })
      }
    }
  })
}

export interface MessageInput {
  recipients: string[]
  title: string
  raw: string
}

/** INBOX-05: a new private message to users and groups. */
export function useSubmitMessage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: ({ recipients, title, raw }: MessageInput) =>
      apiRequest<CreatePostResponse>({
        method: 'POST',
        path: '/posts.json',
        form: [
          ['title', title],
          ['raw', raw],
          ['archetype', 'private_message'],
          // Usernames and group names together; the server sorts them out.
          ['target_recipients', recipients.join(',')],
          ['draft_key', NEW_MESSAGE_DRAFT_KEY]
        ],
        priority: 'user',
        timeoutMs: POST_TIMEOUT_MS
      }),
    onSuccess: (response) => {
      useDrafts.getState().clearMessage()
      const { session, close } = useComposer.getState()
      if (session?.kind === 'message') close()

      if (isEnqueued(response)) {
        showToast(t('composer.enqueued'), 'success')
        return
      }
      showToast(t('composer.message.sent'), 'success')
      navigate(paths.topic(response.topic_id))
    }
  })
}
