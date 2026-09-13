import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** An opened topic, with what the recently viewed card shows for it. */
export interface VisitedTopic {
  id: number
  title: string
  categoryId?: number
  createdAt?: string
  likeCount?: number
  replyCount?: number
  imageUrl?: string | null
}

const RECENT_LIMIT = 30

interface VisitedState {
  visited: ReadonlySet<number>
  /** Opened topics, most recent first (quick switcher, guests' recently viewed). */
  recent: readonly VisitedTopic[]
  /**
   * Server read-list entries hidden by "clear": topic id → how far it had been
   * read then. A topic comes back once it is read further or opened here again.
   */
  hiddenRead: Readonly<Record<number, number>>
  markVisited: (topicId: number) => void
  recordTopic: (topic: VisitedTopic) => void
  /** Clears the local history and hides the given server entries. */
  clearRecent: (serverTopics?: ReadonlyArray<{ id: number; lastReadPostNumber: number }>) => void
}

/**
 * Topics opened on this device. `visited` lets the unread dot disappear the
 * moment a topic is opened, before the server's read state catches up, and
 * lasts the session; the history and cleared entries are kept across launches.
 */
export const useVisitedTopics = create<VisitedState>()(
  persist(
    (set) => ({
      visited: new Set(),
      recent: [],
      hiddenRead: {},
      markVisited: (topicId) =>
        set((state) => (state.visited.has(topicId) ? state : { visited: new Set(state.visited).add(topicId) })),
      recordTopic: (topic) =>
        set((state) => {
          const hiddenRead = { ...state.hiddenRead }
          delete hiddenRead[topic.id]
          return {
            recent: [topic, ...state.recent.filter((item) => item.id !== topic.id)].slice(0, RECENT_LIMIT),
            hiddenRead
          }
        }),
      clearRecent: (serverTopics = []) =>
        set((state) => {
          const hiddenRead = { ...state.hiddenRead }
          for (const topic of serverTopics) hiddenRead[topic.id] = topic.lastReadPostNumber
          return { recent: [], hiddenRead }
        })
    }),
    {
      name: 'nodeloc.recent-topics',
      partialize: (state) => ({ recent: state.recent, hiddenRead: state.hiddenRead })
    }
  )
)
