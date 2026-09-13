import { SendHorizontal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useCategoryIndex, useFeatures } from '../../api/site'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { cx } from '../../lib/cx'
import { useCurrentUser } from '../account/use-session'
import { hasComposerOverlay } from './composer-overlay'
import { useComposer, type NewTopicOptions } from './composer-store'
import { DiscardDialog } from './DiscardDialog'
import { useDrafts } from './drafts-store'
import { DraftStatus } from './DraftStatus'
import { useComposerErrorMessage } from './errors'
import { useLotteryLimits, validateLottery } from './lottery'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'
import styles from './NewTopicDialog.module.css'
import { NodePicker } from './NodePicker'
import { validateRedEnvelope } from './red-envelope'
import { TagInput } from './TagInput'
import { TopicExtras } from './TopicExtras'
import { usePostLimits } from './use-post-limits'
import { useSubmitTopic } from './use-publish'
import { useSendShortcut } from './use-send-shortcut'
import { draftString, NEW_TOPIC_DRAFT_KEY, useServerDraft } from './use-server-draft'

const MAX_TITLE_LENGTH = 255

const titleLength = (title: string): number => Array.from(title.trim()).length

/**
 * New topic: node, title, body and topic options in a wide dialog.
 * Everything is kept in a local draft, so closing loses nothing unless discarded.
 */
export function NewTopicDialog({ options }: { options: NewTopicOptions }): React.JSX.Element {
  const { t } = useTranslation()
  const close = useComposer((state) => state.close)
  const index = useCategoryIndex()
  const features = useFeatures()
  const user = useCurrentUser()
  const draft = useDrafts((state) => state.topic)
  const updateTopic = useDrafts((state) => state.updateTopic)
  const clearTopic = useDrafts((state) => state.clearTopic)
  const submit = useSubmitTopic()
  const errorMessage = useComposerErrorMessage()
  const { hint: shortcutHint } = useSendShortcut()
  const { minTitleLength, maxPostLength } = usePostLimits()
  const [attempted, setAttempted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)
  const editor = useRef<MarkdownEditorHandle>(null)
  const confirmingRef = useRef(false)
  const indexRef = useRef(index)
  const appliedOptions = useRef<NewTopicOptions | null>(null)

  const title = draft?.title ?? ''
  const raw = draft?.raw ?? ''
  const categoryId = draft?.categoryId
  const node = categoryId ? index?.byId.get(categoryId) : undefined

  // Plugin options only count while the plugin is installed.
  const lottery = features?.lottery ? (draft?.lottery ?? null) : null
  const redEnvelope = features?.red_envelope ? (draft?.redEnvelope ?? null) : null
  const staff = Boolean(user?.staff || user?.admin || user?.moderator)
  const lotteryCap = useLotteryLimits(Boolean(lottery)).data?.min_participants_cap ?? null
  const lotteryProblem = lottery ? validateLottery(lottery, { cap: lotteryCap, staff }) : null
  const redEnvelopeProblem = redEnvelope ? validateRedEnvelope(redEnvelope, user?.gamification_score) : null

  // An untouched node template isn't worth a server draft.
  const bodyWorthSaving = raw.trim() !== '' && raw.trim() !== (node?.topic_template?.trim() ?? '')
  const serverDraft = useServerDraft({
    draftKey: NEW_TOPIC_DRAFT_KEY,
    data:
      title.trim() || bodyWorthSaving
        ? { reply: raw, action: 'createTopic', title, categoryId: categoryId ?? null, tags: draft?.tags ?? [], archetypeId: 'regular' }
        : null,
    restore: (data) => {
      updateTopic((current) => ({
        title: draftString(data.title),
        raw: draftString(data.reply),
        categoryId: typeof data.categoryId === 'number' ? data.categoryId : current.categoryId,
        tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : current.tags
      }))
      return true
    },
    isLocalEmpty: () => {
      const current = useDrafts.getState().topic
      const template = current?.categoryId ? indexRef.current?.byId.get(current.categoryId)?.topic_template?.trim() : undefined
      const body = current?.raw.trim() ?? ''
      return !current?.title.trim() && (body === '' || body === template)
    }
  })

  useEffect(() => {
    confirmingRef.current = confirming
    indexRef.current = index
  })

  /** Picks a node and fills its template into an empty body (or swaps an untouched template). */
  const chooseNode = useCallback(
    (id: number) => {
      updateTopic((current) => {
        const previous = current.categoryId ? indexRef.current?.byId.get(current.categoryId) : undefined
        const template = indexRef.current?.byId.get(id)?.topic_template ?? ''
        const body = current.raw.trim()
        const untouched = body === '' || (!!previous?.topic_template && body === previous.topic_template.trim())
        return { categoryId: id, raw: untouched ? template : current.raw }
      })
    },
    [updateTopic]
  )

  // Once per `openNewTopic` call, when node data is available: apply the preselected node.
  useEffect(() => {
    if (!index || appliedOptions.current === options) return
    appliedOptions.current = options
    const id = options.categoryId ?? useDrafts.getState().topic?.categoryId
    if (id) chooseNode(id)
  }, [index, options, chooseNode])

  useEffect(() => {
    // The dialog focuses its first control (the node picker); with a node already chosen, start at the title.
    const frame = requestAnimationFrame(() => {
      if (options.categoryId ?? useDrafts.getState().topic?.categoryId) titleInput.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [options])

  const setRaw = useCallback(
    (next: SetStateAction<string>) =>
      updateTopic((current) => ({ raw: typeof next === 'function' ? next(current.raw) : next })),
    [updateTopic]
  )

  const publish = (): void => {
    if (submit.isPending) return
    const current = useDrafts.getState().topic
    setAttempted(true)
    if (!current?.categoryId || titleLength(current.title) < minTitleLength) {
      setNotice(null)
      return
    }
    if (lotteryProblem || redEnvelopeProblem) {
      setNotice(t('composer.extrasInvalid'))
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
      {
        categoryId: current.categoryId,
        title: current.title.trim(),
        raw: current.raw,
        tags: current.tags,
        readPermission: current.readPermission ?? null,
        lottery,
        redEnvelope
      },
      { onError: () => serverDraft.resume() }
    )
  }

  // Stable: the dialog re-runs its focus handling whenever `onClose` changes.
  const requestClose = useCallback(() => {
    // Esc while a popup (node list, suggestions, poll builder) is open only closes that.
    if (hasComposerOverlay() || confirmingRef.current) return
    const current = useDrafts.getState().topic
    const template = current?.categoryId ? indexRef.current?.byId.get(current.categoryId)?.topic_template?.trim() : undefined
    const body = current?.raw.trim() ?? ''
    const dirty = Boolean(current?.title.trim()) || (body !== '' && body !== template)
    if (dirty) setConfirming(true)
    else close()
  }, [close])

  const cancelClose = useCallback(() => setConfirming(false), [])

  const nodeMissing = attempted && !categoryId
  const titleTooShort = attempted && titleLength(title) < minTitleLength
  const message = submit.error ? errorMessage(submit.error) : notice

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        width={760}
        title={t('composer.topic.title')}
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
            <Button variant="primary" icon={<SendHorizontal fill="currentColor" />} disabled={submit.isPending} onClick={publish}>
              {submit.isPending ? t('composer.topic.publishing') : t('composer.topic.publish')}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="composer-node">
              {t('composer.topic.node')}
            </label>
            <NodePicker
              id="composer-node"
              value={categoryId}
              onChange={(id) => {
                chooseNode(id)
                requestAnimationFrame(() => titleInput.current?.focus())
              }}
              invalid={nodeMissing}
            />
            {nodeMissing && <p className={styles.fieldError}>{t('composer.topic.nodeRequired')}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="composer-title">
              {t('composer.topic.titleLabel')}
            </label>
            <input
              id="composer-title"
              ref={titleInput}
              className={cx(styles.titleInput, titleTooShort && styles.invalid)}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder={node?.topic_title_placeholder || t('composer.topic.titlePlaceholder')}
              autoComplete="off"
              aria-invalid={titleTooShort}
              onChange={(event) => updateTopic(() => ({ title: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (event.ctrlKey || event.metaKey) publish()
                else editor.current?.focus()
              }}
            />
            {titleTooShort && <p className={styles.fieldError}>{t('composer.topic.titleTooShort', { count: minTitleLength })}</p>}
          </div>

          <TagInput value={draft?.tags ?? []} onChange={(tags) => updateTopic(() => ({ tags }))} categoryId={categoryId} />

          <MarkdownEditor
            ref={editor}
            value={raw}
            onChange={setRaw}
            placeholder={t('composer.topic.bodyPlaceholder')}
            onSubmit={publish}
            minHeight={240}
            maxHeight={460}
            previewSize="body"
            maxLength={maxPostLength}
            onUploadingChange={setUploading}
          />

          <TopicExtras
            readPermission={draft?.readPermission ?? null}
            onReadPermissionChange={(value) => updateTopic(() => ({ readPermission: value }))}
            lottery={lottery}
            onLotteryChange={(next) => updateTopic(() => ({ lottery: next }))}
            lotteryProblem={attempted && lotteryProblem ? t(`composer.lottery.errors.${lotteryProblem.key}`, lotteryProblem.values ?? {}) : null}
            lotteryCap={staff ? null : lotteryCap}
            redEnvelope={redEnvelope}
            onRedEnvelopeChange={(next) => updateTopic(() => ({ redEnvelope: next }))}
            redEnvelopeProblem={attempted && redEnvelopeProblem ? t(`composer.redEnvelope.errors.${redEnvelopeProblem}`) : null}
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
          clearTopic()
          void serverDraft.discard()
          close()
        }}
      />
    </>
  )
}
