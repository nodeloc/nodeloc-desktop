import { useCallback, useEffect, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { isSiteUrl, parseSiteHref, siteUrlToRoute } from './routes'

/**
 * The single place a link decides where it goes:
 * forum pages with a native screen → in-app route; other forum pages →
 * in-app browser window; uploads and external sites → system browser.
 */
export function useOpenLink(): (href: string) => void {
  const navigate = useNavigate()

  return useCallback(
    (href: string) => {
      const url = parseSiteHref(href)
      if (!url) return

      if (url.protocol === 'mailto:') {
        void window.nodeloc.shell.openExternal(url.href)
        return
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return

      if (isSiteUrl(url)) {
        if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/secure-uploads/')) {
          void window.nodeloc.shell.openExternal(url.href)
          return
        }
        const route = siteUrlToRoute(url)
        if (route) {
          navigate(route)
          return
        }
        void window.nodeloc.browser.open(url.href)
        return
      }

      void window.nodeloc.shell.openExternal(url.href)
    },
    [navigate]
  )
}

/**
 * Routes clicks on any `<a href>` inside the container through
 * `useOpenLink`, so rendered post HTML never navigates the app window.
 */
export function useLinkInterception(container: RefObject<HTMLElement | null>): void {
  const openLink = useOpenLink()

  useEffect(() => {
    const element = container.current
    if (!element) return
    const onClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!anchor || !element.contains(anchor)) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      event.preventDefault()
      openLink(href)
    }
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [container, openLink])
}
