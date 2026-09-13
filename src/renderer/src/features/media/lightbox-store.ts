import { create } from 'zustand'

export interface LightboxImage {
  /** Full-size image. */
  src: string
  /** The optimized version shown inline, used while the full size loads. */
  thumb?: string
  alt?: string
  width?: number
  height?: number
}

interface LightboxState {
  images: LightboxImage[]
  index: number
  isOpen: boolean
  open: (images: LightboxImage[], index: number) => void
  close: () => void
  step: (delta: number) => void
}

export const useLightbox = create<LightboxState>((set) => ({
  images: [],
  index: 0,
  isOpen: false,
  open: (images, index) => set({ images: [...images], index, isOpen: true }),
  close: () => set({ isOpen: false }),
  step: (delta) =>
    set((state) =>
      state.images.length === 0
        ? state
        : { index: (state.index + delta + state.images.length) % state.images.length }
    )
}))
