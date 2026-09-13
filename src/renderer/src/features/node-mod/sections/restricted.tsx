import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserX, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../../api/client'
import type { BasicUser } from '../../../api/types'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button, IconButton } from '../../../components/Button'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { formatDateTime } from '../../../lib/format'
import { InlineRetry } from '../../nodes/NodeLoadError'
import { ConfirmDialog, ModEmpty, ModIntro, ModPanel, ModUserRow, modStyles, UserPicker } from '../ModUi'
import type { ModSectionProps } from '../sections'
import { nodeModKey, useRefreshNodeMod } from '../use-mod-tools'

type RestrictionKind = 'ban' | 'mute'

/** discourse-community RestrictionSerializer. */
interface Restriction {
  id: number
  kind: RestrictionKind
  reason: string | null
  /** Null is permanent. */
  expires_at: string | null
  created_at: string
  user: BasicUser
  created_by: BasicUser
}

/** `Restriction::DURATIONS`, in days; blank is permanent. */
const DURATIONS = ['1', '3', '7', '28', '365', ''] as const
const REASON_MAX = 500

/**
 * Bans and mutes (components/mod-tools/restricted.gjs). RestrictionsController:
 * `GET|POST /node/:id/restrictions` (`username`, `kind`, `days`, `reason`) and
 * `DELETE /node/:id/restrictions/:id`, for anyone who may moderate the node.
 * The server refuses staff, the owner, oneself, and (unless the owner or
 * staff acts) other moderators, with a 422 message.
 */
export function RestrictedSection({ category }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const refresh = useRefreshNodeMod(category)
  const [usernames, setUsernames] = useState<string[]>([])
  const [kind, setKind] = useState<RestrictionKind>('ban')
  const [days, setDays] = useState<(typeof DURATIONS)[number]>('7')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [lifting, setLifting] = useState<Restriction | null>(null)

  const queryKey = [...nodeModKey(category.id), 'restrictions']
  const list = useQuery({
    queryKey,
    queryFn: () => apiRequest<{ restrictions: Restriction[] }>({ path: `/node/${category.id}/restrictions.json` })
  })
  const restrictions = list.data?.restrictions ?? []
  const bans = restrictions.filter((entry) => entry.kind === 'ban')
  const mutes = restrictions.filter((entry) => entry.kind === 'mute')

  const setRestrictions = (update: (current: Restriction[]) => Restriction[]): void => {
    queryClient.setQueryData<{ restrictions: Restriction[] }>(queryKey, (data) =>
      data ? { restrictions: update(data.restrictions) } : data
    )
  }

  const canSubmit = usernames.length === 1 && !busy

  const add = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const { restriction } = await apiRequest<{ restriction: Restriction }>({
        method: 'POST',
        path: `/node/${category.id}/restrictions.json`,
        form: [
          ['username', usernames[0]],
          ['kind', kind],
          ['days', days],
          ['reason', reason.trim()]
        ],
        priority: 'user'
      })
      setRestrictions((current) => [
        restriction,
        ...current.filter((entry) => !(entry.user.id === restriction.user.id && entry.kind === restriction.kind))
      ])
      setUsernames([])
      setReason('')
      showToast(t('nodeMod.restricted.added', { username: restriction.user.username }), 'success')
      // A ban also takes the member out of the node's groups.
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const lift = async (restriction: Restriction): Promise<void> => {
    try {
      await apiRequest<null>({
        method: 'DELETE',
        path: `/node/${category.id}/restrictions/${restriction.id}.json`,
        priority: 'user'
      })
      setRestrictions((current) => current.filter((entry) => entry.id !== restriction.id))
      showToast(t('nodeMod.restricted.lifted', { username: restriction.user.username }), 'success')
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    }
  }

  const durationLabel = (value: string): string =>
    value === ''
      ? t('nodeMod.restricted.permanent')
      : value === '365'
        ? t('nodeMod.restricted.oneYear')
        : t('nodeMod.restricted.days', { count: Number(value) })

  const renderList = (title: string, items: Restriction[], empty: string): React.JSX.Element => (
    <ModPanel title={title} count={items.length}>
      {items.length > 0 ? (
        <ul className={modStyles.list}>
          {items.map((entry) => (
            <ModUserRow
              key={entry.id}
              user={entry.user}
              meta={[
                entry.expires_at
                  ? t('nodeMod.restricted.until', { date: formatDateTime(entry.expires_at, i18n.language) })
                  : t('nodeMod.restricted.permanent'),
                entry.reason,
                t('nodeMod.restricted.by', { username: entry.created_by.username })
              ]
                .filter(Boolean)
                .join(' · ')}
              actions={
                <IconButton label={t('nodeMod.restricted.lift')} size="sm" onClick={() => setLifting(entry)}>
                  <X />
                </IconButton>
              }
            />
          ))}
        </ul>
      ) : (
        <ModEmpty>{empty}</ModEmpty>
      )}
    </ModPanel>
  )

  return (
    <>
      <ModIntro>{t('nodeMod.restricted.lede')}</ModIntro>

      <ModPanel>
        <form className={modStyles.formRow} onSubmit={(event) => void add(event)}>
          <UserPicker value={usernames} onChange={setUsernames} max={1} disabled={busy} />
          <select
            className={modStyles.select}
            value={kind}
            aria-label={t('nodeMod.restricted.kind')}
            onChange={(event) => setKind(event.target.value as RestrictionKind)}
          >
            <option value="ban">{t('nodeMod.restricted.ban')}</option>
            <option value="mute">{t('nodeMod.restricted.mute')}</option>
          </select>
          <select
            className={modStyles.select}
            value={days}
            aria-label={t('nodeMod.restricted.duration')}
            onChange={(event) => setDays(event.target.value as (typeof DURATIONS)[number])}
          >
            {DURATIONS.map((value) => (
              <option key={value || 'permanent'} value={value}>
                {durationLabel(value)}
              </option>
            ))}
          </select>
          <input
            className={`${modStyles.input} ${modStyles.grow}`}
            value={reason}
            maxLength={REASON_MAX}
            placeholder={t('nodeMod.restricted.reason')}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" variant="primary" icon={<UserX />} disabled={!canSubmit}>
            {t('nodeMod.restricted.add')}
          </Button>
        </form>
      </ModPanel>

      {list.isPending ? (
        <ModEmpty>
          <Spinner size={20} />
        </ModEmpty>
      ) : list.isError ? (
        <InlineRetry error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <>
          {renderList(t('nodeMod.restricted.banned'), bans, t('nodeMod.restricted.noneBanned'))}
          {renderList(t('nodeMod.restricted.muted'), mutes, t('nodeMod.restricted.noneMuted'))}
        </>
      )}

      <ConfirmDialog
        open={lifting !== null}
        danger={false}
        message={t('nodeMod.restricted.confirmLift', { username: lifting?.user.username ?? '' })}
        confirmLabel={t('nodeMod.restricted.lift')}
        onConfirm={() => (lifting ? lift(lifting) : Promise.resolve())}
        onClose={() => setLifting(null)}
      />
    </>
  )
}
