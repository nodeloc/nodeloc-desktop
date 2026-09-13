import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserOption } from '../../api/types'
import { useCurrentUser } from '../account/use-session'

/** How topic lists render. Shared by the home feed, nodes, tags and custom feeds. */
export type ReadingMode = 'compact' | 'expanded' | 'card'

export const READING_MODES: readonly ReadingMode[] = ['compact', 'expanded', 'card']

interface ReadingModeState {
  mode: ReadingMode
  /** The user picked a mode on this device; the account preference no longer applies. */
  chosen: boolean
  setMode: (mode: ReadingMode) => void
  /** Uses the account's preference, unless this device already has a choice. */
  adoptAccountMode: (mode: ReadingMode) => void
}

/**
 * Priority (per requirements FEED-02): this device's choice, then the
 * account's `community_view_mode` once signed in, then compact.
 */
export const useReadingMode = create<ReadingModeState>()(
  persist(
    (set) => ({
      mode: 'compact',
      chosen: false,
      setMode: (mode) => set({ mode, chosen: true }),
      adoptAccountMode: (mode) => set((state) => (state.chosen ? state : { mode }))
    }),
    {
      name: 'nodeloc.reading-mode',
      version: 1,
      // Version 0 stored only `mode`, and was only ever written by an explicit choice.
      migrate: (persisted, version) =>
        (version === 0 ? { ...(persisted as object), chosen: true } : persisted) as ReadingModeState
    }
  )
)

/** discourse-community's `user_option.community_view_mode` values. */
const ACCOUNT_MODES: Record<NonNullable<UserOption['community_view_mode']>, ReadingMode> = {
  compact: 'compact',
  expand: 'expanded',
  card: 'card'
}

/** Account and value already applied this session, so it's adopted once rather than on every render. */
let adopted: string | null = null

/** Applies the signed-in account's reading mode as this device's default. */
export function useAccountReadingMode(): void {
  const user = useCurrentUser()
  const preference = user?.user_option?.community_view_mode
  const adopt = useReadingMode((state) => state.adoptAccountMode)

  useEffect(() => {
    if (!user || !preference) return
    const key = `${user.id}:${preference}`
    if (adopted === key) return
    adopted = key
    const mode = ACCOUNT_MODES[preference]
    if (mode) adopt(mode)
  }, [user, preference, adopt])
}
