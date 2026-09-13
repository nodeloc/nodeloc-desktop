import { APP_PROTOCOL, SITE_ORIGIN } from '@shared/site'
import { useEffect } from 'react'
import { useOpenLink } from '../lib/open-link'

/**
 * Routes links handed over by the main process: `nodeloc://t/123/4` style
 * protocol launches and forum URLs from notification clicks.
 */
export function DeepLinkHandler(): null {
  const openLink = useOpenLink()

  useEffect(
    () =>
      window.nodeloc.events.onDeepLink((url) => {
        const prefix = `${APP_PROTOCOL}://`
        const target = url.toLowerCase().startsWith(prefix) ? `${SITE_ORIGIN}/${url.slice(prefix.length).replace(/^\/+/, '')}` : url
        openLink(target)
      }),
    [openLink]
  )

  return null
}
