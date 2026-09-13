import { SendHorizontal } from 'lucide-react'
import { useCallback, useEffect, useState, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { useComposer, type ReplyTarget } from './composer-store'
import { DiscardDialog } from './DiscardDialog'
import { DockFrame } from './DockFrame'
import { replyDraftKey, useDrafts } from './drafts-store'
import { DraftStatus } from './DraftStatus'
import { useComposerErrorMessage } from './errors'
import { appendBlock, quoteBlock } from './markdown-actions'
import { MarkdownEditor } from './MarkdownEditor'
import styles from './ReplyDock.module.css'
import { usePostLimits } from './use-post-limits'
import { useSubmitReply } from './use-publish'
import { useSendShortcut } from './use-send-shortcut'
import { draftString, topicDraftKey, useServerDraft } from './use-server-draft'

/** Targets whose quote is already in the draft: each `openReply` call adds its quote once. */
const appliedQuotes = new WeakSet<ReplyTarget>()

/**
 * The reply composer, docked under the main column so the thread stays
 * readable above it. Text lives in a local draft per topic and reply target,
 * synced to the topic's server draft.
 */
export function ReplyDock({ target }: { target: ReplyTarget }): React.JSX.Element {
  const { t } = useTranslation()
  const close = useComposer((state) => state.close)
  const key = replyDraftKey(target)
  const raw = useDrafts((state) => state.replies[key]?.raw ?? '')
  const setReply = useDrafts((state) => state.setReply)
  const clearReply = useDrafts((state) => state.clearReply)
  const submit = useSubmitReply()
  const resetSubmit = submit.reset
  const errorMessage = useComposerErrorMessage()
  const { hint: shortcutHint } = useSendShortcut()
  const { maxPostLength } = usePostLimits()
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const onChange = useCallback((next: SetStateAction<string>) => setReply(key, next), [key, setReply])

  useEffect(() => {
    const quote = target.quote
    if (!quote || appliedQuotes.has(target)) return
    appliedQuotes.add(target)
    setReply(key, (current) => appendBlock(current, quoteBlock(quote, target.topicId)))
  }, [target, key, setReply])

  useEffect(() => {
    setNotice(null)
    resetSubmit()
  }, [key, resetSubmit])

  const replyTo = target.replyToPostNumber ?? null
  const serverDraft = useServerDraft({
    draftKey: topicDraftKey(target.topicId),
    data: raw.trim() ? { reply: raw, action: 'reply', title: target.topicTitle, reply_to_post_number: replyTo, archetypeId: 'regular' } : null,
    restore: (data) => {
      // One server draft per topic: restore it only into the reply it was written for.
      const savedReplyTo = typeof data.reply_to_post_number === 'number' ? data.reply_to_post_number : null
      const text = draftString(data.reply)
      if ((data.action !== undefined && data.action !== 'reply') || savedReplyTo !== replyTo || !text.trim()) return false
      setReply(key, text)
      return true
    },
    isLocalEmpty: () => !useDrafts.getState().replies[key]?.raw.trim()
  })

  const send = (): void => {
    if (submit.isPending) return
    const text = useDrafts.getState().replies[key]?.raw ?? ''
    if (!text.trim()) {
      setNotice(t('composer.emptyBody'))
      return
    }
    if (text.trim().length > maxPostLength) {
      setNotice(t('composer.bodyTooLong', { count: maxPostLength }))
      return
    }
    if (uploading) {
      setNotice(t('composer.waitUploads'))
      return
    }
    setNotice(null)
    serverDraft.cancel()
    submit.mutate({ target, raw: text }, { onError: () => serverDraft.resume() })
  }

  const requestClose = (): void => {
    if (useDrafts.getState().replies[key]?.raw.trim()) setConfirming(true)
    else close()
  }

  const cancelClose = useCallback(() => setConfirming(false), [])

  const heading = target.replyToUsername
    ? t('composer.reply.titleUser', { username: target.replyToUsername })
    : t('composer.reply.title', { title: target.topicTitle })
  const message = submit.error ? errorMessage(submit.error) : notice

  return (
    <>
      <DockFrame
        heading={heading}
        subheading={target.replyToUsername ? target.topicTitle : undefined}
        sessionKey={target}
        onRequestClose={requestClose}
      >
        {(resized) => (
          <>
            <MarkdownEditor
              key={key}
              value={raw}
              onChange={onChange}
              placeholder={t('composer.reply.placeholder')}
              onSubmit={send}
              layout={resized ? 'fill' : 'auto'}
              minHeight={96}
              maxHeight={560}
              autoFocus
              previewSize="reply"
              maxLength={maxPostLength}
              topicId={target.topicId}
              onUploadingChange={setUploading}
            />
            <div className={styles.footer}>
              {message ? (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              ) : (
                <span className={styles.hint}>{shortcutHint}</span>
              )}
              <DraftStatus sync={serverDraft} />
              <Button
                className={styles.send}
                variant="primary"
                icon={<SendHorizontal fill="currentColor" />}
                disabled={submit.isPending}
                onClick={send}
              >
                {submit.isPending ? t('composer.reply.sending') : t('composer.reply.send')}
              </Button>
            </div>
          </>
        )}
      </DockFrame>

      <DiscardDialog
        open={confirming}
        onCancel={cancelClose}
        onKeep={() => {
          setConfirming(false)
          close()
        }}
        onDiscard={() => {
          setConfirming(false)
          clearReply(key)
          void serverDraft.discard()
          close()
        }}
      />
    </>
  )
}
