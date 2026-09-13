import { Check } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../api/client'
import { useFeatures } from '../../api/site'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Spinner } from '../../components/Spinner'
import { cx } from '../../lib/cx'
import { useCurrentUser } from '../account/use-session'
import form from './ComposerForm.module.css'
import { hasComposerOverlay } from './composer-overlay'
import { useComposer, type EditTarget } from './composer-store'
import { DiscardDialog } from './DiscardDialog'
import { DockFrame } from './DockFrame'
import styles from './EditComposer.module.css'
import { useComposerErrorMessage } from './errors'
import { useLotteryLimits, validateLottery, type LotteryConfig } from './lottery'
import { MarkdownEditor } from './MarkdownEditor'
import topicStyles from './NewTopicDialog.module.css'
import { NodePicker } from './NodePicker'
import dockStyles from './ReplyDock.module.css'
import { TagInput } from './TagInput'
import { TopicExtras } from './TopicExtras'
import { editFieldsFrom, PartialEditError, sameEditFields, useEditSource, useSaveEdit, type EditFields } from './use-edit'
import { usePostLimits } from './use-post-limits'
import { useSendShortcut } from './use-send-shortcut'

const MAX_TITLE_LENGTH = 255

const titleLength = (title: string): number => Array.from(title.trim()).length

/**
 * Editing a post. The opening post edits in the wide dialog (title, node,
 * tags, read permission, lottery); replies edit in the dock. No drafts:
 * closing with changes asks before throwing them away.
 */
export function EditComposer({ target }: { target: EditTarget }): React.JSX.Element {
  const { t } = useTranslation()
  const close = useComposer((state) => state.close)
  const source = useEditSource(target)
  const save = useSaveEdit()
  const features = useFeatures()
  const user = useCurrentUser()
  const errorMessage = useComposerErrorMessage()
  const { hint: shortcutHint } = useSendShortcut()
  const { minTitleLength, maxPostLength } = usePostLimits()
  const [baseline, setBaseline] = useState<EditFields | null>(null)
  const [fields, setFields] = useState<EditFields | null>(null)
  const [editReason, setEditReason] = useState('')
  const [lottery, setLottery] = useState<LotteryConfig | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const dirtyRef = useRef(false)
  const confirmingRef = useRef(false)

  useEffect(() => {
    if (!source.data || baseline) return
    const loaded = editFieldsFrom(source.data)
    setBaseline(loaded)
    setFields(loaded)
  }, [source.data, baseline])

  const isPrivateMessage = source.data?.topic?.archetype === 'private_message'
  const canAddLottery = target.isFirstPost && !isPrivateMessage && Boolean(features?.lottery) && !source.data?.post.lottery
  const staff = Boolean(user?.staff || user?.admin || user?.moderator)
  const lotteryCap = useLotteryLimits(Boolean(lottery)).data?.min_participants_cap ?? null
  const lotteryProblem = lottery && canAddLottery ? validateLottery(lottery, { cap: lotteryCap, staff }) : null
  const dirty = Boolean(fields && baseline && !sameEditFields(fields, baseline)) || lottery !== null

  useEffect(() => {
    dirtyRef.current = dirty
    confirmingRef.current = confirming
  })

  const setRaw = useCallback(
    (next: SetStateAction<string>) =>
      setFields((current) => current && { ...current, raw: typeof next === 'function' ? next(current.raw) : next }),
    []
  )
  const setField = (patch: Partial<EditFields>): void => setFields((current) => current && { ...current, ...patch })

  const submitEdit = (): void => {
    if (save.isPending || !fields || !baseline) return
    setAttempted(true)
    if (target.isFirstPost && titleLength(fields.title) < minTitleLength) {
      setNotice(null)
      return
    }
    if (lotteryProblem) {
      setNotice(t('composer.extrasInvalid'))
      return
    }
    if (!fields.raw.trim()) {
      setNotice(t('composer.emptyBody'))
      return
    }
    if (fields.raw.trim().length > maxPostLength) {
      setNotice(t('composer.bodyTooLong', { count: maxPostLength }))
      return
    }
    if (uploading) {
      setNotice(t('composer.waitUploads'))
      return
    }
    if (!dirty) {
      setNotice(t('composer.edit.unchanged'))
      return
    }
    setNotice(null)
    save.mutate({
      target,
      baseline,
      next: fields,
      editReason,
      lottery: canAddLottery ? lottery : null,
      onBodySaved: (raw) => setBaseline((current) => current && { ...current, raw })
    })
  }

  /** After a conflict: take the server's current version, dropping local changes. */
  const reload = async (): Promise<void> => {
    const result = await source.refetch()
    if (!result.data) return
    const loaded = editFieldsFrom(result.data)
    setBaseline(loaded)
    setFields(loaded)
    save.reset()
    setNotice(null)
  }

  // Stable: the dialog re-runs its focus handling whenever `onClose` changes.
  const requestClose = useCallback(() => {
    if (hasComposerOverlay() || confirmingRef.current) return
    if (dirtyRef.current) setConfirming(true)
    else close()
  }, [close])

  const cancelClose = useCallback(() => setConfirming(false), [])

  const saveError = save.error
  const conflict =
    isApiErrorKind(saveError, 'conflict') || (saveError instanceof PartialEditError && isApiErrorKind(saveError.original, 'conflict'))
  const message = saveError
    ? saveError instanceof PartialEditError
      ? t('composer.edit.bodySaved', { message: errorMessage(saveError.original) })
      : errorMessage(saveError)
    : notice
  const titleTooShort = attempted && fields !== null && titleLength(fields.title) < minTitleLength

  const loadingView = source.isError ? (
    <div className={styles.state} role="alert">
      {t('composer.edit.loadFailed', { message: errorMessage(source.error) })}
      <Button size="sm" onClick={() => void source.refetch()}>
        {t('common.retry')}
      </Button>
    </div>
  ) : (
    <div className={styles.state}>
      <Spinner size={28} />
      {t('composer.edit.loading')}
    </div>
  )

  const saveButton = (
    <Button
      className={target.isFirstPost ? undefined : dockStyles.send}
      variant="primary"
      icon={<Check strokeWidth={2.5} />}
      disabled={save.isPending || !fields}
      onClick={submitEdit}
    >
      {save.isPending ? t('composer.edit.saving') : t('composer.edit.save')}
    </Button>
  )

  const reloadButton = conflict && (
    <Button size="sm" variant="ghost" onClick={() => void reload()}>
      {t('composer.edit.reload')}
    </Button>
  )

  const reasonInput = (
    <input
      className={cx(form.input, !target.isFirstPost && styles.reason)}
      value={editReason}
      maxLength={255}
      placeholder={t('composer.edit.reason')}
      aria-label={t('composer.edit.reason')}
      onChange={(event) => setEditReason(event.target.value)}
    />
  )

  const discardDialog = (
    <DiscardDialog
      open={confirming}
      onCancel={cancelClose}
      onDiscard={() => {
        setConfirming(false)
        close()
      }}
      title={t('composer.edit.discardTitle')}
      body={t('composer.edit.discardBody')}
      discardLabel={t('composer.edit.discard')}
    />
  )

  if (!target.isFirstPost) {
    return (
      <>
        <DockFrame
          heading={t('composer.edit.title', { number: target.postNumber })}
          subheading={target.topicTitle}
          sessionKey={target}
          onRequestClose={requestClose}
        >
          {(resized) =>
            fields ? (
              <>
                <MarkdownEditor
                  value={fields.raw}
                  onChange={setRaw}
                  onSubmit={submitEdit}
                  layout={resized ? 'fill' : 'auto'}
                  minHeight={96}
                  maxHeight={560}
                  autoFocus
                  previewSize="reply"
                  maxLength={maxPostLength}
                  topicId={target.topicId}
                  onUploadingChange={setUploading}
                />
                <div className={dockStyles.footer}>
                  {reasonInput}
                  {message ? (
                    <p className={dockStyles.error} role="alert">
                      {message}
                    </p>
                  ) : (
                    <span className={dockStyles.hint}>{shortcutHint}</span>
                  )}
                  {reloadButton}
                  {saveButton}
                </div>
              </>
            ) : (
              loadingView
            )
          }
        </DockFrame>
        {discardDialog}
      </>
    )
  }

  return (
    <>
      <Dialog
        open
        onClose={requestClose}
        width={760}
        title={t('composer.edit.titleFirst')}
        footer={
          <>
            <span className={topicStyles.footerNote}>
              {message ? (
                <span className={topicStyles.error} role="alert">
                  {message}
                </span>
              ) : (
                shortcutHint
              )}
              {reloadButton}
            </span>
            {saveButton}
          </>
        }
      >
        {fields ? (
          <div className={topicStyles.form}>
            {!isPrivateMessage && (
              <div className={topicStyles.field}>
                <label className={topicStyles.label} htmlFor="composer-edit-node">
                  {t('composer.topic.node')}
                </label>
                <NodePicker id="composer-edit-node" value={fields.categoryId} onChange={(id) => setField({ categoryId: id })} />
              </div>
            )}

            <div className={topicStyles.field}>
              <label className={topicStyles.label} htmlFor="composer-edit-title">
                {t('composer.topic.titleLabel')}
              </label>
              <input
                id="composer-edit-title"
                className={cx(topicStyles.titleInput, titleTooShort && topicStyles.invalid)}
                value={fields.title}
                maxLength={MAX_TITLE_LENGTH}
                autoComplete="off"
                aria-invalid={titleTooShort}
                onChange={(event) => setField({ title: event.target.value })}
              />
              {titleTooShort && (
                <p className={topicStyles.fieldError}>{t('composer.topic.titleTooShort', { count: minTitleLength })}</p>
              )}
            </div>

            {!isPrivateMessage && (
              <TagInput value={fields.tags} onChange={(tags) => setField({ tags })} categoryId={fields.categoryId} />
            )}

            <MarkdownEditor
              value={fields.raw}
              onChange={setRaw}
              onSubmit={submitEdit}
              minHeight={240}
              maxHeight={460}
              previewSize="body"
              maxLength={maxPostLength}
              topicId={target.topicId}
              onUploadingChange={setUploading}
            />

            {!isPrivateMessage && (
              <TopicExtras
                readPermission={fields.readPermission}
                onReadPermissionChange={(value) => setField({ readPermission: value })}
                lottery={canAddLottery ? lottery : null}
                onLotteryChange={canAddLottery ? setLottery : undefined}
                lotteryProblem={
                  attempted && lotteryProblem ? t(`composer.lottery.errors.${lotteryProblem.key}`, lotteryProblem.values ?? {}) : null
                }
                lotteryCap={staff ? null : lotteryCap}
              />
            )}

            {reasonInput}
          </div>
        ) : (
          loadingView
        )}
      </Dialog>
      {discardDialog}
    </>
  )
}
