import { SendHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { cx } from '../../lib/cx'
import { hasComposerOverlay } from './composer-overlay'
import { useComposer, type MessageOptions } from './composer-store'
import { DiscardDialog } from './DiscardDialog'
import { useDrafts } from './drafts-store'
import { DraftStatus } from './DraftStatus'
import { useComposerErrorMessage } from './errors'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'
import styles from './NewTopicDialog.module.css'
import { RecipientInput } from './RecipientInput'
import { usePostLimits } from './use-post-limits'
import { useSubmitMessage } from './use-publish'
import { useSendShortcut } from './use-send-shortcut'
import { draftString, NEW_MESSAGE_DRAFT_KEY, useServerDraft } from './use-server-draft'

/** Core's `min_personal_message_title_length` default; the site value isn't exposed to API clients. */
const MIN_MESSAGE_TITLE_LENGTH = 2
const MAX_TITLE_LENGTH = 255

const titleLength = (title: string): number => Array.from(title.trim()).length

function draftRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  return draftString(value)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

/** A new private message (INBOX-05): recipients, title, body. Kept as a local and a server draft. */
export function MessageDialog({ options }: { options: MessageOptions }): React.JSX.Element {
  const { t } = useTranslation()
  const close = useComposer((state) => state.close)
  const draft = useDrafts((state) => state.message)
  const updateMessage = useDrafts((state) => state.updateMessage)
  const clearMessage = useDrafts((state) => state.clearMessage)
  const submit = useSubmitMessage()
  const errorMessage = useComposerErrorMessage()
  const { hint: shortcutHint } = useSendShortcut()
  const { maxPostLength } = usePostLimits()
  const [attempted, setAttempted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const confirmingRef = useRef(false)
  const appliedOptions = useRef<MessageOptions | null>(null)

  const recipients = draft?.recipients ?? []
  const title = draft?.title ?? ''
  const raw = draft?.raw ?? ''

  useEffect(() => {
    confirmingRef.current = confirming
  })

  // Once per `openMessage` call: recipients given by the caller replace the draft's; a title fills an empty one.
  useEffect(() => {
    if (appliedOptions.current === options) return
    appliedOptions.current = options
    if (!options.recipients?.length && !options.title) return
    updateMessage((current) => ({
      recipients: options.recipients?.length ? options.recipients : current.recipients,
      title: current.title.trim() ? current.title : (options.title ?? current.title)
    }))
  }, [options, updateMessage])

  useEffect(() => {
    // The dialog focuses the recipient field; with recipients given, start at the title.
    const frame = requestAnimationFrame(() => {
      if (options.recipients?.length) titleInput.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [options])

  const serverDraft = useServerDraft({
    draftKey: NEW_MESSAGE_DRAFT_KEY,
    data:
      title.trim() || raw.trim()
        ? { reply: raw, action: 'privateMessage', title, recipients: recipients.join(','), archetypeId: 'private_message' }
        : null,
    restore: (data) => {
      updateMessage((current) => ({
        title: draftString(data.title),
        raw: draftString(data.reply),
        recipients: current.recipients.length ? current.recipients : draftRecipients(data.recipients)
      }))
      return true
    },
    isLocalEmpty: () => {
      const current = useDrafts.getState().message
      return !current || (!current.title.trim() && !current.raw.trim())
    }
  })

  const setRaw = useCallback(
    (next: SetStateAction<string>) =>
      updateMessage((current) => ({ raw: typeof next === 'function' ? next(current.raw) : next })),
    [updateMessage]
  )

  const send = (): void => {
    if (submit.isPending) return
    const current = useDrafts.getState().message
    setAttempted(true)
    if (!current?.recipients.length || titleLength(current.title) < MIN_MESSAGE_TITLE_LENGTH) {
      setNotice(null)
      return
    }
    if (!current.raw.trim()) {
      setNotice(t('composer.emptyBody'))
      return
    }
    if (current.raw.trim().length > maxPostLength) {
      setNotice(t('composer.bodyTooLong', { count: maxPostLength }))
      return
    }
    if (uploading) {
      setNotice(t('composer.waitUploads'))
      return
    }
    setNotice(null)
    serverDraft.cancel()
    submit.mutate(
      { recipients: current.recipients, title: current.title.trim(), raw: current.raw },
      { onError: () => serverDraft.resume() }
    )
  }

  // Stable: the dialog re-runs its focus handling whenever `onClose` changes.
  const requestClose = useCallback(() => {
    if (hasComposerOverlay() || confirmingRef.current) return
    const current = useDrafts.getState().message
    if (current?.title.trim() || current?.raw.trim()) setConfirming(true)
    else close()
  }, [close])

  const cancelClose = useCallback(() => setConfirming(false), [])

  const recipientsMissing = attempted && recipients.length === 0
  const titleTooShort = attempted && titleLength(title) < MIN_MESSAGE_TITLE_LENGTH
  const message = submit.error ? errorMessage(submit.error) : notice

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        width={720}
        title={t('composer.message.title')}
        footer={
          <>
            <span className={styles.footerNote}>
              {message ? (
                <span className={styles.error} role="alert">
                  {message}
                </span>
              ) : (
                shortcutHint
              )}
            </span>
            <DraftStatus sync={serverDraft} />
            <Button variant="primary" icon={<SendHorizontal fill="currentColor" />} disabled={submit.isPending} onClick={send}>
              {submit.isPending ? t('composer.message.sending') : t('composer.message.send')}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="composer-recipients">
              {t('composer.message.recipients')}
            </label>
            <RecipientInput
              id="composer-recipients"
              value={recipients}
              onChange={(next) => updateMessage(() => ({ recipients: next }))}
              invalid={recipientsMissing}
            />
            {recipientsMissing && <p className={styles.fieldError}>{t('composer.message.recipientsRequired')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="composer-message-title">
              {t('composer.message.titleLabel')}
            </label>
            <input
              id="composer-message-title"
              ref={titleInput}
              className={cx(styles.titleInput, titleTooShort && styles.invalid)}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={t('composer.message.titlePlaceholder')}
              autoComplete="off"
              aria-invalid={titleTooShort}
              onChange={(event) => updateMessage(() => ({ title: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (event.ctrlKey || event.metaKey) send()
                else editor.current?.focus()
              }}
            />
            {titleTooShort && (
              <p className={styles.fieldError}>{t('composer.message.titleTooShort', { count: MIN_MESSAGE_TITLE_LENGTH })}</p>
            )}
          </div>

          <MarkdownEditor
            ref={editor}
            value={raw}
            onChange={setRaw}
            placeholder={t('composer.message.bodyPlaceholder')}
            onSubmit={send}
            minHeight={220}
            maxHeight={440}
            previewSize="body"
            maxLength={maxPostLength}
            onUploadingChange={setUploading}
          />
        </div>
      </Dialog>

      <DiscardDialog
        open={confirming}
        onCancel={cancelClose}
        onKeep={() => {
          setConfirming(false)
          close()
        }}
        onDiscard={() => {
          setConfirming(false)
          clearMessage()
          void serverDraft.discard()
          close()
        }}
      />
    </>
  )
}
