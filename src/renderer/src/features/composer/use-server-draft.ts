import type { FormField } from '@shared/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest, isApiErrorKind } from '../../api/client'
import type { DraftSaveResponse, DraftShowResponse } from './types'

/** Draft keys as core defines them (`Draft::NEW_TOPIC`, `NEW_PRIVATE_MESSAGE`, `Topic#draft_key`). */
export const NEW_TOPIC_DRAFT_KEY = 'new_topic'
export const NEW_MESSAGE_DRAFT_KEY = 'new_private_message'

/** Replies and edits share this key on the web; the composer saves only replies under it. */
export function topicDraftKey(topicId: number): string {
  return `topic_${topicId}`
}

/** Autosave no more often than this: every save counts against the API key's rate limit. */
const SAVE_DELAY_MS = 5_000

export type DraftSyncStatus = 'idle' | 'saving' | 'saved' | 'local' | 'conflict'

export type DraftData = Record<string, unknown>

export interface ServerDraft {
  status: DraftSyncStatus
  /** Stop saving (the post is being sent). */
  cancel: () => void
  /** Saving again after a failed send. */
  resume: () => void
  /** Delete the server copy. */
  discard: () => Promise<void>
  /** After a 409: overwrite the other device's draft. */
  keepMine: () => void
  /** After a 409: replace the local text with the other device's draft. */
  loadTheirs: () => Promise<void>
}

interface UseServerDraftOptions {
  draftKey: string
  /** The `data` object for the current content, or null when there's nothing worth keeping. */
  data: DraftData | null
  /** Applies a server draft to the local one; return false when it doesn't belong here. */
  restore: (data: DraftData) => boolean
  /** Server drafts are restored only into an empty composer. */
  isLocalEmpty: () => boolean
}

/** Last known sequence per key, shared by every composer in the window. */
const sequences = new Map<string, number>()

export function parseDraftData(raw: string | null | undefined): DraftData | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as DraftData) : null
  } catch {
    return null
  }
}

export function draftString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Server drafts (COMP-06) alongside the local ones: loaded when a composer
 * opens (restored only into an empty composer), saved at most every five
 * seconds while typing and once more on close. Failures quietly fall back
 * to the local draft; a sequence conflict (409) asks the user.
 */
export function useServerDraft({ draftKey, data, restore, isLocalEmpty }: UseServerDraftOptions): ServerDraft {
  const [status, setStatus] = useState<DraftSyncStatus>('idle')
  const serialized = data ? JSON.stringify(data) : null
  const latest = useRef({ serialized, restore, isLocalEmpty })
  /** What the server holds; undefined until loaded, so nothing overwrites a draft not yet seen. */
  const saved = useRef<string | null | undefined>(undefined)
  const paused = useRef(false)
  const conflicted = useRef(false)
  /** Bumped per key, so a late save for a previous key doesn't touch the current state. */
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    latest.current = { serialized, restore, isLocalEmpty }
  })

  const path = `/drafts/${encodeURIComponent(draftKey)}.json`

  const save = useCallback(
    async (force = false): Promise<void> => {
      const content = latest.current.serialized
      const current = generation.current
      if (saved.current === undefined || content === saved.current) return
      setStatus('saving')
      try {
        if (content === null) {
          await apiRequest({ method: 'DELETE', path, query: { sequence: sequences.get(draftKey) ?? 0 }, priority: 'background' })
        } else {
          const form: FormField[] = [
            ['draft_key', draftKey],
            ['data', content],
            ['sequence', sequences.get(draftKey) ?? 0]
          ]
          if (force) form.push(['force_save', 'true'])
          const reply = await apiRequest<DraftSaveResponse>({ method: 'POST', path: '/drafts.json', form, priority: 'background' })
          if (typeof reply.draft_sequence === 'number') sequences.set(draftKey, reply.draft_sequence)
        }
        if (current !== generation.current) return
        saved.current = content
        conflicted.current = false
        setStatus(content === null ? 'idle' : 'saved')
      } catch (error) {
        if (current !== generation.current) return
        if (isApiErrorKind(error, 'conflict')) {
          conflicted.current = true
          setStatus('conflict')
        } else {
          setStatus('local')
        }
      }
    },
    [draftKey, path]
  )

  const schedule = useCallback(() => {
    clearTimeout(timer.current)
    if (paused.current || conflicted.current || saved.current === undefined) return
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS)
  }, [save])

  // Load once per key.
  useEffect(() => {
    let cancelled = false
    generation.current++
    saved.current = undefined
    paused.current = false
    conflicted.current = false
    apiRequest<DraftShowResponse>({ path, priority: 'foreground' }).then(
      (reply) => {
        if (cancelled) return
        sequences.set(draftKey, reply.draft_sequence ?? 0)
        saved.current = reply.draft ?? null
        const parsed = parseDraftData(reply.draft)
        if (parsed && latest.current.isLocalEmpty() && latest.current.restore(parsed)) setStatus('saved')
        if (latest.current.serialized !== saved.current) schedule()
      },
      () => {
        if (cancelled) return
        // Offline or refused: keep the local draft only; saving retries on the next change.
        saved.current = null
        setStatus('local')
      }
    )
    return () => {
      cancelled = true
    }
  }, [draftKey, path, schedule])

  useEffect(() => {
    if (serialized !== saved.current) schedule()
  }, [serialized, schedule])

  // Save what's pending when the composer closes (or switches key).
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (!paused.current && !conflicted.current && saved.current !== undefined && latest.current.serialized !== saved.current) {
        void save()
      }
    },
    [save]
  )

  const cancel = useCallback(() => {
    paused.current = true
    clearTimeout(timer.current)
  }, [])

  const resume = useCallback(() => {
    paused.current = false
    schedule()
  }, [schedule])

  const discard = useCallback(async () => {
    cancel()
    if (!saved.current) return
    try {
      await apiRequest({ method: 'DELETE', path, priority: 'background' })
      saved.current = null
    } catch {
      // The local draft is gone either way; a stale server copy is only offered into an empty composer.
    }
  }, [cancel, path])

  const keepMine = useCallback(() => {
    conflicted.current = false
    void save(true)
  }, [save])

  const loadTheirs = useCallback(async () => {
    try {
      const reply = await apiRequest<DraftShowResponse>({ path, priority: 'user' })
      sequences.set(draftKey, reply.draft_sequence ?? 0)
      saved.current = reply.draft ?? null
      const parsed = parseDraftData(reply.draft)
      if (parsed) latest.current.restore(parsed)
      conflicted.current = false
      setStatus('saved')
    } catch {
      setStatus('conflict')
    }
  }, [draftKey, path])

  return { status, cancel, resume, discard, keepMine, loadTheirs }
}
