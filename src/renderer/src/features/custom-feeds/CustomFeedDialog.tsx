import { Minus, Plus } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { NodeIcon } from '../../components/NodeIcon'
import { Switch } from '../../components/Switch'
import { Spinner } from '../../components/Spinner'
import { useDebouncedValue } from '../search/use-search'
import styles from './CustomFeeds.module.css'
import {
  FEED_DESCRIPTION_MAX,
  FEED_NAME_MAX,
  FEED_NODES_MAX,
  type CustomFeedDetail,
  type CustomFeedInput
} from './types'
import { useCustomFeedDetail, useFeedNodeSearch, useSaveCustomFeed, useToggleFeedNode } from './use-custom-feeds'

export type CustomFeedDialogMode = { mode: 'create' } | { mode: 'edit'; feed: CustomFeedDetail } | { mode: 'copy'; source: CustomFeedDetail }

interface CustomFeedDialogProps {
  state: CustomFeedDialogMode | null
  onClose: () => void
  onSaved?: (feed: CustomFeedDetail) => void
}

/** Create, edit or copy a custom feed (FEED-11). Editing also manages the feed's nodes. */
export function CustomFeedDialog({ state, onClose, onSaved }: CustomFeedDialogProps): React.JSX.Element | null {
  if (!state) return null
  // Keyed so switching feeds starts from fresh form state.
  const key = state.mode === 'edit' ? `edit-${state.feed.id}` : state.mode === 'copy' ? `copy-${state.source.id}` : 'create'
  return <FeedForm key={key} state={state} onClose={onClose} onSaved={onSaved} />
}

function initialInput(state: CustomFeedDialogMode, copyName: (name: string) => string): CustomFeedInput {
  if (state.mode === 'edit') {
    const { feed } = state
    return { name: feed.name, description: feed.description ?? '', private: feed.private, showOnProfile: feed.show_on_profile }
  }
  if (state.mode === 'copy') {
    const { source } = state
    return { name: copyName(source.name).slice(0, FEED_NAME_MAX), description: source.description ?? '', private: false, showOnProfile: true }
  }
  return { name: '', description: '', private: false, showOnProfile: true }
}

function FeedForm({ state, onClose, onSaved }: { state: CustomFeedDialogMode; onClose: () => void; onSaved?: (feed: CustomFeedDetail) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const save = useSaveCustomFeed()
  const [input, setInput] = useState<CustomFeedInput>(() => initialInput(state, (name) => t('customFeeds.copyName', { name })))
  const update = (patch: Partial<CustomFeedInput>): void => setInput((current) => ({ ...current, ...patch }))

  const title =
    state.mode === 'edit' ? t('customFeeds.editTitle') : state.mode === 'copy' ? t('customFeeds.copyTitle') : t('customFeeds.createTitle')
  const submitLabel = state.mode === 'edit' ? t('common.save') : state.mode === 'copy' ? t('customFeeds.submitCopy') : t('customFeeds.submitCreate')
  const valid = input.name.trim().length > 0

  const submit = (event?: FormEvent): void => {
    event?.preventDefault()
    if (!valid || save.isPending) return
    save.mutate(
      state.mode === 'edit'
        ? { mode: 'edit', feed: state.feed, input }
        : state.mode === 'copy'
          ? { mode: 'copy', source: state.source, input }
          : { mode: 'create', input },
      {
        onSuccess: (feed) => {
          onClose()
          onSaved?.(feed)
        }
      }
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      width={480}
      dismissible={!save.isPending}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={!valid || save.isPending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          {t('customFeeds.name')}
          <input
            className={styles.input}
            value={input.name}
            maxLength={FEED_NAME_MAX}
            required
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          {t('customFeeds.description')}
          <textarea
            className={styles.textarea}
            value={input.description}
            maxLength={FEED_DESCRIPTION_MAX}
            rows={3}
            onChange={(event) => update({ description: event.target.value })}
          />
          <span className={styles.counter}>
            {input.description.length}/{FEED_DESCRIPTION_MAX}
          </span>
        </label>
        <Switch
          checked={input.private}
          onChange={(value) => update(value ? { private: true, showOnProfile: false } : { private: false })}
          label={t('customFeeds.private')}
          description={t('customFeeds.privateHint')}
        />
        <Switch
          checked={!input.private && input.showOnProfile}
          disabled={input.private}
          onChange={(value) => update({ showOnProfile: value })}
          label={t('customFeeds.showOnProfile')}
          description={t('customFeeds.showOnProfileHint')}
        />
        {state.mode === 'edit' ? (
          <FeedNodesEditor feed={state.feed} />
        ) : (
          state.mode === 'create' && <p className={styles.hint}>{t('customFeeds.nodesHint')}</p>
        )}
      </form>
    </Dialog>
  )
}

/** The feed's nodes, with search to add more. Changes apply immediately. */
function FeedNodesEditor({ feed: initial }: { feed: CustomFeedDetail }): React.JSX.Element {
  const { t } = useTranslation()
  // The detail query holds the live node list; the dialog's copy may predate it.
  const detail = useCustomFeedDetail(initial.username, initial.slug)
  const feed = detail.data ?? initial
  const nodes = feed.nodes ?? []
  const toggle = useToggleFeedNode()
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term.trim(), 250)
  const search = useFeedNodeSearch(debounced)
  const [pendingId, setPendingId] = useState<number | null>(null)

  useEffect(() => {
    if (!toggle.isPending) setPendingId(null)
  }, [toggle.isPending])

  const inFeed = new Set(nodes.map((node) => node.id))
  const full = nodes.length >= FEED_NODES_MAX
  const run = (categoryId: number, add: boolean): void => {
    setPendingId(categoryId)
    toggle.mutate({ feed, categoryId, add })
  }

  return (
    <section className={styles.nodes}>
      <h3 className={styles.nodesTitle}>{t('customFeeds.nodes', { count: nodes.length, max: FEED_NODES_MAX })}</h3>
      {detail.isPending && !initial.nodes ? (
        <Spinner size={20} />
      ) : nodes.length === 0 ? (
        <p className={styles.hint}>{t('customFeeds.nodesEmpty')}</p>
      ) : (
        <div className={styles.nodeList}>
          {nodes.map((node) => (
            <div key={node.id} className={styles.nodeRow}>
              <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} size={22} />
              <span className={styles.nodeName}>{node.name}</span>
              <IconButton
                label={t('customFeeds.removeNode')}
                size="sm"
                disabled={toggle.isPending}
                onClick={() => run(node.id, false)}
              >
                {pendingId === node.id ? <Spinner size={14} /> : <Minus />}
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <input
        className={styles.input}
        type="search"
        value={term}
        placeholder={t('customFeeds.searchNodes')}
        onChange={(event) => setTerm(event.target.value)}
        // Enter in the search box shouldn't submit the whole form.
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
      />
      {full && <p className={styles.hint}>{t('customFeeds.nodesFull', { max: FEED_NODES_MAX })}</p>}
      {debounced && (
        <div className={styles.nodeList}>
          {search.isPending ? (
            <Spinner size={20} />
          ) : (search.data ?? []).length === 0 ? (
            <p className={styles.hint}>{t('customFeeds.noNodeResults')}</p>
          ) : (
            (search.data ?? []).map((node) => (
              <div key={node.id} className={styles.nodeRow}>
                <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} size={22} />
                <span className={styles.nodeName}>{node.name}</span>
                {inFeed.has(node.id) ? (
                  <IconButton label={t('customFeeds.removeNode')} size="sm" disabled={toggle.isPending} onClick={() => run(node.id, false)}>
                    {pendingId === node.id ? <Spinner size={14} /> : <Minus />}
                  </IconButton>
                ) : (
                  <IconButton label={t('customFeeds.addNode')} size="sm" disabled={toggle.isPending || full} onClick={() => run(node.id, true)}>
                    {pendingId === node.id ? <Spinner size={14} /> : <Plus />}
                  </IconButton>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}
