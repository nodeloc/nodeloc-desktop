import { create } from 'zustand'

export type ToastTone = 'neutral' | 'success' | 'danger'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toast: Toast | null
  show: (message: string, tone?: ToastTone) => void
  dismiss: () => void
}

const VISIBLE_MS = 2600

let nextId = 0
let hideTimer: ReturnType<typeof setTimeout> | undefined

/** One toast at a time; a new message replaces the current one. */
export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (message, tone = 'neutral') => {
    clearTimeout(hideTimer)
    const id = ++nextId
    set({ toast: { id, message, tone } })
    hideTimer = setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : state))
    }, VISIBLE_MS)
  },
  dismiss: () => {
    clearTimeout(hideTimer)
    set({ toast: null })
  }
}))

export function showToast(message: string, tone?: ToastTone): void {
  useToastStore.getState().show(message, tone)
}
