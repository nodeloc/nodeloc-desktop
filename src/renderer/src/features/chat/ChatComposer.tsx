import type { UploadResult } from '@shared/api'
import { CircleAlert, Paperclip, Pencil, Reply, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiException } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { IconButton } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { absoluteUrl } from '../../lib/discourse'
import styles from './ChatComposer.module.css'
import { htmlToText, isImageUpload } from './chat-text'
import type { ChatUpload, TimelineMessage } from './types'

interface ComposerUpload {
  key: number
  name: string
  status: 'uploading' | 'done' | 'failed'
  upload?: ChatUpload
  error?: string
}

const MAX_INPUT_HEIGHT = 200

let nextUploadKey = 0

function toChatUpload(result: UploadResult): ChatUpload {
  return {
    id: result.id,
    url: result.url,
    short_url: result.short_url,
    original_filename: result.original_filename,
    width: result.width,
    height: result.height,
    extension: result.extension,
    filesize: result.filesize,
    human_filesize: result.human_filesize
  }
}

interface ChatComposerProps {
  placeholder: string
  replyTo?: TimelineMessage | null
  editing?: TimelineMessage | null
  disabled?: boolean
  /** Margins for the main column; the detail panel sits flush. */
  inset?: boolean
  onCancelReply?: () => void
  onCancelEdit?: () => void
  /** Resolve false to keep the text (a failed edit). */
  onSubmit: (text: string, uploads: ChatUpload[]) => boolean | Promise<boolean>
  /** ArrowUp in an empty box edits your last message. */
  onEditLast?: () => void
}

/**
 * Chat input: Enter sends, Shift+Enter breaks the line. Pasted or dropped
 * files upload straight away and go out with the next message.
 */
export function ChatComposer({
  placeholder,
  replyTo,
  editing,
  disabled = false,
  inset = false,
  onCancelReply,
  onCancelEdit,
  onSubmit,
  onEditLast
}: ChatComposerProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [text, setText] = useState('')
  const [uploads, setUploads] = useState<ComposerUpload[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  /** What was typed before editing started, restored afterwards. */
  const draft = useRef('')
  const editingId = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (editing && editingId.current !== editing.id) {
      if (editingId.current === undefined) draft.current = text
      setText(editing.message)
      input.current?.focus()
    } else if (!editing && editingId.current !== undefined) {
      setText(draft.current)
      draft.current = ''
    }
    editingId.current = editing?.id
  }, [editing])

  useEffect(() => {
    if (replyTo) input.current?.focus()
  }, [replyTo])

  useEffect(() => {
    const element = input.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [text])

  const addFiles = (files: File[]): void => {
    if (files.length === 0 || editing || disabled) return
    for (const file of files) {
      const key = ++nextUploadKey
      const name = file.name || 'file'
      setUploads((list) => [...list, { key, name, status: 'uploading' }])
      void (async () => {
        try {
          const result = await window.nodeloc.api.upload({
            fileName: name,
            mimeType: file.type || 'application/octet-stream',
            data: await file.arrayBuffer(),
            uploadType: 'chat-composer'
          })
          if (!result.ok) throw new ApiException(result.error)
          setUploads((list) => list.map((item) => (item.key === key ? { ...item, status: 'done', upload: toChatUpload(result.data) } : item)))
        } catch (error) {
          const message = errorMessage(error)
          setUploads((list) => list.map((item) => (item.key === key ? { ...item, status: 'failed', error: message } : item)))
          showToast(message, 'danger')
        }
      })()
    }
  }

  const uploading = uploads.some((item) => item.status === 'uploading')
  const attached = uploads.flatMap((item) => (item.status === 'done' && item.upload ? [item.upload] : []))
  const canSubmit = !disabled && !submitting && !uploading && (text.trim().length > 0 || (!editing && attached.length > 0))

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    setSubmitting(true)
    const result = onSubmit(text.trim(), editing ? [] : attached)
    const clear = typeof result === 'boolean' ? result : await result
    setSubmitting(false)
    if (!clear) return
    setText('')
    if (!editing) setUploads([])
    input.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape' && (editing || replyTo)) {
      event.preventDefault()
      if (editing) onCancelEdit?.()
      else onCancelReply?.()
    } else if (event.key === 'ArrowUp' && !text && !editing && onEditLast) {
      event.preventDefault()
      onEditLast()
    }
  }

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = [...event.clipboardData.files]
    if (files.length === 0) return
    event.preventDefault()
    addFiles(files)
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files') || editing) return
    event.preventDefault()
    setDragging(true)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.files.length) return
    event.preventDefault()
    setDragging(false)
    addFiles([...event.dataTransfer.files])
  }

  return (
    <div
      className={cx(styles.composer, inset && styles.inset, dragging && styles.dragging)}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {(editing || replyTo) && (
        <div className={styles.banner}>
          {editing ? <Pencil /> : <Reply />}
          <span className={styles.bannerTitle}>
            {editing ? t('chat.composer.editing') : t('chat.composer.replyingTo', { username: replyTo!.user.username })}
          </span>
          <span className={styles.bannerExcerpt}>{!editing && replyTo ? htmlToText(replyTo.cooked) : ''}</span>
          <IconButton size="sm" label={t('chat.composer.cancel')} onClick={editing ? onCancelEdit : onCancelReply}>
            <X />
          </IconButton>
        </div>
      )}

      {uploads.length > 0 && (
        <ul className={styles.uploads}>
          {uploads.map((item) => (
            <li key={item.key} className={cx(styles.upload, item.status === 'failed' && styles.uploadFailed)} title={item.error ?? item.name}>
              {item.status === 'uploading' ? (
                <Spinner size={18} />
              ) : item.status === 'failed' ? (
                <CircleAlert />
              ) : item.upload && isImageUpload(item.upload) ? (
                <img className={styles.thumb} src={absoluteUrl(item.upload.url)} alt="" draggable={false} />
              ) : (
                <Paperclip />
              )}
              <span className={styles.uploadName}>{item.status === 'uploading' ? t('chat.composer.uploading') : item.name}</span>
              {item.status !== 'uploading' && (
                <IconButton
                  size="sm"
                  label={t('chat.composer.removeUpload')}
                  onClick={() => setUploads((list) => list.filter((other) => other.key !== item.key))}
                >
                  <X />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.inputRow}>
        {!editing && (
          <IconButton label={t('chat.composer.attach')} disabled={disabled} onClick={() => fileInput.current?.click()}>
            <Paperclip />
          </IconButton>
        )}
        <textarea
          ref={input}
          className={styles.input}
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <IconButton
          label={t('chat.composer.send')}
          className={cx(styles.send, canSubmit && styles.sendReady)}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          <SendHorizontal fill="currentColor" />
        </IconButton>
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          addFiles([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />
    </div>
  )
}
