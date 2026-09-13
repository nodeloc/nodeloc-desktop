import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, Ban, Check, CircleCheck, CirclePlay, Copy, Pencil, Plus, Rss, RotateCw, Send, Trash2, Tv, Webhook } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../../api/client'
import { Button, IconButton } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { absoluteUrl } from '../../../lib/discourse'
import { useOpenLink } from '../../../lib/open-link'
import { CHANNEL_KINDS, extraKeys, modRequest, type ChannelKind, type ChannelsResponse, type NodeChannel } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, formatDay, formatShortTime, SectionHeader, useConfirm, useErrorToast } from './extra-ui'

const ICONS: Record<string, ReactNode> = {
  youtube: <CirclePlay />,
  telegram: <Send />,
  rss: <Rss />,
  bilibili: <Tv />,
  webhook: <Webhook />
}

const URL_KINDS = new Set(['youtube', 'rss', 'bilibili'])
const POLLED_KINDS = new Set(['rss', 'bilibili'])
/** ChannelsController::MAX_BACKFILL */
const BACKFILL_ON_CONNECT = 3

interface Draft {
  url: string
  bot_token: string
  name: string
  backfill: boolean
  post_as: string
  review: boolean
  daily_limit: string
  title_prefix: string
  tags: string
  enabled: boolean
}

const DEFAULT_DRAFT: Draft = {
  url: '',
  bot_token: '',
  name: '',
  backfill: false,
  post_as: 'owner',
  review: false,
  daily_limit: '20',
  title_prefix: '',
  tags: '',
  enabled: true
}

const STATE_BADGE: Record<string, string | undefined> = {
  live: styles.badgeSuccess,
  pending: styles.badgeWarning,
  polling: styles.badgeWarning,
  expired: styles.badgeDanger
}

function waitingForBind(channels: NodeChannel[] | undefined): boolean {
  return (channels ?? []).some((channel) => channel.kind === 'telegram' && channel.state === 'pending' && channel.enabled)
}

/** What the node echoes from elsewhere, how each one posts, and adding or dropping one. */
export function ChannelsSection({ category }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  const openLink = useOpenLink()
  const [confirm, confirmElement] = useConfirm()
  const endpoint = `/node/${category.id}/channels`
  const queryKey = extraKeys.channels(category.id)

  // A Telegram channel is bound by a message posted elsewhere, so while one
  // waits the list is asked again every few seconds.
  const query = useQuery({
    queryKey,
    queryFn: () => modRequest<ChannelsResponse>({ path: `${endpoint}.json`, priority: 'foreground' }),
    staleTime: 15_000,
    retry: (count, error) => !isApiErrorKind(error, 'notFound', 'forbidden') && count < 2,
    refetchInterval: (current) => (waitingForBind(current.state.data?.channels) ? 5000 : false)
  })

  const previous = useRef<NodeChannel[] | undefined>(undefined)
  useEffect(() => {
    const channels = query.data?.channels
    const before = previous.current
    previous.current = channels
    if (!channels || !before) return
    const nowBound = channels.find(
      (channel) =>
        channel.kind === 'telegram' && channel.state === 'live' && before.find((other) => other.id === channel.id)?.state === 'pending'
    )
    if (nowBound) showToast(t('nodeModExtra.channels.telegramBound', { chat: nowBound.chat_title ?? nowBound.name }), 'success')
  }, [query.data, t])

  const [adding, setAdding] = useState<'choose' | ChannelKind | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  if (query.isError && isApiErrorKind(query.error, 'notFound')) {
    return (
      <div className={styles.section}>
        <SectionHeader title={t('nodeModExtra.channels.title')} lede={t('nodeModExtra.channels.lede')} />
        <EmptyState title={t('nodeModExtra.channels.unavailable')} />
      </div>
    )
  }

  const data = query.data
  const channels = data?.channels ?? []
  const max = data?.max ?? 10
  const kinds = CHANNEL_KINDS.filter((kind) => kind !== 'bilibili' || data?.bilibili_available)

  const replace = (updated: NodeChannel): void => {
    queryClient.setQueryData<ChannelsResponse>(queryKey, (current) =>
      current ? { ...current, channels: current.channels.map((channel) => (channel.id === updated.id ? updated : channel)) } : current
    )
  }

  const optionsPayload = (): Record<string, unknown> => ({
    post_as: draft.post_as,
    review: draft.review,
    daily_limit: parseInt(draft.daily_limit, 10) || 20,
    title_prefix: draft.title_prefix,
    tags: draft.tags
      .split('|')
      .map((tag) => tag.trim())
      .filter(Boolean),
    enabled: draft.enabled
  })

  const create = async (kind: ChannelKind): Promise<void> => {
    const body: Record<string, unknown> = { kind, ...optionsPayload() }
    if (URL_KINDS.has(kind)) {
      body.url = draft.url.trim()
      if (draft.backfill) body.backfill = BACKFILL_ON_CONNECT
    } else if (kind === 'telegram') {
      body.bot_token = draft.bot_token.trim()
      body.name = draft.name.trim()
    } else {
      body.name = draft.name.trim()
    }
    setBusy(true)
    try {
      const result = await modRequest<{ channel: NodeChannel }>({ method: 'POST', path: `${endpoint}.json`, json: body })
      queryClient.setQueryData<ChannelsResponse>(queryKey, (current) =>
        current ? { ...current, channels: [...current.channels, result.channel] } : current
      )
      setAdding(null)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const save = async (channel: NodeChannel): Promise<void> => {
    const body: Record<string, unknown> = { ...optionsPayload() }
    if (channel.kind !== 'telegram') body.name = draft.name.trim()
    setBusy(true)
    try {
      const result = await modRequest<{ channel: NodeChannel }>({ method: 'PUT', path: `${endpoint}/${channel.id}.json`, json: body })
      replace(result.channel)
      setEditing(null)
      showToast(t('nodeModExtra.channels.saved'), 'success')
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (channel: NodeChannel): Promise<void> => {
    try {
      const result = await modRequest<{ channel: NodeChannel }>({ method: 'PUT', path: `${endpoint}/${channel.id}.json`, json: { enabled: !channel.enabled } })
      replace(result.channel)
    } catch (error) {
      toastError(error)
    }
  }

  const refresh = async (channel: NodeChannel): Promise<void> => {
    setRefreshing(channel.id)
    try {
      const result = await modRequest<{ channel: NodeChannel }>({ method: 'POST', path: `${endpoint}/${channel.id}/refresh.json` })
      replace(result.channel)
    } catch (error) {
      toastError(error)
    } finally {
      setRefreshing(null)
    }
  }

  const backfill = async (channel: NodeChannel): Promise<void> => {
    setRefreshing(channel.id)
    try {
      const result = await modRequest<{ channel: NodeChannel; backfilled: number }>({ method: 'POST', path: `${endpoint}/${channel.id}/backfill.json` })
      replace(result.channel)
      showToast(result.backfilled > 0 ? t('nodeModExtra.channels.backfilled') : t('nodeModExtra.channels.backfillNothing'), 'success')
    } catch (error) {
      toastError(error)
    } finally {
      setRefreshing(null)
    }
  }

  const remove = async (channel: NodeChannel): Promise<void> => {
    const ok = await confirm({ message: t('nodeModExtra.channels.confirmRemove', { name: channel.name }), confirmLabel: t('nodeModExtra.channels.remove') })
    if (!ok) return
    try {
      await modRequest({ method: 'DELETE', path: `${endpoint}/${channel.id}.json` })
      queryClient.setQueryData<ChannelsResponse>(queryKey, (current) =>
        current ? { ...current, channels: current.channels.filter((other) => other.id !== channel.id) } : current
      )
      if (editing === channel.id) setEditing(null)
    } catch (error) {
      toastError(error)
    }
  }

  const copy = async (text: string, key: string): Promise<void> => {
    try {
      await window.nodeloc.shell.copyText(text)
      setCopied(key)
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500)
    } catch {
      // The text is on screen anyway.
    }
  }

  const startEdit = (channel: NodeChannel): void => {
    setAdding(null)
    setEditing(channel.id)
    setDraft({
      ...DEFAULT_DRAFT,
      name: channel.name,
      post_as: channel.post_as,
      review: channel.review,
      daily_limit: String(channel.daily_limit),
      title_prefix: channel.title_prefix ?? '',
      tags: (channel.tags ?? []).join('|'),
      enabled: channel.enabled
    })
  }

  const options = (showEnabled: boolean): React.JSX.Element => (
    <>
      <div className={styles.grid2}>
        <Field label={t('nodeModExtra.channels.postAs')}>
          <select className={styles.select} value={draft.post_as} onChange={(event) => setDraft({ ...draft, post_as: event.target.value })}>
            <option value="owner">{t('nodeModExtra.channels.postAsOwner')}</option>
            {(data?.bot_available || draft.post_as === 'bot') && <option value="bot">{t('nodeModExtra.channels.postAsBot')}</option>}
          </select>
        </Field>
        <Field label={t('nodeModExtra.channels.dailyLimit')}>
          <input
            type="number"
            min={1}
            max={200}
            className={`${styles.input} ${styles.number}`}
            value={draft.daily_limit}
            onChange={(event) => setDraft({ ...draft, daily_limit: event.target.value })}
          />
        </Field>
        <Field label={t('nodeModExtra.channels.titlePrefix')}>
          <input
            className={styles.input}
            maxLength={60}
            placeholder={t('nodeModExtra.channels.titlePrefixPlaceholder')}
            value={draft.title_prefix}
            onChange={(event) => setDraft({ ...draft, title_prefix: event.target.value })}
          />
        </Field>
        <Field label={t('nodeModExtra.channels.tags')}>
          <input className={styles.input} value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
        </Field>
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={draft.review} onChange={(event) => setDraft({ ...draft, review: event.target.checked })} />
        {t('nodeModExtra.channels.review')}
      </label>
      {showEnabled && (
        <label className={styles.checkbox}>
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
          {t('nodeModExtra.channels.enabled')}
        </label>
      )}
    </>
  )

  const codeBlock = (text: string, key: string): React.JSX.Element => (
    <div className={styles.code}>
      <code>{text}</code>
      <Button size="sm" variant="ghost" icon={copied === key ? <Check /> : <Copy />} onClick={() => void copy(text, key)}>
        {copied === key ? t('nodeModExtra.common.copied') : t('nodeModExtra.common.copy')}
      </Button>
    </div>
  )

  return (
    <div className={styles.section}>
      <SectionHeader
        title={t('nodeModExtra.channels.title')}
        lede={t('nodeModExtra.channels.lede')}
        actions={
          <>
            {data && <span className={styles.count}>{t('nodeModExtra.channels.limit', { current: channels.length, max })}</span>}
            <Button
              variant="primary"
              icon={<Plus />}
              disabled={!data || channels.length >= max || adding === 'choose'}
              onClick={() => {
                setEditing(null)
                setAdding('choose')
              }}
            >
              {t('nodeModExtra.channels.add')}
            </Button>
          </>
        }
      />

      {adding === 'choose' && (
        <section className={styles.panel}>
          <div className={styles.kindGrid}>
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className={styles.kindCard}
                onClick={() => {
                  setDraft(DEFAULT_DRAFT)
                  setAdding(kind)
                }}
              >
                {ICONS[kind]}
                <strong>{t(`nodeModExtra.channels.kinds.${kind}`)}</strong>
                <span>{t(`nodeModExtra.channels.kindHints.${kind}`)}</span>
              </button>
            ))}
          </div>
          <div className={styles.row}>
            <Button variant="ghost" onClick={() => setAdding(null)}>
              {t('nodeModExtra.common.cancel')}
            </Button>
          </div>
        </section>
      )}

      {adding && adding !== 'choose' && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>
            {ICONS[adding]}
            {t(`nodeModExtra.channels.kinds.${adding}`)}
          </h2>
          {URL_KINDS.has(adding) ? (
            <>
              <Field label={t(`nodeModExtra.channels.url.${adding}`)} htmlFor="mod-channel-url">
                <input
                  id="mod-channel-url"
                  className={styles.input}
                  placeholder={t(`nodeModExtra.channels.urlPlaceholder.${adding}`)}
                  value={draft.url}
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })}
                />
              </Field>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={draft.backfill} onChange={(event) => setDraft({ ...draft, backfill: event.target.checked })} />
                {t('nodeModExtra.channels.backfillOnAdd')}
              </label>
            </>
          ) : adding === 'telegram' ? (
            <>
              <p className={styles.hint}>{t('nodeModExtra.channels.telegramSteps')}</p>
              <Field label={t('nodeModExtra.channels.telegramToken')} htmlFor="mod-channel-token">
                <input
                  id="mod-channel-token"
                  className={`${styles.input} ${styles.mono}`}
                  autoComplete="off"
                  placeholder={t('nodeModExtra.channels.telegramTokenPlaceholder')}
                  value={draft.bot_token}
                  onChange={(event) => setDraft({ ...draft, bot_token: event.target.value })}
                />
              </Field>
            </>
          ) : (
            <Field label={t('nodeModExtra.channels.webhookName')} htmlFor="mod-channel-name">
              <input
                id="mod-channel-name"
                className={styles.input}
                placeholder={t('nodeModExtra.channels.webhookNamePlaceholder')}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
          )}
          {options(false)}
          <div className={styles.row}>
            <Button variant="primary" icon={busy ? <Spinner size={14} /> : <Plus />} disabled={busy} onClick={() => void create(adding)}>
              {t('nodeModExtra.channels.add')}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(null)}>
              {t('nodeModExtra.common.cancel')}
            </Button>
          </div>
        </section>
      )}

      {query.isPending ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : query.isError ? (
        <EmptyState
          title={t('nodeModExtra.common.loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
        />
      ) : channels.length === 0 ? (
        <EmptyState title={t('nodeModExtra.channels.empty')} />
      ) : (
        <ul className={styles.list}>
          {channels.map((channel) => {
            const isRefreshing = refreshing === channel.id
            const polled = POLLED_KINDS.has(channel.kind) && channel.enabled
            const needsResubscribe = channel.kind === 'youtube' && channel.enabled && ['pending', 'polling', 'expired'].includes(channel.state)
            const canBackfill = URL_KINDS.has(channel.kind) && channel.enabled
            const meta = [
              channel.last_synced_at
                ? t('nodeModExtra.channels.lastSynced', { time: formatShortTime(channel.last_synced_at, i18n.language) })
                : t('nodeModExtra.channels.neverSynced'),
              channel.items_count ? t('nodeModExtra.channels.itemsCount', { count: channel.items_count }) : null,
              channel.lease_expires_at ? t('nodeModExtra.channels.leaseUntil', { date: formatDay(channel.lease_expires_at, i18n.language) }) : null,
              channel.review ? t('nodeModExtra.channels.review') : null
            ].filter(Boolean)

            return (
              <li key={channel.id} className={styles.item}>
                <span className={styles.itemIcon}>{ICONS[channel.kind] ?? <Webhook />}</span>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>
                    {channel.source_url ? (
                      <button type="button" className={styles.linkButton} onClick={() => openLink(channel.source_url!)}>
                        {channel.name}
                      </button>
                    ) : (
                      channel.name
                    )}
                    <span className={cx(styles.badge, STATE_BADGE[channel.state])}>
                      {t(`nodeModExtra.channels.states.${channel.state}`, { defaultValue: channel.state })}
                    </span>
                  </div>
                  <span className={styles.itemMeta}>{meta.join(' · ')}</span>
                  {channel.last_error && <span className={styles.errorText}>{t('nodeModExtra.channels.error', { message: channel.last_error })}</span>}

                  {polled && (
                    <div className={styles.row}>
                      <Button size="sm" icon={isRefreshing ? <Spinner size={14} /> : <RotateCw />} disabled={refreshing !== null} onClick={() => void refresh(channel)}>
                        {t('nodeModExtra.channels.pollNow')}
                      </Button>
                    </div>
                  )}
                  {needsResubscribe && (
                    <div className={styles.row}>
                      <Button size="sm" icon={isRefreshing ? <Spinner size={14} /> : <RotateCw />} disabled={refreshing !== null} onClick={() => void refresh(channel)}>
                        {t('nodeModExtra.channels.youtubeRenew')}
                      </Button>
                      <span className={styles.hint}>{t('nodeModExtra.channels.youtubeRenewHint')}</span>
                    </div>
                  )}

                  {channel.kind === 'telegram' && channel.bind_code ? (
                    <div className={styles.subBlock}>
                      <strong className={styles.subTitle}>{t('nodeModExtra.channels.telegramBindTitle')}</strong>
                      {codeBlock(`/bind ${channel.bind_code}`, `bind-${channel.id}`)}
                      <span className={styles.hint}>{t('nodeModExtra.channels.telegramBindHint', { bot: channel.bot_username ?? '' })}</span>
                      <div className={styles.row}>
                        <Button size="sm" variant="ghost" icon={<RotateCw />} disabled={refreshing !== null} onClick={() => void refresh(channel)}>
                          {t('nodeModExtra.channels.telegramNewCode')}
                        </Button>
                      </div>
                    </div>
                  ) : channel.kind === 'telegram' && channel.chat_title ? (
                    <span className={styles.itemMeta}>{t('nodeModExtra.channels.telegramBound', { chat: channel.chat_title })}</span>
                  ) : null}

                  {channel.webhook_url && (
                    <div className={styles.subBlock}>
                      <strong className={styles.subTitle}>{t('nodeModExtra.channels.webhookUrlTitle')}</strong>
                      {codeBlock(channel.webhook_url, `webhook-${channel.id}`)}
                      <span className={styles.hint}>{t('nodeModExtra.channels.webhookUrlHint')}</span>
                    </div>
                  )}

                  {canBackfill && (
                    <div className={styles.row}>
                      <Button size="sm" variant="ghost" icon={isRefreshing ? <Spinner size={14} /> : <ArrowDownToLine />} disabled={refreshing !== null} onClick={() => void backfill(channel)}>
                        {t('nodeModExtra.channels.backfill')}
                      </Button>
                      <span className={styles.hint}>{t('nodeModExtra.channels.backfillHint')}</span>
                    </div>
                  )}

                  {editing === channel.id && (
                    <div className={styles.subBlock} style={{ gap: 'var(--space-4)' }}>
                      <strong className={styles.subTitle}>{t('nodeModExtra.channels.options')}</strong>
                      {channel.kind !== 'telegram' && (
                        <Field label={t('nodeModExtra.channels.name')}>
                          <input className={styles.input} maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                        </Field>
                      )}
                      {options(true)}
                      <div className={styles.row}>
                        <Button variant="primary" disabled={busy} onClick={() => void save(channel)}>
                          {t('nodeModExtra.channels.save')}
                        </Button>
                        <Button variant="ghost" onClick={() => setEditing(null)}>
                          {t('nodeModExtra.common.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {channel.recent.length > 0 && (
                    <details className={styles.recent}>
                      <summary>{t('nodeModExtra.channels.recent')}</summary>
                      <ul className={styles.recentList}>
                        {channel.recent.map((item) => (
                          <li key={item.id} className={styles.recentItem}>
                            <span className={styles.time}>{formatShortTime(item.created_at, i18n.language)}</span>
                            {item.topic_url ? (
                              <button type="button" className={styles.linkButton} onClick={() => openLink(absoluteUrl(item.topic_url!))}>
                                {item.title}
                              </button>
                            ) : (
                              <span>{item.title}</span>
                            )}
                            <span className={cx(styles.badge, item.status === 'published' && styles.badgeSuccess, item.status === 'failed' && styles.badgeDanger)}>
                              {t(`nodeModExtra.channels.itemStatus.${item.status}`, { defaultValue: item.status })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className={styles.itemActions}>
                  <IconButton
                    size="sm"
                    label={channel.enabled ? t('nodeModExtra.channels.disable') : t('nodeModExtra.channels.enable')}
                    onClick={() => void toggle(channel)}
                  >
                    {channel.enabled ? <CircleCheck /> : <Ban />}
                  </IconButton>
                  <IconButton size="sm" label={t('nodeModExtra.channels.refreshStatus')} disabled={query.isFetching} onClick={() => void query.refetch()}>
                    <RotateCw />
                  </IconButton>
                  <IconButton size="sm" label={t('nodeModExtra.channels.options')} onClick={() => startEdit(channel)}>
                    <Pencil />
                  </IconButton>
                  <IconButton size="sm" label={t('nodeModExtra.channels.remove')} className={styles.dangerIcon} onClick={() => void remove(channel)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {confirmElement}
    </div>
  )
}
