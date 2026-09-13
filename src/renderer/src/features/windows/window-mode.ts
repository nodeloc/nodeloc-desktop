/**
 * Pop-out windows are loaded with `?route=/t/123`. The route decides the
 * router's first entry, and its presence switches the frame to the compact
 * shell (no node rail, sidebar or detail panel).
 */
function readPopoutRoute(): string | null {
  try {
    const route = new URLSearchParams(window.location.search).get('route')
    return route && route.startsWith('/') && !route.startsWith('//') ? route : null
  } catch {
    return null
  }
}

export const popoutRoute: string | null = readPopoutRoute()

export const isPopoutWindow: boolean = popoutRoute !== null
