import { create } from 'zustand'

interface ShortcutsUiState {
  helpOpen: boolean
  switcherOpen: boolean
  setHelpOpen: (open: boolean) => void
  setSwitcherOpen: (open: boolean) => void
}

/** Open state of the shortcut overlays (help dialog, Ctrl+K switcher). */
export const useShortcutsUi = create<ShortcutsUiState>((set) => ({
  helpOpen: false,
  switcherOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen, switcherOpen: false }),
  setSwitcherOpen: (switcherOpen) => set({ switcherOpen, helpOpen: false })
}))
