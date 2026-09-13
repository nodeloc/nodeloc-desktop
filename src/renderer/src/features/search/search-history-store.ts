import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_ENTRIES = 50

interface SearchHistoryState {
  /** Newest first. */
  entries: string[]
  record: (query: string) => void
  remove: (query: string) => void
  clear: () => void
}

/** Recent searches on this device (SEARCH-03). Re-searching a term moves it to the top. */
export const useSearchHistory = create<SearchHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      record: (query) => {
        const trimmed = query.trim()
        if (!trimmed) return
        set((state) => ({
          entries: [trimmed, ...state.entries.filter((entry) => entry !== trimmed)].slice(0, MAX_ENTRIES)
        }))
      },
      remove: (query) => set((state) => ({ entries: state.entries.filter((entry) => entry !== query) })),
      clear: () => set({ entries: [] })
    }),
    { name: 'nodeloc.search-history' }
  )
)
