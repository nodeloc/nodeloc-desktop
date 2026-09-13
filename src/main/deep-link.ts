import { app } from 'electron'
import { resolve } from 'node:path'
import { APP_PROTOCOL } from '@shared/site'

/** Windows passes protocol launches as a plain argv entry. */
export function findDeepLink(argv: readonly string[]): string | undefined {
  const prefix = `${APP_PROTOCOL}://`
  return argv.find((arg) => arg.toLowerCase().startsWith(prefix))
}

/**
 * Registers `nodeloc://` with Windows. Development builds skip this unless
 * NODELOC_REGISTER_PROTOCOL=1, because registering points the scheme at the
 * dev Electron binary and would outlive the session.
 */
export function registerProtocolClient(): void {
  if (!process.defaultApp) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL)
    return
  }
  if (process.env.NODELOC_REGISTER_PROTOCOL === '1' && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(APP_PROTOCOL, process.execPath, [resolve(process.argv[1])])
  }
}
