import type { Session } from 'electron'

/** file:// has no HTTP Referer. YouTube requires the desktop app's identity. */
export function configureMediaEmbeds(target: Session, isAppUrl: (url: string) => boolean): void {
  target.webRequest.onBeforeSendHeaders(
    { urls: ['https://www.youtube-nocookie.com/embed/*'] },
    (details, callback) => {
      const headers = details.requestHeaders
      if (details.resourceType === 'subFrame' && details.webContents && isAppUrl(details.webContents.getURL())) {
        for (const name of Object.keys(headers)) {
          if (name.toLowerCase() === 'referer') delete headers[name]
        }
        // Matches electron-builder.yml and the Windows AppUserModelID.
        headers.Referer = 'https://com.nodeloc.desktop/'
      }
      callback({ requestHeaders: headers })
    }
  )
}
