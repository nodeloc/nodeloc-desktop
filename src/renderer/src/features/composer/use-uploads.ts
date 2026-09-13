import type { UploadResult } from '@shared/api'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { showToast } from '../../components/toast-store'

export type UploadStatus = 'queued' | 'uploading' | 'failed'

export interface UploadItem {
  id: number
  name: string
  status: UploadStatus
  error?: string
}

type TextUpdater = (next: SetStateAction<string>) => void

interface Job {
  id: number
  file: File
  placeholder: string
  /** Updates the text this upload belongs to, captured when it was added. */
  update: TextUpdater
  status: UploadStatus
  error?: string
}

interface QueueCallbacks {
  changed: () => void
  describe: (error: unknown) => string
  /** A failure after the editor closed, with no chip left to show it on. */
  failedDetached: (name: string, message: string) => void
}

/** The server allows 10 uploads a minute per user; keep one in reserve. */
const UPLOADS_PER_MINUTE = 9
const WINDOW_MS = 60_000
const CONCURRENCY = 2

const IMAGE_EXTENSIONS = /^(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|ico|tiff?)$/i
const VIDEO_EXTENSIONS = /^(mp4|mov|webm|mkv|m4v|ogv|avi)$/i
const AUDIO_EXTENSIONS = /^(mp3|ogg|oga|wav|m4a|flac|aac|opus)$/i

/** Start times of recent uploads, shared by every editor: the limit is per account. */
const recentStarts: number[] = []

let nextJobId = 0

/** Milliseconds until another upload may start. */
function slotDelay(now: number): number {
  while (recentStarts.length > 0 && now - recentStarts[0] >= WINDOW_MS) recentStarts.shift()
  return recentStarts.length < UPLOADS_PER_MINUTE ? 0 : recentStarts[0] + WINDOW_MS - now
}

/** Discourse's Markdown for an upload: images with their size, video/audio by kind, anything else as an attachment. */
export function uploadMarkdown(upload: UploadResult): string {
  const extension = upload.extension ?? upload.original_filename.split('.').pop() ?? ''
  const filename = upload.original_filename.replace(/[[\]|]/g, '')
  const name = filename.replace(/\.[^.]+$/, '') || filename
  if (VIDEO_EXTENSIONS.test(extension)) return `![${name}|video](${upload.short_url})`
  if (AUDIO_EXTENSIONS.test(extension)) return `![${name}|audio](${upload.short_url})`
  if (IMAGE_EXTENSIONS.test(extension) || (upload.width && upload.height)) {
    const width = upload.thumbnail_width ?? upload.width
    const height = upload.thumbnail_height ?? upload.height
    return width && height ? `![${name}|${width}x${height}](${upload.short_url})` : `![${name}](${upload.short_url})`
  }
  return `[${filename}|attachment](${upload.short_url})`
}

/**
 * Replaces the first copy of a placeholder, or removes it (with its line
 * break) when `markdown` is null. A placeholder the user deleted stays gone.
 */
function replacePlaceholder(text: string, placeholder: string, markdown: string | null): string {
  const index = text.indexOf(placeholder)
  if (index === -1) return text
  if (markdown !== null) return text.slice(0, index) + markdown + text.slice(index + placeholder.length)
  const ownLine = (index === 0 || text[index - 1] === '\n') && text[index + placeholder.length] === '\n'
  return text.slice(0, index) + text.slice(index + placeholder.length + (ownLine ? 1 : 0))
}

/**
 * Uploads outlive the editor that started them: a closed reply dock still
 * gets its placeholders replaced in the saved draft.
 */
class UploadQueue {
  callbacks: QueueCallbacks = { changed: () => undefined, describe: () => '', failedDetached: () => undefined }
  attached = false
  private jobs: Job[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  snapshot(): UploadItem[] {
    return this.jobs.map(({ id, file, status, error }) => ({ id, name: file.name, status, error }))
  }

  find(id: number): Job | undefined {
    return this.jobs.find((job) => job.id === id)
  }

  add(file: File, placeholder: string, update: TextUpdater): void {
    this.jobs.push({ id: ++nextJobId, file, placeholder, update, status: 'queued' })
    this.callbacks.changed()
    this.pump()
  }

  requeue(id: number, update: TextUpdater): void {
    const job = this.find(id)
    if (!job || job.status !== 'failed') return
    job.status = 'queued'
    job.error = undefined
    job.update = update
    this.callbacks.changed()
    this.pump()
  }

  removeFailed(id: number): void {
    this.jobs = this.jobs.filter((job) => job.id !== id || job.status !== 'failed')
    this.callbacks.changed()
  }

  private pump(): void {
    clearTimeout(this.timer)
    for (const job of this.jobs) {
      if (job.status !== 'queued') continue
      if (this.jobs.filter((other) => other.status === 'uploading').length >= CONCURRENCY) return
      const delay = slotDelay(Date.now())
      if (delay > 0) {
        this.timer = setTimeout(() => this.pump(), delay + 50)
        return
      }
      recentStarts.push(Date.now())
      job.status = 'uploading'
      this.callbacks.changed()
      void this.run(job)
    }
  }

  private async run(job: Job): Promise<void> {
    try {
      const data = await job.file.arrayBuffer()
      const result = await window.nodeloc.api.upload({
        fileName: job.file.name || 'file',
        mimeType: job.file.type || 'application/octet-stream',
        data,
        uploadType: 'composer'
      })
      if (!result.ok) throw new ApiException(result.error)
      const markdown = uploadMarkdown(result.data)
      job.update((text) => replacePlaceholder(text, job.placeholder, markdown))
      this.jobs = this.jobs.filter((other) => other !== job)
    } catch (error) {
      job.update((text) => replacePlaceholder(text, job.placeholder, null))
      job.status = 'failed'
      job.error = this.callbacks.describe(error)
      if (!this.attached) {
        this.jobs = this.jobs.filter((other) => other !== job)
        this.callbacks.failedDetached(job.file.name, job.error)
      }
    }
    this.callbacks.changed()
    this.pump()
  }
}

interface UseUploadsOptions {
  /** Inserts placeholder lines at the caret. */
  insertPlaceholders: (placeholders: string[]) => void
  /** Updates the text; captured per upload so results land in the right draft. */
  update: TextUpdater
}

export interface Uploads {
  items: UploadItem[]
  /** True while anything is queued or uploading. */
  busy: boolean
  add: (files: File[]) => void
  retry: (id: number) => void
  dismiss: (id: number) => void
}

/**
 * Composer uploads: a placeholder goes in at the caret right away and is
 * replaced by the upload's Markdown, or removed with a retryable error.
 * Throttled below the server's per-minute limit.
 */
export function useUploads({ insertPlaceholders, update }: UseUploadsOptions): Uploads {
  const { t } = useTranslation()
  const describe = useErrorMessage()
  const [queue] = useState(() => new UploadQueue())
  const [items, setItems] = useState<UploadItem[]>([])
  const latest = useRef({ insertPlaceholders, update })

  useEffect(() => {
    latest.current = { insertPlaceholders, update }
    queue.callbacks = {
      changed: () => setItems(queue.snapshot()),
      describe,
      failedDetached: (name, message) => showToast(t('composer.upload.failedToast', { name, message }), 'danger')
    }
  })

  useEffect(() => {
    queue.attached = true
    return () => {
      queue.attached = false
    }
  }, [queue])

  const add = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      const placeholders = files.map((file) => t('composer.upload.placeholder', { name: file.name || 'file' }))
      latest.current.insertPlaceholders(placeholders)
      files.forEach((file, index) => queue.add(file, placeholders[index], latest.current.update))
    },
    [queue, t]
  )

  const retry = useCallback(
    (id: number) => {
      const job = queue.find(id)
      if (!job || job.status !== 'failed') return
      latest.current.insertPlaceholders([job.placeholder])
      queue.requeue(id, latest.current.update)
    },
    [queue]
  )

  const dismiss = useCallback((id: number) => queue.removeFailed(id), [queue])

  return { items, busy: items.some((item) => item.status !== 'failed'), add, retry, dismiss }
}
