import { create } from 'zustand'
import type { ChatMessage } from './types'

/**
 * A thread open in the detail panel. `threadId` is null for a thread that is
 * being started from `originalMessage`: the first reply creates it.
 */
export interface OpenThread {
  channelId: number
  threadId: number | null
  originalMessage?: ChatMessage
}

export type ChatPanelView = 'threads' | 'info'

interface ChatState {
  panel: ChatPanelView
  thread: OpenThread | null
  /** The channel on screen and whether its newest message is visible; unread counts skip it. */
  viewing: { channelId: number; atBottom: boolean } | null
  setPanel: (panel: ChatPanelView) => void
  openThread: (thread: OpenThread) => void
  closeThread: () => void
  /** A `thread_created` event: upgrades a thread being started from that message. */
  threadCreated: (channelId: number, originalMessageId: number, threadId: number) => void
  setViewing: (viewing: { channelId: number; atBottom: boolean } | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  panel: 'threads',
  thread: null,
  viewing: null,
  setPanel: (panel) => set({ panel, thread: null }),
  openThread: (thread) => set({ thread, panel: 'threads' }),
  closeThread: () => set({ thread: null }),
  threadCreated: (channelId, originalMessageId, threadId) =>
    set((state) =>
      state.thread &&
      state.thread.channelId === channelId &&
      state.thread.threadId === null &&
      state.thread.originalMessage?.id === originalMessageId
        ? { thread: { ...state.thread, threadId } }
        : state
    ),
  setViewing: (viewing) => set({ viewing })
}))
