import type { SetStateAction } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ReplyTarget } from './composer-store'
import type { LotteryConfig } from './lottery'
import type { RedEnvelopeConfig } from './red-envelope'

export interface ReplyDraft {
  raw: string
  updatedAt: number
}

export interface TopicDraft {
  categoryId?: number
  title: string
  raw: string
  tags?: string[]
  /** discourse-read-permission's minimum trust level; null = everyone. */
  readPermission?: number | null
  lottery?: LotteryConfig | null
  redEnvelope?: RedEnvelopeConfig | null
  updatedAt: number
}

type TopicFields = Omit<TopicDraft, 'updatedAt'>

export interface MessageDraft {
  recipients: string[]
  title: string
  raw: string
  updatedAt: number
}

type MessageFields = Omit<MessageDraft, 'updatedAt'>

interface DraftsState {
  replies: Record<string, ReplyDraft>
  topic: TopicDraft | null
  message: MessageDraft | null
  setReply: (key: string, next: SetStateAction<string>) => void
  clearReply: (key: string) => void
  updateTopic: (update: (draft: TopicFields) => Partial<TopicFields>) => void
  clearTopic: () => void
  updateMessage: (update: (draft: MessageFields) => Partial<MessageFields>) => void
  clearMessage: () => void
}

/** Oldest reply drafts beyond this are dropped so localStorage stays small. */
const MAX_REPLY_DRAFTS = 30

const EMPTY_TOPIC: TopicFields = { title: '', raw: '' }
const EMPTY_MESSAGE: MessageFields = { recipients: [], title: '', raw: '' }

export function replyDraftKey(target: Pick<ReplyTarget, 'topicId' | 'replyToPostNumber'>): string {
  return `${target.topicId}:${target.replyToPostNumber ?? 0}`
}

function resolve(next: SetStateAction<string>, current: string): string {
  return typeof next === 'function' ? next(current) : next
}

function pruned(replies: Record<string, ReplyDraft>): Record<string, ReplyDraft> {
  const entries = Object.entries(replies)
  if (entries.length <= MAX_REPLY_DRAFTS) return replies
  entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
  return Object.fromEntries(entries.slice(0, MAX_REPLY_DRAFTS))
}

/**
 * Local drafts (COMP-06's on-device fallback): one per topic + reply target,
 * and one new topic. Writes are synchronous, so async upload results can
 * update a draft even after its editor has closed.
 */
export const useDrafts = create<DraftsState>()(
  persist(
    (set) => ({
      replies: {},
      topic: null,
      message: null,
      setReply: (key, next) =>
        set((state) => {
          const raw = resolve(next, state.replies[key]?.raw ?? '')
          const replies = { ...state.replies }
          if (raw.trim() === '') delete replies[key]
          else replies[key] = { raw, updatedAt: Date.now() }
          return { replies: pruned(replies) }
        }),
      clearReply: (key) =>
        set((state) => {
          if (!(key in state.replies)) return state
          const replies = { ...state.replies }
          delete replies[key]
          return { replies }
        }),
      updateTopic: (update) =>
        set((state) => {
          const current = state.topic ?? { ...EMPTY_TOPIC, updatedAt: 0 }
          return { topic: { ...current, ...update(current), updatedAt: Date.now() } }
        }),
      clearTopic: () => set({ topic: null }),
      updateMessage: (update) =>
        set((state) => {
          const current = state.message ?? { ...EMPTY_MESSAGE, updatedAt: 0 }
          return { message: { ...current, ...update(current), updatedAt: Date.now() } }
        }),
      clearMessage: () => set({ message: null })
    }),
    { name: 'nodeloc.composer-drafts' }
  )
)
