/// <reference types="vite/client" />

import type { NodelocBridge } from '@shared/bridge'

declare global {
  interface Window {
    nodeloc: NodelocBridge
    /** Development only: navigate the memory router from automation. */
    __nodelocNavigate?: (to: string, options?: { state?: unknown; replace?: boolean }) => void
  }
}

export {}
