import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'
import { useRealtime } from '../../lib/realtime'
import { useCurrentUser } from '../account/use-session'
import {
  deleteMessage,
  editMessage,
  fetchMessages,
  PAGE_SIZE,
  reactToMessage,
  restoreMessage,
  sendMessage,
  type SendInput
} from './chat-api'
import { useChatStore } from './chat-store'
import { createStagedId, textToCooked } from './chat-text'
import type { ChatMessage, ChatRealtimeEvent, ChatUpload, TimelineMessage } from './types'

export interface SendDraft {
  text: string
  uploads: ChatUpload[]
  inReplyTo?: ChatMessage | null
}

interface TimelineOptions {
  channelId: number
  threadId?: number
  /** Opens around this message instead of at the latest page. */
  targetMessageId?: number
}

export interface TimelineState {
  /** Server messages, ascending by id. */
  confirmed: ChatMessage[]
  /** Optimistic sends, in the order they were sent. */
  pending: TimelineMessage[]
  status: 'loading' | 'ready' | 'error'
  error: unknown
  /** Showing the disk snapshot; the network hasn't answered yet. */
  fromSnapshot: boolean
  /** Bumps when the list is replaced by a page that doesn't overlap it (remount the scroller). */
  generation: number
  canLoadPast: boolean
  canLoadFuture: boolean
  loadingPast: boolean
  loadingFuture: boolean
  pastFailed: boolean
  /** Bumps to ask the list to scroll to the newest message. */
  scrollToLatest: number
}

export interface Timeline extends TimelineState {
  messages: TimelineMessage[]
  /** `force` retries after a failure; automatic calls don't. */
  loadPast: (force?: boolean) => void
  loadFuture: () => void
  jumpToLatest: () => void
  reload: () => void
  send: (draft: SendDraft) => void
  retrySend: (stagedId: string) => void
  discard: (stagedId: string) => void
  edit: (message: ChatMessage, text: string) => Promise<boolean>
  remove: (message: ChatMessage) => Promise<boolean>
  restore: (message: ChatMessage) => Promise<boolean>
  toggleReaction: (message: ChatMessage, emoji: string) => void
}

const INITIAL_STATE: TimelineState = {
  confirmed: [],
  pending: [],
  status: 'loading',
  error: null,
  fromSnapshot: false,
  generation: 0,
  canLoadPast: false,
  canLoadFuture: false,
  loadingPast: false,
  loadingFuture: false,
  pastFailed: false,
  scrollToLatest: 0
}

const SNAPSHOT_VERSION = 1
const SNAPSHOT_DELAY_MS = 1500
/** How long a sent message may wait for its realtime echo before asking the server. */
const ECHO_TIMEOUT_MS = 4000

interface Snapshot {
  version: number
  userId: number
  messages: ChatMessage[]
  canLoadPast: boolean
}

const snapshotKey = (channelId: number): string => `chat-channel-${channelId}`

function parseSnapshot(text: string | null, userId: number | undefined): Snapshot | null {
  if (!text) return null
  try {
    const snapshot = JSON.parse(text) as Snapshot
    if (snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.messages)) return null
    // The cache directory is shared by every account on this device.
    if (userId !== undefined && snapshot.userId !== userId) return null
    return snapshot
  } catch {
    return null
  }
}

/** Local ids for optimistic messages; negative so they never collide with the server's. */
let nextLocalId = 0

const byId = (a: ChatMessage, b: ChatMessage): number => a.id - b.id

function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return list
  const map = new Map(list.map((message) => [message.id, message]))
  for (const message of incoming) map.set(message.id, message)
  return [...map.values()].sort(byId)
}

/** Replaces one message, or removes it when `update` returns null. */
function patchMessage(list: ChatMessage[], id: number, update: (message: ChatMessage) => ChatMessage | null): ChatMessage[] {
  const index = list.findIndex((message) => message.id === id)
  if (index === -1) return list
  const next = update(list[index])
  const copy = [...list]
  if (next) copy[index] = next
  else copy.splice(index, 1)
  return copy
}

/**
 * Folds a freshly fetched page into what is shown. Older messages survive
 * only when the page overlaps them (otherwise there'd be a gap), and
 * messages that arrived by realtime during the request are kept.
 */
function mergeFresh(current: ChatMessage[], fresh: ChatMessage[], live: ReadonlySet<number>) {
  const page = [...fresh].sort(byId)
  const oldest = page[0]?.id
  const newest = page[page.length - 1]?.id ?? 0
  const arrived = current.filter((message) => live.has(message.id) && message.id > newest)
  const known = current.filter((message) => !live.has(message.id))
  const overlaps = oldest !== undefined && known.some((message) => message.id >= oldest)
  const older = overlaps ? known.filter((message) => message.id < oldest) : []
  return {
    confirmed: mergeMessages([...older, ...page], arrived),
    keptOlder: older.length > 0,
    replaced: !overlaps && known.length > 0
  }
}

/**
 * Applies one reaction change. Our own changes are applied optimistically,
 * so their realtime echo is recognised (the state already matches) and skipped.
 */
function applyReaction(
  message: ChatMessage,
  emoji: string,
  add: boolean,
  user: { id: number; username: string } | undefined,
  currentUserId: number | undefined
): ChatMessage {
  const byMe = user !== undefined && user.id === currentUserId
  const reactions = [...(message.reactions ?? [])]
  const index = reactions.findIndex((reaction) => reaction.emoji === emoji)
  const existing = index === -1 ? undefined : reactions[index]
  if (byMe && (existing?.reacted ?? false) === add) return message

  if (add) {
    const users = user
      ? [...(existing?.users ?? []).filter((other) => other.username !== user.username), { id: user.id, username: user.username }]
      : (existing?.users ?? [])
    if (existing) reactions[index] = { ...existing, count: existing.count + 1, reacted: existing.reacted || byMe, users }
    else reactions.push({ emoji, count: 1, reacted: byMe, users })
  } else {
    if (!existing) return message
    if (existing.count <= 1) reactions.splice(index, 1)
    else {
      reactions[index] = {
        ...existing,
        count: existing.count - 1,
        reacted: byMe ? false : existing.reacted,
        users: existing.users?.filter((other) => other.username !== user?.username)
      }
    }
  }
  return { ...message, reactions }
}

function isFullMessage(message: Partial<ChatMessage>): message is ChatMessage {
  return typeof message.id === 'number' && typeof message.cooked === 'string' && message.user !== undefined && typeof message.created_at === 'string'
}

/**
 * One channel's (or thread's) messages: disk snapshot first, then the latest
 * page, older/newer pages on demand, realtime events applied in place and
 * optimistic sends. Key the owner by channel, thread and target: state
 * starts fresh for each.
 */
export function useTimeline({ channelId, threadId, targetMessageId }: TimelineOptions): Timeline {
  const me = useCurrentUser()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const [state, setState] = useState<TimelineState>(INITIAL_STATE)
  const stateRef = useRef(state)
  stateRef.current = state
  const meRef = useRef(me)
  meRef.current = me
  const alive = useRef(true)
  const inFlight = useRef({ past: false, future: false })
  /** Ids appended by realtime since the last page request started; that page may predate them. */
  const liveIds = useRef(new Set<number>())
  /** Payloads of sends not yet accepted, for retry. */
  const outbox = useRef(new Map<string, SendInput>())
  /** Server ids of accepted sends, so a fetched page can retire their placeholders. */
  const acceptedIds = useRef(new Map<string, number>())
  const reconcileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flushSnapshot = useRef<(() => void) | null>(null)
  const snapshotEnabled = threadId === undefined && targetMessageId === undefined

  const retirePending = (pending: TimelineMessage[], confirmed: ChatMessage[]): TimelineMessage[] => {
    if (pending.length === 0) return pending
    const ids = new Set(confirmed.map((message) => message.id))
    const next = pending.filter((message) => {
      const accepted = message.staged_id ? acceptedIds.current.get(message.staged_id) : undefined
      return accepted === undefined || !ids.has(accepted)
    })
    return next.length === pending.length ? pending : next
  }

  const loadLatest = async (mode: 'initial' | 'reconcile' | 'latest'): Promise<void> => {
    liveIds.current.clear()
    try {
      const response = await fetchMessages(
        channelId,
        threadId,
        mode === 'initial' && targetMessageId !== undefined ? { targetMessageId } : {}
      )
      if (!alive.current) return
      setState((current) => {
        const merged = mergeFresh(current.confirmed, response.messages, liveIds.current)
        return {
          ...current,
          confirmed: merged.confirmed,
          pending: retirePending(current.pending, merged.confirmed),
          status: 'ready',
          error: null,
          fromSnapshot: false,
          generation: merged.replaced ? current.generation + 1 : current.generation,
          canLoadPast: merged.keptOlder
            ? current.canLoadPast
            : (response.meta?.can_load_more_past ?? response.messages.length >= PAGE_SIZE),
          canLoadFuture: response.meta?.can_load_more_future ?? false,
          scrollToLatest: mode === 'latest' ? current.scrollToLatest + 1 : current.scrollToLatest
        }
      })
    } catch (error) {
      if (!alive.current || mode === 'reconcile') return
      setState((current) => ({ ...current, status: current.confirmed.length > 0 ? 'ready' : 'error', error }))
      if (mode === 'latest') showToast(errorMessage(error), 'danger')
    }
  }

  /** Unknown events and late echoes: fetch the latest page and fold it in. */
  const scheduleReconcile = (): void => {
    if (stateRef.current.canLoadFuture) return
    clearTimeout(reconcileTimer.current)
    reconcileTimer.current = setTimeout(() => void loadLatest('reconcile'), 800)
  }

  useEffect(() => {
    alive.current = true
    if (snapshotEnabled) {
      void window.nodeloc.cache
        .read(snapshotKey(channelId))
        .then((text) => {
          const snapshot = parseSnapshot(text, meRef.current?.id)
          if (!snapshot || !alive.current) return
          setState((current) =>
            current.confirmed.length > 0 || current.status === 'ready'
              ? current
              : {
                  ...current,
                  confirmed: [...snapshot.messages].sort(byId),
                  canLoadPast: snapshot.canLoadPast,
                  status: 'ready',
                  fromSnapshot: true
                }
          )
        })
        .catch(() => undefined)
    }
    void loadLatest('initial')
    return () => {
      alive.current = false
      clearTimeout(reconcileTimer.current)
      flushSnapshot.current?.()
    }
    // Owners key this hook's component by channel, thread and target.
  }, [])

  // Keep the newest page on disk so reopening the channel is instant.
  useEffect(() => {
    if (!snapshotEnabled || !me || state.status !== 'ready' || state.fromSnapshot || state.canLoadFuture) return
    const { confirmed, canLoadPast } = state
    const write = (): void => {
      flushSnapshot.current = null
      const snapshot: Snapshot = {
        version: SNAPSHOT_VERSION,
        userId: me.id,
        messages: confirmed.slice(-PAGE_SIZE),
        canLoadPast: canLoadPast || confirmed.length > PAGE_SIZE
      }
      void window.nodeloc.cache.write(snapshotKey(channelId), JSON.stringify(snapshot))
    }
    flushSnapshot.current = write
    const timer = setTimeout(write, SNAPSHOT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [snapshotEnabled, me, channelId, state])

  const canSeeDeleted = (message: ChatMessage): boolean => {
    const user = meRef.current
    return message.user.id === user?.id || Boolean(user?.staff || user?.admin || user?.moderator)
  }

  const markDeleted = (list: ChatMessage[], ids: number[], deletedAt: string): ChatMessage[] => {
    let next = list
    for (const id of ids) {
      next = patchMessage(next, id, (message) => (canSeeDeleted(message) ? { ...message, deleted_at: deletedAt } : null))
    }
    return next
  }

  useRealtime(threadId === undefined ? `/chat/${channelId}` : `/chat/${channelId}/thread/${threadId}`, (data) => {
    const event = data as ChatRealtimeEvent | null
    if (!event || typeof event.type !== 'string') return
    const payload = event.chat_message

    switch (event.type) {
      case 'sent': {
        if (!payload || !isFullMessage(payload)) {
          scheduleReconcile()
          return
        }
        setState((current) => {
          const pending = current.pending.filter(
            (message) =>
              !(event.staged_id && message.staged_id === event.staged_id) &&
              !(message.staged_id && acceptedIds.current.get(message.staged_id) === payload.id)
          )
          const exists = current.confirmed.some((message) => message.id === payload.id)
          const newest = current.confirmed[current.confirmed.length - 1]?.id ?? 0
          // Viewing history (a gap before the present) or an old replay: nothing to append.
          if (!exists && (current.canLoadFuture || payload.id < newest)) {
            return pending.length === current.pending.length ? current : { ...current, pending }
          }
          liveIds.current.add(payload.id)
          return { ...current, pending, confirmed: mergeMessages(current.confirmed, [payload]) }
        })
        return
      }
      case 'processed':
      case 'edit':
      case 'refresh':
      case 'restore': {
        if (!payload) {
          scheduleReconcile()
          return
        }
        setState((current) => {
          const exists = current.confirmed.some((message) => message.id === payload.id)
          // A restored message others couldn't see comes back whole.
          if (!exists && event.type === 'restore' && isFullMessage(payload)) {
            const oldest = current.confirmed[0]?.id ?? 0
            return payload.id > oldest ? { ...current, confirmed: mergeMessages(current.confirmed, [payload]) } : current
          }
          return {
            ...current,
            confirmed: patchMessage(current.confirmed, payload.id, (message) => ({
              ...message,
              ...payload,
              // Realtime payloads are serialized anonymously; keep our own `reacted` flags.
              reactions: message.reactions ?? payload.reactions,
              deleted_at: event.type === 'restore' ? null : (payload.deleted_at ?? message.deleted_at)
            }))
          }
        })
        return
      }
      case 'delete':
      case 'bulk_delete': {
        const ids = event.type === 'delete' ? (typeof event.deleted_id === 'number' ? [event.deleted_id] : []) : (event.deleted_ids ?? [])
        const deletedAt = event.deleted_at ?? new Date().toISOString()
        if (ids.length > 0) setState((current) => ({ ...current, confirmed: markDeleted(current.confirmed, ids, deletedAt) }))
        return
      }
      case 'reaction': {
        const messageId = event.chat_message_id
        const emoji = event.emoji
        if (typeof messageId !== 'number' || !emoji || !event.action) return
        setState((current) => ({
          ...current,
          confirmed: patchMessage(current.confirmed, messageId, (message) =>
            applyReaction(message, emoji, event.action === 'add', event.user, meRef.current?.id)
          )
        }))
        return
      }
      case 'thread_created': {
        const originalId = payload?.id ?? event.chat_message_id
        const createdId = event.thread_id ?? payload?.thread_id ?? undefined
        if (typeof originalId !== 'number' || typeof createdId !== 'number') return
        setState((current) => ({
          ...current,
          confirmed: patchMessage(current.confirmed, originalId, (message) => ({ ...message, thread_id: createdId }))
        }))
        useChatStore.getState().threadCreated(channelId, originalId, createdId)
        void queryClient.invalidateQueries({ queryKey: ['chat', 'threads', channelId] })
        return
      }
      case 'update_thread_original_message': {
        const originalId = event.original_message_id ?? payload?.id
        if (typeof originalId !== 'number') return
        setState((current) => ({
          ...current,
          confirmed: patchMessage(current.confirmed, originalId, (message) => {
            const previewThreadId = event.thread_id ?? message.thread?.id ?? message.thread_id ?? undefined
            return {
              ...message,
              ...payload,
              reactions: message.reactions,
              thread: event.preview && previewThreadId ? { id: previewThreadId, preview: event.preview } : (payload?.thread ?? message.thread)
            }
          })
        }))
        return
      }
      // Moderation and presence notices don't change the list.
      case 'flag':
      case 'self_flagged':
      case 'mention_warning':
      case 'notice':
      case 'typing':
        return
      default:
        scheduleReconcile()
    }
  })

  const loadPast = (force = false): void => {
    const current = stateRef.current
    const oldest = current.confirmed[0]
    if (inFlight.current.past || !current.canLoadPast || current.status !== 'ready' || current.fromSnapshot || !oldest) return
    if (current.pastFailed && !force) return
    inFlight.current.past = true
    setState((s) => ({ ...s, loadingPast: true, pastFailed: false }))
    fetchMessages(channelId, threadId, { direction: 'past', targetMessageId: oldest.id }).then(
      (response) => {
        inFlight.current.past = false
        if (!alive.current) return
        setState((s) => ({
          ...s,
          confirmed: mergeMessages(s.confirmed, response.messages),
          canLoadPast: response.meta?.can_load_more_past ?? response.messages.length >= PAGE_SIZE,
          loadingPast: false
        }))
      },
      () => {
        inFlight.current.past = false
        if (alive.current) setState((s) => ({ ...s, loadingPast: false, pastFailed: true }))
      }
    )
  }

  const loadFuture = (): void => {
    const current = stateRef.current
    const newest = current.confirmed[current.confirmed.length - 1]
    if (inFlight.current.future || !current.canLoadFuture || current.status !== 'ready' || !newest) return
    inFlight.current.future = true
    setState((s) => ({ ...s, loadingFuture: true }))
    fetchMessages(channelId, threadId, { direction: 'future', targetMessageId: newest.id }).then(
      (response) => {
        inFlight.current.future = false
        if (!alive.current) return
        setState((s) => {
          const confirmed = mergeMessages(s.confirmed, response.messages)
          return {
            ...s,
            confirmed,
            pending: retirePending(s.pending, confirmed),
            canLoadFuture: response.meta?.can_load_more_future ?? response.messages.length >= PAGE_SIZE,
            loadingFuture: false
          }
        })
      },
      () => {
        inFlight.current.future = false
        if (alive.current) setState((s) => ({ ...s, loadingFuture: false }))
      }
    )
  }

  const jumpToLatest = (): void => {
    if (stateRef.current.canLoadFuture) void loadLatest('latest')
    else setState((s) => ({ ...s, scrollToLatest: s.scrollToLatest + 1 }))
  }

  const reload = (): void => {
    setState((s) => ({ ...s, status: s.confirmed.length > 0 ? s.status : 'loading', error: null }))
    void loadLatest('initial')
  }

  const setSendState = (stagedId: string, sendState: TimelineMessage['send_state']): void => {
    setState((s) => ({
      ...s,
      pending: s.pending.map((message) => (message.staged_id === stagedId ? { ...message, send_state: sendState } : message))
    }))
  }

  const deliver = async (stagedId: string): Promise<void> => {
    const input = outbox.current.get(stagedId)
    if (!input) return
    setSendState(stagedId, 'sending')
    try {
      const response = await sendMessage(channelId, input)
      outbox.current.delete(stagedId)
      if (typeof response.message_id === 'number') acceptedIds.current.set(stagedId, response.message_id)
      if (!alive.current) return
      setState((s) => {
        const pending = s.pending.map((message) => (message.staged_id === stagedId ? { ...message, send_state: undefined } : message))
        return { ...s, pending: retirePending(pending, s.confirmed) }
      })
      // The realtime echo normally replaces the placeholder; if it's late, ask the server.
      setTimeout(() => {
        if (alive.current && stateRef.current.pending.some((message) => message.staged_id === stagedId)) void loadLatest('reconcile')
      }, ECHO_TIMEOUT_MS)
    } catch (error) {
      if (!alive.current) return
      setSendState(stagedId, 'failed')
      showToast(errorMessage(error), 'danger')
    }
  }

  const send = (draft: SendDraft): void => {
    const user = meRef.current
    if (!user) return
    const stagedId = createStagedId()
    const reply = draft.inReplyTo
    outbox.current.set(stagedId, {
      message: draft.text,
      uploadIds: draft.uploads.map((upload) => upload.id),
      inReplyToId: reply?.id,
      threadId,
      stagedId
    })
    const placeholder: TimelineMessage = {
      id: --nextLocalId,
      message: draft.text,
      cooked: textToCooked(draft.text),
      created_at: new Date().toISOString(),
      user: { id: user.id, username: user.username, name: user.name, avatar_template: user.avatar_template },
      uploads: draft.uploads,
      reactions: [],
      in_reply_to: reply ? { id: reply.id, cooked: reply.cooked, excerpt: reply.excerpt, user: reply.user } : null,
      chat_channel_id: channelId,
      thread_id: threadId ?? null,
      staged_id: stagedId,
      send_state: 'sending'
    }
    setState((s) => ({ ...s, pending: [...s.pending, placeholder] }))
    // Sending from history: the new message belongs after the present, so load it.
    if (stateRef.current.canLoadFuture) void loadLatest('latest')
    void deliver(stagedId)
  }

  const discard = (stagedId: string): void => {
    outbox.current.delete(stagedId)
    setState((s) => ({ ...s, pending: s.pending.filter((message) => message.staged_id !== stagedId) }))
  }

  const patch = (id: number, update: (message: ChatMessage) => ChatMessage | null): void => {
    setState((s) => ({ ...s, confirmed: patchMessage(s.confirmed, id, update) }))
  }

  const edit = async (message: ChatMessage, text: string): Promise<boolean> => {
    patch(message.id, (current) => ({ ...current, message: text, cooked: textToCooked(text), edited: true }))
    try {
      await editMessage(channelId, message.id, text, (message.uploads ?? []).map((upload) => upload.id))
      return true
    } catch (error) {
      patch(message.id, (current) => ({ ...current, message: message.message, cooked: message.cooked, edited: message.edited }))
      showToast(errorMessage(error), 'danger')
      return false
    }
  }

  const remove = async (message: ChatMessage): Promise<boolean> => {
    try {
      await deleteMessage(channelId, message.id)
      setState((s) => ({ ...s, confirmed: markDeleted(s.confirmed, [message.id], new Date().toISOString()) }))
      return true
    } catch (error) {
      showToast(errorMessage(error), 'danger')
      return false
    }
  }

  const restore = async (message: ChatMessage): Promise<boolean> => {
    try {
      await restoreMessage(channelId, message.id)
      patch(message.id, (current) => ({ ...current, deleted_at: null }))
      return true
    } catch (error) {
      showToast(errorMessage(error), 'danger')
      return false
    }
  }

  const toggleReaction = (message: ChatMessage, emoji: string): void => {
    const user = meRef.current
    if (!user) return
    const actor = { id: user.id, username: user.username }
    const add = !message.reactions?.find((reaction) => reaction.emoji === emoji)?.reacted
    patch(message.id, (current) => applyReaction(current, emoji, add, actor, user.id))
    reactToMessage(channelId, message.id, emoji, add).catch((error: unknown) => {
      patch(message.id, (current) => applyReaction(current, emoji, !add, actor, user.id))
      showToast(errorMessage(error), 'danger')
    })
  }

  const messages = useMemo<TimelineMessage[]>(
    () => (state.pending.length > 0 ? [...state.confirmed, ...state.pending] : state.confirmed),
    [state.confirmed, state.pending]
  )

  return {
    ...state,
    messages,
    loadPast,
    loadFuture,
    jumpToLatest,
    reload,
    send,
    retrySend: (stagedId) => void deliver(stagedId),
    discard,
    edit,
    remove,
    restore,
    toggleReaction
  }
}
