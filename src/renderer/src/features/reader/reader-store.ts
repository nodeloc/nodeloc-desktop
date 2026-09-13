import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NestedSort, Post, TopicListItem, TopicView } from '../../api/types'

interface ReaderSortState {
  /** null = the site's default sort (the server reports which one it used). */
  sort: NestedSort | null
  setSort: (sort: NestedSort | null) => void
}

export const useReaderSort = create<ReaderSortState>((set) => ({
  sort: null,
  setSort: (sort) => set({ sort })
}))

interface ReaderLayoutState {
  /** The topic info pane beside the thread (stats, participants, related). */
  showInfo: boolean
  toggleInfo: () => void
}

export const useReaderLayout = create<ReaderLayoutState>()(
  persist(
    (set) => ({
      showInfo: true,
      toggleInfo: () => set((state) => ({ showInfo: !state.showInfo }))
    }),
    { name: 'nodeloc.reader-layout' }
  )
)

interface ActiveTopicState {
  topic: TopicView | null
  op: Post | null
  related: TopicListItem[]
  set: (topic: TopicView, op: Post, related: TopicListItem[]) => void
  clear: (topicId: number) => void
}

/** The topic on screen, for the node sidebar and the topic info pane. */
export const useActiveTopic = create<ActiveTopicState>((set) => ({
  topic: null,
  op: null,
  related: [],
  set: (topic, op, related) => set({ topic, op, related }),
  clear: (topicId) => set((state) => (state.topic?.id === topicId ? { topic: null, op: null, related: [] } : state))
}))
