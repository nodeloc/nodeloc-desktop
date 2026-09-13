import { useEffect } from 'react'

let openOverlays = 0

/**
 * Registers a popup (node list, autocomplete, tag suggestions) while it's
 * open. `Dialog` handles Esc on the window before the popup sees the key,
 * so composer dialogs ask `hasComposerOverlay()` and leave Esc to the popup.
 */
export function useComposerOverlay(open: boolean): void {
  useEffect(() => {
    if (!open) return
    openOverlays++
    return () => {
      openOverlays--
    }
  }, [open])
}

export function hasComposerOverlay(): boolean {
  return openOverlays > 0
}
