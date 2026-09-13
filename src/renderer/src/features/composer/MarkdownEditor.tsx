import { CircleAlert, Clock, LoaderCircle, RotateCw, Upload, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  type SetStateAction
} from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { detectTrigger, type Trigger } from './autocomplete'
import { caretBox, type CaretBox } from './caret-position'
import { useComposerOverlay } from './composer-overlay'
import { EditorToolbar, type EditorMode, type ToolbarAction } from './EditorToolbar'
import {
  applyToTextarea,
  currentEditState,
  insertLink,
  insertOnOwnLine,
  shiftSelection,
  toggleLinePrefix,
  toggleSpoiler,
  toggleTagged,
  toggleWrap,
  wrapBlock,
  type EditState
} from './markdown-actions'
import styles from './MarkdownEditor.module.css'
import { MarkdownPreview } from './MarkdownPreview'
import { PollBuilderDialog } from './PollBuilderDialog'
import { countPolls } from './poll-markdown'
import { SuggestionList } from './SuggestionList'
import { useAutocompleteOptions } from './use-autocomplete'
import { useSendShortcut } from './use-send-shortcut'
import { useUploads } from './use-uploads'

export interface MarkdownEditorHandle {
  focus: () => void
}

interface MarkdownEditorProps {
  ref?: Ref<MarkdownEditorHandle>
  value: string
  /** Accepts an updater: upload results arrive after the text has moved on. */
  onChange: (next: SetStateAction<string>) => void
  placeholder?: string
  /** Called by the send shortcut. */
  onSubmit?: () => void
  /** `auto` grows with the text between min and max height; `fill` fills its container. */
  layout?: 'auto' | 'fill'
  minHeight?: number
  maxHeight?: number
  autoFocus?: boolean
  previewSize?: 'body' | 'reply'
  /** Reports whether uploads are still running, so the parent can hold the post. */
  onUploadingChange?: (busy: boolean) => void
  /** The site's `max_post_length`: the counter shows it and turns red past it. */
  maxLength?: number
  /** Scopes `@` suggestions to the topic's participants. */
  topicId?: number
  className?: string
}

const DEFAULT_PAY_AMOUNT = 10

function transform(action: ToolbarAction, state: EditState, sample: (key: string) => string): EditState {
  switch (action) {
    case 'bold':
      return toggleWrap(state, '**', '**', sample('bold'))
    case 'italic':
      return toggleWrap(state, '*', '*', sample('italic'))
    case 'strikethrough':
      return toggleWrap(state, '~~', '~~', sample('strikethrough'))
    case 'heading':
      return toggleLinePrefix(state, 'heading')
    case 'quote':
      return toggleLinePrefix(state, 'quote')
    case 'code':
      return toggleWrap(state, '`', '`', sample('code'))
    case 'codeBlock':
      return wrapBlock(state, '```', '```', sample('code'))
    case 'link':
      return insertLink(state, sample('link'))
    case 'bulletList':
      return toggleLinePrefix(state, 'bullet')
    case 'numberedList':
      return toggleLinePrefix(state, 'number')
    case 'spoiler':
      return toggleSpoiler(state, sample('spoiler'))
    case 'hiddenReply':
      return toggleTagged(state, '[reply]', '[/reply]', sample('hidden'))
    case 'hiddenLogin':
      return toggleTagged(state, '[login]', '[/login]', sample('hidden'))
    case 'hiddenPay':
      // Exactly this form: one space, lowercase `amount=`, an unquoted integer. Anything else is stripped.
      return toggleTagged(state, `[pay amount=${DEFAULT_PAY_AMOUNT}]`, '[/pay]', sample('hidden'))
  }
}

const SHORTCUTS: Record<string, ToolbarAction> = { b: 'bold', i: 'italic', k: 'link' }

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * Markdown source editor: toolbar, shortcuts, `@`/`:`/`#` autocomplete,
 * uploads by button, paste or drop, a poll builder and a local preview. The
 * text is controlled by the parent (a draft store), which is why `onChange`
 * takes updaters.
 */
export function MarkdownEditor({
  ref,
  value,
  onChange,
  placeholder,
  onSubmit,
  layout = 'auto',
  minHeight = 120,
  maxHeight = 480,
  autoFocus = false,
  previewSize = 'reply',
  onUploadingChange,
  maxLength,
  topicId,
  className
}: MarkdownEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const { enterSends } = useSendShortcut()
  const [mode, setMode] = useState<EditorMode>('write')
  const [dropping, setDropping] = useState(false)
  const [pollOpen, setPollOpen] = useState(false)
  const closePoll = useCallback(() => setPollOpen(false), [])
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  /** The last value typed into the textarea itself (the DOM already shows it). */
  const typed = useRef<string | null>(null)
  const previousValue = useRef(value)
  const lastSelection = useRef<[number, number]>([value.length, value.length])
  /** Selection to restore after a value set without the editing command. */
  const pendingSelection = useRef<[number, number] | null>(null)
  const composing = useRef(false)

  // Autocomplete
  const [trigger, setTrigger] = useState<Trigger | null>(null)
  const [anchor, setAnchor] = useState<CaretBox | null>(null)
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  /** Where the user closed suggestions with Esc; they stay closed for that trigger. */
  const dismissedAt = useRef<number | null>(null)
  const suggestionsId = useId()
  const { options: suggestions, loading: suggestionsLoading } = useAutocompleteOptions(trigger, topicId)
  const suggesting = trigger !== null && anchor !== null && mode === 'write' && (suggestions.length > 0 || suggestionsLoading)
  const active = Math.min(activeSuggestion, Math.max(0, suggestions.length - 1))
  useComposerOverlay(suggesting)

  const commit = useCallback(
    (next: EditState) => {
      const element = textarea.current
      if (element && applyToTextarea(element, next)) return
      pendingSelection.current = [next.selectionStart, next.selectionEnd]
      onChange(next.value)
    },
    [onChange]
  )

  const insertPlaceholders = useCallback(
    (placeholders: string[]) => {
      const element = textarea.current
      if (element) commit(insertOnOwnLine(currentEditState(element), placeholders.join('\n')))
    },
    [commit]
  )

  const uploads = useUploads({ insertPlaceholders, update: onChange })

  useEffect(() => {
    onUploadingChange?.(uploads.busy)
  }, [uploads.busy, onUploadingChange])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        setMode('write')
        requestAnimationFrame(() => textarea.current?.focus())
      }
    }),
    []
  )

  useEffect(() => {
    if (!autoFocus) return
    // After the enclosing dialog or dock has settled its own focus.
    const frame = requestAnimationFrame(() => {
      const element = textarea.current
      if (!element) return
      element.focus()
      element.setSelectionRange(element.value.length, element.value.length)
      element.scrollTop = element.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])

  const grow = (): void => {
    const element = textarea.current
    if (!element || mode === 'preview') return
    if (layout !== 'auto') {
      element.style.height = ''
      return
    }
    element.style.height = 'auto'
    element.style.height = `${Math.min(maxHeight, Math.max(minHeight, element.scrollHeight))}px`
  }

  // Setting a textarea's value from outside moves the caret to the end;
  // put it back where the user was (adjusted for the change).
  useLayoutEffect(() => {
    const element = textarea.current
    const previous = previousValue.current
    previousValue.current = value
    if (!element) return
    if (pendingSelection.current) {
      element.setSelectionRange(...pendingSelection.current)
      pendingSelection.current = null
    } else if (previous !== value && typed.current !== value) {
      element.setSelectionRange(...shiftSelection(previous, value, lastSelection.current))
    }
    lastSelection.current = [element.selectionStart, element.selectionEnd]
    grow()
  }, [value])

  useLayoutEffect(grow, [layout, mode, minHeight, maxHeight])

  const updateTrigger = (element: HTMLTextAreaElement): void => {
    if (composing.current) return
    const next = element.selectionStart === element.selectionEnd ? detectTrigger(element.value, element.selectionStart) : null
    if (!next) dismissedAt.current = null
    if (!next || dismissedAt.current === next.start) {
      setTrigger(null)
      return
    }
    if (trigger?.kind !== next.kind || trigger.start !== next.start) setActiveSuggestion(0)
    setTrigger(next)
    setAnchor(caretBox(element, next.start))
  }

  const acceptSuggestion = (index: number): void => {
    const element = textarea.current
    const option = suggestions[index]
    if (!element || !trigger || !option) return
    const text = element.value
    const caret = element.selectionStart
    const position = trigger.start + option.insert.length
    commit({ value: text.slice(0, trigger.start) + option.insert + text.slice(caret), selectionStart: position, selectionEnd: position })
    setTrigger(null)
  }

  const runAction = (action: ToolbarAction): void => {
    const element = textarea.current
    if (!element) return
    commit(transform(action, currentEditState(element), (key) => t(`composer.editor.sample.${key}`)))
  }

  const handleSelect = (): void => {
    const element = textarea.current
    if (!element) return
    lastSelection.current = [element.selectionStart, element.selectionEnd]
    updateTrigger(element)
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    typed.current = event.target.value
    lastSelection.current = [event.target.selectionStart, event.target.selectionEnd]
    onChange(event.target.value)
    updateTrigger(event.target)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter confirms an IME composition (Chinese input); it must never send or pick a suggestion.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    const modifier = event.ctrlKey || event.metaKey

    if (suggesting && trigger) {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismissedAt.current = trigger.start
        setTrigger(null)
        return
      }
      if (suggestions.length > 0) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          setActiveSuggestion((active + step + suggestions.length) % suggestions.length)
          return
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && !modifier && !event.shiftKey) {
          event.preventDefault()
          acceptSuggestion(active)
          return
        }
      }
    }

    if (event.key === 'Enter' && onSubmit && (modifier || (enterSends && !event.shiftKey && !event.altKey))) {
      event.preventDefault()
      onSubmit()
      return
    }
    const action = modifier && !event.shiftKey && !event.altKey ? SHORTCUTS[event.key.toLowerCase()] : undefined
    if (action) {
      event.preventDefault()
      runAction(action)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = Array.from(event.clipboardData.files)
    // Office copies text together with a picture of it; paste the text then.
    if (files.length === 0 || event.clipboardData.getData('text/plain').trim()) return
    event.preventDefault()
    uploads.add(files)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropping(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    setDropping(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return
    event.preventDefault()
    uploads.add(files)
  }

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    uploads.add(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const sizeStyle = layout === 'auto' ? { minHeight, maxHeight } : undefined
  const length = value.trim().length

  return (
    <div
      className={cx(styles.editor, layout === 'fill' && styles.fill, dropping && styles.dropping, className)}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <EditorToolbar
        mode={mode}
        onModeChange={setMode}
        onAction={runAction}
        onUpload={() => fileInput.current?.click()}
        onInsertPoll={() => setPollOpen(true)}
      />

      <textarea
        ref={textarea}
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        hidden={mode === 'preview'}
        style={layout === 'auto' ? { minHeight } : undefined}
        aria-autocomplete="list"
        aria-controls={suggesting ? suggestionsId : undefined}
        aria-activedescendant={suggesting && suggestions.length > 0 ? `${suggestionsId}-${active}` : undefined}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => setTrigger(null)}
        onScroll={(event) => {
          if (trigger) setAnchor(caretBox(event.currentTarget, trigger.start))
        }}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={(event) => {
          composing.current = false
          updateTrigger(event.currentTarget)
        }}
      />
      {mode === 'preview' && <MarkdownPreview raw={value} size={previewSize} style={sizeStyle} />}

      <div className={styles.status}>
        {uploads.items.length > 0 && (
          <ul className={styles.uploads}>
            {uploads.items.map((item) => (
              <li
                key={item.id}
                className={styles.upload}
                data-status={item.status}
                title={item.error ? t('composer.upload.failed', { message: item.error }) : undefined}
              >
                {item.status === 'uploading' && <LoaderCircle className={styles.spin} aria-label={t('composer.upload.uploading')} />}
                {item.status === 'queued' && <Clock aria-label={t('composer.upload.queued')} />}
                {item.status === 'failed' && <CircleAlert />}
                <span className={styles.uploadName}>{item.name}</span>
                {item.status === 'failed' && (
                  <>
                    <span className={styles.uploadError} role="alert">
                      {item.error}
                    </span>
                    <button
                      type="button"
                      className={styles.uploadAction}
                      aria-label={t('composer.upload.retry')}
                      title={t('composer.upload.retry')}
                      onClick={() => uploads.retry(item.id)}
                    >
                      <RotateCw />
                    </button>
                    <button
                      type="button"
                      className={styles.uploadAction}
                      aria-label={t('composer.upload.dismiss')}
                      title={t('composer.upload.dismiss')}
                      onClick={() => uploads.dismiss(item.id)}
                    >
                      <X />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <span className={styles.counter} data-over={maxLength !== undefined && length > maxLength}>
          {maxLength ? t('composer.counterMax', { count: length, max: maxLength }) : t('composer.counter', { count: length })}
        </span>
      </div>

      <input ref={fileInput} type="file" multiple hidden onChange={handlePickFiles} />

      {suggesting && anchor && (
        <SuggestionList
          id={suggestionsId}
          items={suggestions}
          active={active}
          anchor={anchor}
          loading={suggestionsLoading}
          onSelect={acceptSuggestion}
          onActiveChange={setActiveSuggestion}
        />
      )}

      {pollOpen && (
        <PollBuilderDialog
          existingPolls={countPolls(value)}
          onClose={closePoll}
          onInsert={(markdown) => {
            const element = textarea.current
            if (element) commit(insertOnOwnLine(currentEditState(element), `${markdown}\n`))
            setPollOpen(false)
            requestAnimationFrame(() => textarea.current?.focus())
          }}
        />
      )}

      {dropping && (
        <div className={styles.dropHint}>
          <Upload strokeWidth={2.5} />
          {t('composer.editor.dropHint')}
        </div>
      )}
    </div>
  )
}
