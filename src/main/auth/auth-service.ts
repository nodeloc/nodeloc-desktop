import { session, shell } from 'electron'
import { constants, generateKeyPairSync, privateDecrypt, randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { AuthCompletion, AuthState } from '@shared/bridge'
import { APP_PROTOCOL } from '@shared/site'
import type { Credentials, DiscourseClient } from '../api/client'
import type { CredentialStore, StoredCredentials } from './credential-store'

export const AUTH_REDIRECT = `${APP_PROTOCOL}://auth_redirect`

const APPLICATION_NAME = 'NodeLoc Desktop'

/**
 * Scopes the desktop client needs. `write` is required for every POST/PUT/DELETE
 * (including MessageBus polling); `one_time_password` lets in-app web pages
 * be signed in later.
 */
const SCOPES = ['read', 'write', 'message_bus', 'notifications', 'session_info', 'one_time_password']

/** An authorization left unfinished this long is dropped. */
const PENDING_TTL_MS = 15 * 60_000

interface PendingAuthorization {
  privateKey: string
  nonce: string
  url: string
  createdAt: number
}

interface CurrentUserResponse {
  current_user?: { username?: string }
}

export function isAuthCallback(url: string): boolean {
  return url.toLowerCase().startsWith(AUTH_REDIRECT)
}

/**
 * Discourse User API Key sign-in. The site shows its own login and consent
 * page in the system browser, then redirects to `nodeloc://auth_redirect`
 * with the key encrypted to a one-off RSA key pair (OAEP padding: Node no
 * longer allows PKCS#1 v1.5 private decryption).
 */
export class AuthService extends EventEmitter<{ changed: [AuthState] }> {
  private pending: PendingAuthorization | null = null
  private credentials: StoredCredentials | null
  private expired = false
  private readonly clientId: string

  constructor(
    private readonly store: CredentialStore,
    private readonly origin: string,
    private readonly partition: string,
    private readonly client: () => DiscourseClient
  ) {
    super()
    this.credentials = store.load()
    this.clientId = store.clientId()
  }

  /** Headers for API calls; none once the key has been rejected. */
  getCredentials(): Credentials | null {
    if (!this.credentials || this.expired) return null
    return { userApiKey: this.credentials.userApiKey, clientId: this.clientId }
  }

  state(): AuthState {
    if (this.pending && Date.now() - this.pending.createdAt > PENDING_TTL_MS) this.pending = null
    if (this.pending) return { status: 'pending', username: this.credentials?.username }
    if (!this.credentials) return { status: 'signedOut' }
    return { status: this.expired ? 'expired' : 'signedIn', username: this.credentials.username }
  }

  start(): AuthState {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    const nonce = randomBytes(16).toString('hex')
    const params = new URLSearchParams({
      application_name: APPLICATION_NAME,
      client_id: this.clientId,
      scopes: SCOPES.join(','),
      public_key: publicKey,
      nonce,
      auth_redirect: AUTH_REDIRECT,
      padding: 'oaep'
    })
    const url = `${this.origin}/user-api-key/new?${params.toString()}`
    this.pending = { privateKey, nonce, url, createdAt: Date.now() }
    void shell.openExternal(url)
    return this.emitState()
  }

  reopenBrowser(): void {
    if (this.pending) void shell.openExternal(this.pending.url)
  }

  cancel(): AuthState {
    this.pending = null
    return this.emitState()
  }

  async handleCallback(rawUrl: string): Promise<AuthCompletion> {
    const pending = this.pending
    if (!pending) return { ok: false, reason: 'noPending' }

    const payload = queryParam(rawUrl, 'payload')
    if (!payload) return { ok: false, reason: 'invalidCallback' }

    let decoded: { key?: string; nonce?: string }
    try {
      const encrypted = Buffer.from(payload.replace(/\s+/g, ''), 'base64')
      const plain = privateDecrypt(
        { key: pending.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
        encrypted
      )
      decoded = JSON.parse(plain.toString('utf8'))
    } catch (error) {
      console.error('[auth] could not decrypt the callback payload', error)
      return { ok: false, reason: 'invalidCallback' }
    }

    if (decoded.nonce !== pending.nonce) return { ok: false, reason: 'nonceMismatch' }
    if (!decoded.key) return { ok: false, reason: 'invalidCallback' }

    // Try the key before keeping it, and learn whose it is.
    const previous = this.credentials
    const previousExpired = this.expired
    this.credentials = { userApiKey: decoded.key }
    this.expired = false
    const result = await this.client().request<CurrentUserResponse>({ path: '/session/current.json', priority: 'user' })

    if (!result.ok || !result.data?.current_user?.username) {
      this.credentials = previous
      this.expired = previousExpired
      const reason = result.ok || result.error.kind === 'unauthorized' || result.error.kind === 'forbidden' || result.error.kind === 'notFound' ? 'rejected' : 'network'
      return { ok: false, reason }
    }

    this.credentials = { userApiKey: decoded.key, username: result.data.current_user.username }
    this.store.save(this.credentials)
    this.pending = null
    return { ok: true, state: this.emitState() }
  }

  /**
   * A one-time password that signs a browser session in as this account
   * (`/session/otp/{token}`), so in-app web pages share the sign-in. The
   * token comes back encrypted to a throwaway key pair. Null when signed out
   * or refused.
   */
  async createOneTimePassword(): Promise<string | null> {
    if (!this.getCredentials()) return null
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    const result = await this.client().request<{ redirect_url?: string }>({
      method: 'POST',
      path: '/user-api-key/otp',
      form: [
        ['public_key', publicKey],
        ['auth_redirect', AUTH_REDIRECT],
        ['application_name', APPLICATION_NAME],
        ['padding', 'oaep']
      ],
      priority: 'user'
    })
    const encrypted = result.ok && result.data?.redirect_url ? queryParam(result.data.redirect_url, 'oneTimePassword') : undefined
    if (!encrypted) return null
    try {
      const token = privateDecrypt(
        { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
        Buffer.from(encrypted.replace(/\s+/g, ''), 'base64')
      ).toString('utf8')
      return /^[0-9a-f]+$/.test(token) ? token : null
    } catch (error) {
      console.error('[auth] could not decrypt the one-time password', error)
      return null
    }
  }

  /** Called when the server stops recognising the key (Discourse-Logged-Out, invalid_access). */
  markExpired(): void {
    if (!this.credentials || this.expired) return
    this.expired = true
    this.emitState()
  }

  /** On launch: confirm the stored key still works, so a revoked key shows up as expired. */
  async verifyStoredKey(): Promise<void> {
    if (!this.credentials) return
    const result = await this.client().request<CurrentUserResponse>({ path: '/session/current.json', priority: 'background' })
    if (result.ok && result.data?.current_user?.username) {
      if (result.data.current_user.username !== this.credentials.username) {
        this.credentials = { ...this.credentials, username: result.data.current_user.username }
        this.store.save(this.credentials)
        this.emitState()
      }
      return
    }
    // Only a definite rejection expires the key; being offline doesn't.
    if (!result.ok && ['unauthorized', 'forbidden', 'notFound'].includes(result.error.kind)) this.markExpired()
  }

  async signOut(): Promise<AuthState> {
    if (this.credentials && !this.expired) {
      // Best effort: the local key is forgotten either way.
      await this.client().request({ method: 'POST', path: '/user-api-key/revoke', priority: 'user' })
    }
    this.credentials = null
    this.expired = false
    this.pending = null
    this.store.clear()
    await session.fromPartition(this.partition).clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] })
    return this.emitState()
  }

  private emitState(): AuthState {
    const state = this.state()
    this.emit('changed', state)
    return state
  }
}

/**
 * Reads one query parameter without URLSearchParams, which would turn a
 * literal "+" in the Base64 payload into a space.
 */
function queryParam(url: string, name: string): string | undefined {
  const query = url.slice(url.indexOf('?') + 1).replace(/#.*$/, '')
  for (const part of query.split('&')) {
    const separator = part.indexOf('=')
    const key = separator === -1 ? part : part.slice(0, separator)
    if (key !== name) continue
    try {
      return decodeURIComponent(separator === -1 ? '' : part.slice(separator + 1))
    } catch {
      return undefined
    }
  }
  return undefined
}
