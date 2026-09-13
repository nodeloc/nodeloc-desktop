import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** One snapshot is small (a page of chat messages); refuse anything unreasonable. */
const MAX_ENTRY_BYTES = 4 * 1024 * 1024
const KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,120}$/i

/**
 * Disk snapshots of server responses (e.g. the last page of a chat channel)
 * so views can render instantly before the network answers. No database:
 * one JSON file per key under userData/snapshots, safe to delete at any time.
 *
 * Not `userData/cache`: Windows paths are case-insensitive, so that is
 * Chromium's own HTTP `Cache` directory, and clearing it breaks page loads.
 */
export class CacheStore {
  private readonly dir = join(app.getPath('userData'), 'snapshots')

  constructor() {
    mkdirSync(this.dir, { recursive: true })
  }

  async read(key: string): Promise<string | null> {
    if (!KEY_PATTERN.test(key)) return null
    try {
      return await readFile(join(this.dir, `${key}.json`), 'utf8')
    } catch {
      return null
    }
  }

  async write(key: string, value: string): Promise<boolean> {
    if (!KEY_PATTERN.test(key) || Buffer.byteLength(value) > MAX_ENTRY_BYTES) return false
    try {
      await writeFile(join(this.dir, `${key}.json`), value)
      return true
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
  }
}
