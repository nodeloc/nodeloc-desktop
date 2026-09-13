import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { SITE_ORIGIN } from '@shared/site'
import { ChevronDown, CircleCheck, ExternalLink, Info } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiRequest } from '../../../api/client'
import type { BasicUser } from '../../../api/types'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { DropdownMenu } from '../../../components/DropdownMenu'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { formatRelativeTime } from '../../../lib/format'
import { useOpenLink } from '../../../lib/open-link'
import { parseSiteHref, siteUrlToRoute } from '../../../lib/routes'
import { PostContent } from '../../content/PostContent'
import { InlineRetry } from '../../nodes/NodeLoadError'
import { ConfirmDialog, ModEmpty, ModIntro, ModPanel, modStyles } from '../ModUi'
import type { ModSectionProps } from '../sections'
import { nodeModKey, useRefreshNodeMod } from '../use-mod-tools'
import styles from './queue.module.css'

// ---------------------------------------------------------------------------
// `GET /review.json` (ReviewablesController#index). ApplicationSerializer
// embeds associations as ids and side-loads the records at the top level, so
// each reviewable points into `users`, `topics`, `bundled_actions`, `actions`
// and `reviewable_scores`. Inline objects are accepted too.

interface ReviewableAction {
  id: string
  label: string
  icon?: string
  button_class?: string | null
  confirm_message?: string
  description?: string
  server_action: string
  /** Handled in the web client (e.g. `edit`); not available here. */
  client_action?: string
  require_reject_reason?: boolean
  completed_message?: string | null
}

interface ReviewableBundle {
  id: string
  label?: string
  icon?: string
  action_ids?: string[]
  actions?: ReviewableAction[]
}

interface ReviewableScoreType {
  id?: number
  title?: string
}

interface ReviewableScore {
  id: number
  score: number
  /** May carry HTML (a link to the setting that held the post). */
  reason?: string | null
  created_at?: string
  user_id?: number
  user?: BasicUser
  score_type_id?: number
  score_type?: ReviewableScoreType
}

interface RawReviewable {
  id: number
  type: string
  topic_id?: number
  topic_url?: string
  target_url?: string
  created_at: string
  score?: number
  version: number
  created_by_id?: number
  target_created_by_id?: number
  bundled_action_ids?: string[]
  bundled_actions?: ReviewableBundle[]
  reviewable_score_ids?: number[]
  reviewable_scores?: ReviewableScore[]
  /** Flagged post body, or a queued post cooked from its payload. */
  cooked?: string | null
  blank_post?: boolean
  fancy_title?: string | null
  payload?: { title?: string | null; raw?: string | null }
}

interface ReviewableListResponse {
  reviewables: RawReviewable[]
  users?: BasicUser[]
  topics?: Array<{ id: number; title?: string; fancy_title?: string }>
  bundled_actions?: ReviewableBundle[]
  actions?: ReviewableAction[]
  reviewable_scores?: ReviewableScore[]
  score_types?: ReviewableScoreType[]
  meta?: { total_rows_reviewables?: number; load_more_reviewables?: string }
}

/** `PUT /review/:id/perform/:action` answers with this (ReviewablePerformResultSerializer). */
interface PerformResponse {
  reviewable_perform_result?: {
    success: boolean
    remove_reviewable_ids?: number[]
    version?: number
  }
}

interface QueueItem {
  id: number
  type: string
  version: number
  createdAt: string
  title: string | null
  author: BasicUser | null
  cooked: string | null
  deleted: boolean
  href: string | null
  scores: Array<{ id: number; username: string | null; type: string | null; reason: string | null }>
  bundles: Array<{ id: string; label: string | null; actions: ReviewableAction[] }>
  /** Some actions only work in the web client. */
  webOnly: boolean
}

interface QueuePage {
  items: QueueItem[]
  hasMore: boolean
}

/** Actions with a client-side flow or a form of their own that this client doesn't have. */
const WEB_ONLY_ACTIONS = new Set(['revise_and_reject_post'])

const plainText = (html: string | null | undefined): string | null => {
  if (!html) return null
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim()
  return text || null
}

function normalize(response: ReviewableListResponse): QueuePage {
  const users = new Map((response.users ?? []).map((user) => [user.id, user]))
  const topics = new Map((response.topics ?? []).map((topic) => [topic.id, topic]))
  const actions = new Map((response.actions ?? []).map((action) => [action.id, action]))
  const scores = new Map((response.reviewable_scores ?? []).map((score) => [score.id, score]))
  const scoreTypes = new Map((response.score_types ?? []).map((type) => [type.id, type]))
  const bundles = new Map<string, ReviewableBundle>()
  for (const bundle of response.bundled_actions ?? []) if (!bundles.has(bundle.id)) bundles.set(bundle.id, bundle)

  const items = response.reviewables.map((raw): QueueItem => {
    const rawBundles = raw.bundled_actions ?? (raw.bundled_action_ids ?? []).flatMap((id) => bundles.get(id) ?? [])
    let webOnly = false
    const resolvedBundles = rawBundles.flatMap((bundle) => {
      const bundleActions = (bundle.actions ?? (bundle.action_ids ?? []).flatMap((id) => actions.get(id) ?? [])).filter((action) => {
        const supported = !action.client_action && !WEB_ONLY_ACTIONS.has(action.server_action)
        if (!supported) webOnly = true
        return supported
      })
      return bundleActions.length > 0 ? [{ id: bundle.id, label: bundle.label ?? null, actions: bundleActions }] : []
    })

    const rawScores = raw.reviewable_scores ?? (raw.reviewable_score_ids ?? []).flatMap((id) => scores.get(id) ?? [])
    const topic = raw.topic_id ? topics.get(raw.topic_id) : undefined
    const authorId = raw.target_created_by_id ?? raw.created_by_id
    const link = parseSiteHref(raw.target_url ?? raw.topic_url ?? '')

    return {
      id: raw.id,
      type: raw.type,
      version: raw.version,
      createdAt: raw.created_at,
      title: plainText(topic?.fancy_title ?? topic?.title ?? raw.payload?.title ?? raw.fancy_title),
      author: authorId !== undefined ? (users.get(authorId) ?? null) : null,
      cooked: raw.cooked ?? null,
      deleted: Boolean(raw.blank_post),
      href: link ? siteUrlToRoute(link) : null,
      scores: rawScores.map((score) => {
        const type = score.score_type ?? (score.score_type_id !== undefined ? scoreTypes.get(score.score_type_id) : undefined)
        const user = score.user ?? (score.user_id !== undefined ? users.get(score.user_id) : undefined)
        return { id: score.id, username: user?.username ?? null, type: type?.title ?? null, reason: plainText(score.reason) }
      }),
      bundles: resolvedBundles,
      webOnly
    }
  })

  return { items, hasMore: Boolean(response.meta?.load_more_reviewables) }
}

type PendingAction = { item: QueueItem; action: ReviewableAction; step: 'confirm' | 'reject' }

/**
 * Flags and held posts routed to the node's moderators (components/mod-tools/queue.gjs,
 * which uses core's reviewable cards). Core answers 403 until something is
 * waiting, so an empty queue isn't asked, as on the web. Actions go through
 * `PUT /review/:id/perform/:action?version=`.
 */
export function QueueSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const refresh = useRefreshNodeMod(category)
  const openLink = useOpenLink()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [performing, setPerforming] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [sendEmail, setSendEmail] = useState(false)
  // Stable, so typing the reason doesn't make the dialog re-run its focus handling.
  const closePending = useCallback(() => setPending(null), [])

  const enabled = mod.can_review && mod.stats.pending_reviewables > 0
  const queryKey = [...nodeModKey(category.id), 'queue']

  const queue = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) =>
      normalize(
        await apiRequest<ReviewableListResponse>({
          path: '/review.json',
          query: { category_id: category.id, status: 'pending', offset: pageParam || undefined }
        })
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.reduce((sum, page) => sum + page.items.length, 0) : undefined),
    enabled
  })

  const perform = async (item: QueueItem, action: ReviewableAction, extra: Array<[string, string]> = []): Promise<void> => {
    setPerforming(item.id)
    try {
      const response = await apiRequest<PerformResponse>({
        method: 'PUT',
        path: `/review/${item.id}/perform/${encodeURIComponent(action.server_action)}`,
        query: { version: item.version },
        form: extra.length > 0 ? extra : undefined,
        priority: 'user'
      })
      const result = response?.reviewable_perform_result
      if (result && result.success === false) throw new Error('perform failed')
      const removed = new Set(result?.remove_reviewable_ids?.length ? result.remove_reviewable_ids : [item.id])
      queryClient.setQueryData<InfiniteData<QueuePage, number>>(queryKey, (data) =>
        data
          ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((entry) => !removed.has(entry.id)) })) }
          : data
      )
      showToast(action.completed_message || t('nodeMod.queue.done'), 'success')
      // Pending counts on the overview, and the node's topics may have changed.
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
      // A version conflict means someone else acted first; show the queue as it is now.
      void queue.refetch()
    } finally {
      setPerforming(null)
    }
  }

  const start = (item: QueueItem, action: ReviewableAction): void => {
    if (action.require_reject_reason) {
      setRejectReason('')
      setSendEmail(false)
      setPending({ item, action, step: 'reject' })
    } else if (action.confirm_message) {
      setPending({ item, action, step: 'confirm' })
    } else {
      void perform(item, action)
    }
  }

  const items = queue.data?.pages.flatMap((page) => page.items) ?? []

  let body: React.JSX.Element
  if (!mod.can_review) {
    body = <ModEmpty icon={<Info />}>{t('nodeMod.queue.disabled')}</ModEmpty>
  } else if (enabled && queue.isPending) {
    body = (
      <ModEmpty>
        <Spinner size={20} />
      </ModEmpty>
    )
  } else if (enabled && queue.isError) {
    body = <InlineRetry error={queue.error} onRetry={() => void queue.refetch()} />
  } else if (items.length === 0) {
    body = (
      <div className={styles.clear}>
        <CircleCheck />
        <strong>{t('nodeMod.queue.empty')}</strong>
        <span>{t('nodeMod.queue.emptyHint')}</span>
      </div>
    )
  } else {
    body = (
      <div className={styles.items}>
        {items.map((item) => (
          <article key={item.id} className={styles.item} aria-busy={performing === item.id}>
            <header className={styles.itemHeader}>
              <span className={modStyles.badge}>
                {t(`nodeMod.queue.types.${item.type}`, { defaultValue: t('nodeMod.queue.types.other') })}
              </span>
              <span className={modStyles.hint}>{formatRelativeTime(item.createdAt, i18n.language)}</span>
            </header>

            {item.title &&
              (item.href ? (
                <Link className={styles.title} to={item.href}>
                  {item.title}
                </Link>
              ) : (
                <span className={styles.title}>{item.title}</span>
              ))}
            {item.author && <span className={modStyles.rowMeta}>{t('nodeMod.queue.postedBy', { username: item.author.username })}</span>}

            {item.deleted ? (
              <p className={modStyles.hint}>{t('nodeMod.queue.deletedPost')}</p>
            ) : (
              item.cooked && <PostContent html={item.cooked} size="reply" className={styles.content} />
            )}

            {item.scores.length > 0 && (
              <ul className={styles.scores}>
                {item.scores.map((score) => (
                  <li key={score.id}>
                    <span className={styles.scoreWho}>
                      {t('nodeMod.queue.flaggedBy', { username: score.username ?? '—', type: score.type ?? '' })}
                    </span>
                    {score.reason && <span className={modStyles.rowMeta}>{score.reason}</span>}
                  </li>
                ))}
              </ul>
            )}

            <footer className={styles.actions}>
              {item.bundles.map((bundle) =>
                bundle.actions.length === 1 ? (
                  <ActionButton
                    key={bundle.id}
                    action={bundle.actions[0]}
                    disabled={performing !== null}
                    onClick={() => start(item, bundle.actions[0])}
                  />
                ) : (
                  <DropdownMenu
                    key={bundle.id}
                    align="start"
                    trigger={({ toggle }) => (
                      <Button size="sm" disabled={performing !== null} onClick={toggle}>
                        {bundle.label ?? t('nodeMod.queue.more')}
                        <ChevronDown />
                      </Button>
                    )}
                    items={bundle.actions.map((action) => ({
                      key: action.id,
                      label: action.label,
                      title: action.description,
                      danger: action.button_class?.includes('danger'),
                      onSelect: () => start(item, action)
                    }))}
                  />
                )
              )}
              {item.webOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<ExternalLink />}
                  title={t('nodeMod.queue.webOnly')}
                  onClick={() => openLink(`${SITE_ORIGIN}/review/${item.id}`)}
                >
                  {t('nodeMod.queue.openOnWeb')}
                </Button>
              )}
              {performing === item.id && <Spinner size={16} />}
            </footer>
          </article>
        ))}
        {queue.hasNextPage && (
          <Button className={modStyles.loadMore} disabled={queue.isFetchingNextPage} onClick={() => void queue.fetchNextPage()}>
            {t('nodeMod.queue.loadMore')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <ModIntro>{t('nodeMod.queue.lede')}</ModIntro>
      <ModPanel>{body}</ModPanel>

      <ConfirmDialog
        open={pending?.step === 'confirm'}
        danger={Boolean(pending?.action.button_class?.includes('danger'))}
        message={pending?.action.confirm_message ?? ''}
        confirmLabel={pending?.action.label}
        onConfirm={() => (pending ? perform(pending.item, pending.action) : Promise.resolve())}
        onClose={() => setPending(null)}
      />

      <Dialog
        open={pending?.step === 'reject'}
        onClose={closePending}
        title={pending?.action.label ?? t('nodeMod.queue.rejectTitle')}
        width={440}
        footer={
          <>
            <Button onClick={() => setPending(null)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!pending) return
                const { item, action } = pending
                setPending(null)
                void perform(item, action, [
                  ['reject_reason', rejectReason.trim()],
                  ['send_email', String(sendEmail)]
                ])
              }}
            >
              {pending?.action.label ?? t('common.confirm')}
            </Button>
          </>
        }
      >
        <div className={styles.rejectForm}>
          <label className={modStyles.field}>
            {t('nodeMod.queue.rejectReason')}
            <textarea
              className={modStyles.textarea}
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
            {t('nodeMod.queue.sendEmail')}
          </label>
        </div>
      </Dialog>
    </>
  )
}

function ActionButton({
  action,
  disabled,
  onClick
}: {
  action: ReviewableAction
  disabled: boolean
  onClick: () => void
}): React.JSX.Element {
  const danger = action.button_class?.includes('danger')
  const primary = action.button_class?.includes('primary') || action.button_class?.includes('success')
  return (
    <Button
      size="sm"
      variant={primary ? 'primary' : 'secondary'}
      className={danger ? modStyles.dangerButton : undefined}
      title={action.description}
      disabled={disabled}
      onClick={onClick}
    >
      {action.label}
    </Button>
  )
}
