import { app, safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface StoredCredentials {
  userApiKey: string
  username?: string
}

/**
 * The User API Key, encrypted with the OS (DPAPI on Windows) via safeStorage.
 * The client id is not secret and survives sign-out, so re-authorizing
 * replaces the old key on the server instead of piling up new ones.
 */
export class CredentialStore {
  private readonly keyFile = join(app.getPath('userData'), 'credentials.bin')
  private readonly clientIdFile = join(app.getPath('userData'), 'client-id')
  /** Used when OS encryption isn't available: the key lives only for this run. */
  private memoryOnly: StoredCredentials | null = null

  load(): StoredCredentials | null {
    if (!safeStorage.isEncryptionAvailable()) return this.memoryOnly
    try {
      const decrypted = safeStorage.decryptString(readFileSync(this.keyFile))
      const parsed = JSON.parse(decrypted) as StoredCredentials
      return typeof parsed.userApiKey === 'string' && parsed.userApiKey ? parsed : null
    } catch {
      return null
    }
  }

  save(credentials: StoredCredentials): void {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[auth] OS encryption unavailable; the key will not be kept after quitting')
      this.memoryOnly = credentials
      return
    }
    writeFileSync(this.keyFile, safeStorage.encryptString(JSON.stringify(credentials)))
  }

  clear(): void {
    this.memoryOnly = null
    rmSync(this.keyFile, { force: true })
  }

  clientId(): string {
    try {
      if (existsSync(this.clientIdFile)) {
        const stored = readFileSync(this.clientIdFile, 'utf8').trim()
        if (stored) return stored
      }
    } catch {
      // Regenerate below.
    }
    const id = randomUUID()
    try {
      writeFileSync(this.clientIdFile, id)
    } catch (error) {
      console.error('[auth] could not save client id', error)
    }
    return id
  }
}
