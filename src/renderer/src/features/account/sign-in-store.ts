import { create } from 'zustand'

interface SignInDialogState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useSignInDialog = create<SignInDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false })
}))
