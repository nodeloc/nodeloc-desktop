import { app, net } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { Readable, Transform } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { pipeline } from 'node:stream/promises'
import { EventEmitter } from 'node:events'
import type { UpdateState } from '@shared/bridge'
import { SITE_ORIGIN } from '@shared/site'
import { isPackagedBuild } from './environment'

interface ReleaseResponse {
  release?: unknown
}

interface WindowsRelease {
  platform: 'windows'
  version_name: string
  url: string
  sha256: string
  size?: number
}

/** Checks the Discourse release registry and hands a verified build to Invox. */
export class UpdateService extends EventEmitter {
  private current: UpdateState = { status: 'idle' }
  private operation: Promise<UpdateState> | null = null

  constructor(
    private readonly currentVersion: string,
    private readonly clientId: string
  ) {
    super()
  }

  state(): UpdateState {
    return { ...this.current }
  }

  check(): Promise<UpdateState> {
    if (this.operation) return this.operation
    this.operation = this.run().finally(() => {
      this.operation = null
    })
    return this.operation
  }

  private async run(): Promise<UpdateState> {
    if (!isPackagedBuild || process.platform !== 'win32') {
      return this.setState({ status: 'unavailable' })
    }

    this.setState({ status: 'checking' })
    let response: Response
    try {
      const url = new URL('/mobile/releases/latest.json', SITE_ORIGIN)
      url.searchParams.set('platform', 'windows')
      url.searchParams.set('version_name', this.currentVersion)
      url.searchParams.set('client_id', this.clientId)
      response = await net.fetch(url.toString(), { method: 'GET', credentials: 'omit' })
    } catch (error) {
      console.error('[updates] release check failed', error)
      return this.setState({ status: 'error', error: 'network' })
    }

    if (!response.ok) {
      console.error('[updates] release check returned', response.status)
      return this.setState({ status: 'error', error: 'network' })
    }

    let body: ReleaseResponse
    try {
      body = (await response.json()) as ReleaseResponse
    } catch (error) {
      console.error('[updates] release response is not JSON', error)
      return this.setState({ status: 'error', error: 'invalidRelease' })
    }

    if (body.release === null || body.release === undefined) {
      return this.setState({ status: 'upToDate' })
    }
    if (!isWindowsRelease(body.release) || compareVersions(body.release.version_name, this.currentVersion) <= 0) {
      console.error('[updates] invalid Windows release', body.release)
      return this.setState({ status: 'error', error: 'invalidRelease' })
    }

    const release = body.release
    this.setState({ status: 'downloading', version: release.version_name, progress: 0 })
    let installer: string | null
    try {
      installer = await this.download(release)
    } catch (error) {
      console.error('[updates] could not prepare download', error)
      return this.setState({ status: 'error', version: release.version_name, error: 'download' })
    }
    if (!installer) return this.state()

    this.setState({ status: 'installing', version: release.version_name, progress: 100 })
    try {
      const child = spawn(installer, ['--update', `--install-path=${dirname(process.execPath)}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      })
      child.unref()
    } catch (error) {
      console.error('[updates] could not start installer', error)
      return this.setState({ status: 'error', version: release.version_name, error: 'installer' })
    }

    // Give the renderer one paint to show the transition before closing.
    await new Promise((resolve) => setTimeout(resolve, 350))
    app.quit()
    return this.state()
  }

  private async download(release: WindowsRelease): Promise<string | null> {
    const directory = join(app.getPath('temp'), 'NodeLoc', 'updates')
    const target = join(directory, `NodeLoc-Desktop-Setup-${safeVersion(release.version_name)}.exe`)
    await mkdir(directory, { recursive: true })

    if (existsSync(target) && (await verifyFile(target, release))) return target
    await rm(target, { force: true })

    try {
      const response = await net.fetch(release.url, { method: 'GET', credentials: 'omit' })
      if (!response.ok || !response.body) throw new Error(`Download returned ${response.status}`)

      let downloaded = 0
      const contentLength = Number(response.headers.get('content-length'))
      const total = release.size ?? (Number.isFinite(contentLength) && contentLength > 0 ? contentLength : undefined)
      const progress = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          downloaded += chunk.length
          if (total) {
            this.setState({
              status: 'downloading',
              version: release.version_name,
              progress: Math.min(99, Math.round((downloaded / total) * 100))
            })
          }
          callback(null, chunk)
        }
      })
      const source = Readable.fromWeb(response.body as NodeReadableStream)
      await pipeline(source, progress, createWriteStream(target, { flags: 'wx' }))
    } catch (error) {
      console.error('[updates] download failed', error)
      await rm(target, { force: true })
      this.setState({ status: 'error', version: release.version_name, error: 'download' })
      return null
    }

    if (!(await verifyFile(target, release))) {
      console.error('[updates] downloaded installer did not match its release metadata')
      await rm(target, { force: true })
      this.setState({ status: 'error', version: release.version_name, error: 'verification' })
      return null
    }
    return target
  }

  private setState(state: UpdateState): UpdateState {
    this.current = state
    this.emit('state', this.state())
    return this.state()
  }
}

function isWindowsRelease(value: unknown): value is WindowsRelease {
  if (typeof value !== 'object' || value === null) return false
  const release = value as Partial<WindowsRelease>
  if (release.platform !== 'windows' || typeof release.version_name !== 'string' || !release.version_name.trim()) return false
  if (typeof release.url !== 'string' || typeof release.sha256 !== 'string') return false
  if (!/^[a-f0-9]{64}$/i.test(release.sha256)) return false
  if (release.size !== undefined && (!Number.isSafeInteger(release.size) || release.size <= 0)) return false
  try {
    return new URL(release.url).protocol === 'https:'
  } catch {
    return false
  }
}

async function verifyFile(path: string, release: WindowsRelease): Promise<boolean> {
  const info = await stat(path).catch(() => null)
  if (!info || info.size <= 0 || (release.size !== undefined && info.size !== release.size)) return false
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex').toLowerCase() === release.sha256.toLowerCase()
}

function safeVersion(value: string): string {
  return value.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80)
}

/** Numeric release versions, with stable releases sorting after prereleases. */
export function compareVersions(left: string, right: string): number {
  const parse = (value: string): { core: number[]; prerelease: string | null } => {
    const [core, prerelease] = value.trim().replace(/^v/i, '').split('-', 2)
    return { core: core.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : 0)), prerelease: prerelease ?? null }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < Math.max(a.core.length, b.core.length); index += 1) {
    const difference = (a.core[index] ?? 0) - (b.core[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  if (a.prerelease === b.prerelease) return 0
  if (a.prerelease === null) return 1
  if (b.prerelease === null) return -1
  return a.prerelease.localeCompare(b.prerelease)
}
