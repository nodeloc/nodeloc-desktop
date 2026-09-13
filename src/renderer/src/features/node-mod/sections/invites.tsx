import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../components/Avatar'
import { Button, IconButton } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { parseDate } from '../../../lib/format'
import { extraKeys, modRequest, type InvitesResponse, type NodeInvite } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, formatShortTime, SectionHeader, useConfirm, useErrorToast } from './extra-ui'
import { useInvalidateNodeMod } from './use-invalidate'

const EXPIRY_DAYS = [1, 7, 30, 90]
const USES = [1, 5, 10, 25, 100]
const FOREVER = 'forever'
const UNLIMITED = 'unlimited'
/** A link minted "forever" expires 100 years out; anything past 50 reads as never. */
const FOREVER_HORIZON_YEARS = 50

function expiresForever(expiresAt: string): boolean {
  const date = parseDate(expiresAt)
  if (!date) return false
  const horizon = new Date()
  horizon.setFullYear(horizon.getFullYear() + FOREVER_HORIZON_YEARS)
  return date > horizon
}

/** Every invite link into the node, whoever minted it (`scope=all`). */
export function InvitesSection({ category }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const [confirm, confirmElement] = useConfirm()
  const endpoint = `/node/${category.id}/invites`

  const query = useQuery({
    queryKey: extraKeys.invites(category.id),
    queryFn: () => modRequest<InvitesResponse>({ path: `${endpoint}.json`, query: { scope: 'all' } }),
    staleTime: 30_000
  })

  const [days, setDays] = useState<string>(FOREVER)
  const [uses, setUses] = useState<string>(UNLIMITED)
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const setInvites = (next: (invites: NodeInvite[]) => NodeInvite[]): void => {
    queryClient.setQueryData<InvitesResponse>(extraKeys.invites(category.id), (data) => (data ? { ...data, invites: next(data.invites) } : data))
  }

  const copy = async (invite: NodeInvite): Promise<void> => {
    try {
      await window.nodeloc.shell.copyText(invite.link)
      setCopiedId(invite.id)
      showToast(t('nodeModExtra.invites.copied'), 'success')
    } catch {
      // The link is still on screen to select by hand.
    }
  }

  const create = async (): Promise<void> => {
    if (busy) return
    const form: Array<[string, string]> = []
    if (days !== FOREVER) form.push(['days', days])
    if (uses !== UNLIMITED) form.push(['uses', uses])
    setBusy(true)
    try {
      const result = await modRequest<{ invite: NodeInvite }>({ method: 'POST', path: `${endpoint}.json`, form })
      setInvites((list) => [result.invite, ...list])
      invalidate()
      void copy(result.invite)
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (invite: NodeInvite): Promise<void> => {
    const ok = await confirm({ message: t('nodeModExtra.invites.confirmRevoke'), confirmLabel: t('nodeModExtra.invites.revoke') })
    if (!ok) return
    try {
      await modRequest({ method: 'DELETE', path: `${endpoint}/${invite.id}.json` })
      setInvites((list) => list.filter((other) => other.id !== invite.id))
      invalidate()
    } catch (error) {
      toastError(error)
    }
  }

  // The server caps "unlimited" at the site's limit for whoever minted it,
  // which the desktop can't read; a count above every offered choice is shown
  // as a plain tally instead of a misleading "of".
  const usedText = (invite: NodeInvite): string =>
    invite.max_redemptions_allowed > USES[USES.length - 1]
      ? t('nodeModExtra.invites.used', { count: invite.redemption_count })
      : t('nodeModExtra.invites.usedOf', { used: invite.redemption_count, max: invite.max_redemptions_allowed })

  const expiresText = (invite: NodeInvite): string =>
    expiresForever(invite.expires_at)
      ? t('nodeModExtra.invites.neverExpires')
      : t('nodeModExtra.invites.expires', { date: formatShortTime(invite.expires_at, i18n.language) })

  const invites = query.data?.invites ?? []

  return (
    <div className={styles.section}>
      <SectionHeader title={t('nodeModExtra.invites.title')} lede={t('nodeModExtra.invites.lede')} />

      <section className={styles.panel}>
        {!!query.data?.invited_count && <p className={styles.hint}>{t('nodeModExtra.invites.invitedCount', { count: query.data.invited_count })}</p>}
        <div className={styles.row} style={{ alignItems: 'flex-end' }}>
          <Field label={t('nodeModExtra.invites.expiry')} htmlFor="mod-invite-days">
            <select id="mod-invite-days" className={styles.select} value={days} onChange={(event) => setDays(event.target.value)}>
              {EXPIRY_DAYS.map((value) => (
                <option key={value} value={String(value)}>
                  {t('nodeModExtra.invites.days', { count: value })}
                </option>
              ))}
              <option value={FOREVER}>{t('nodeModExtra.invites.forever')}</option>
            </select>
          </Field>
          <Field label={t('nodeModExtra.invites.maxUses')} htmlFor="mod-invite-uses">
            <select id="mod-invite-uses" className={styles.select} value={uses} onChange={(event) => setUses(event.target.value)}>
              {USES.map((value) => (
                <option key={value} value={String(value)}>
                  {t('nodeModExtra.invites.uses', { count: value })}
                </option>
              ))}
              <option value={UNLIMITED}>{t('nodeModExtra.invites.unlimited')}</option>
            </select>
          </Field>
          <Button variant="primary" icon={<Link2 />} disabled={busy} onClick={() => void create()}>
            {t('nodeModExtra.invites.create')}
          </Button>
        </div>
      </section>

      {query.isPending ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : query.isError ? (
        <EmptyState
          title={t('nodeModExtra.common.loadFailed')}
          action={<Button onClick={() => void query.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
        />
      ) : invites.length > 0 ? (
        <ul className={styles.list}>
          {invites.map((invite) => (
            <li key={invite.id} className={styles.item}>
              <div className={styles.itemBody}>
                <input className={`${styles.input} ${styles.mono}`} value={invite.link} readOnly onFocus={(event) => event.target.select()} />
                <span className={styles.itemMeta}>
                  <span className={styles.row} style={{ display: 'inline-flex', gap: 4, verticalAlign: 'middle' }}>
                    <Avatar template={invite.invited_by.avatar_template} username={invite.invited_by.username} size={16} />
                    {invite.invited_by.username}
                  </span>
                  {' · '}
                  {usedText(invite)}
                  {' · '}
                  {expiresText(invite)}
                </span>
              </div>
              <div className={styles.itemActions}>
                <Button size="sm" icon={copiedId === invite.id ? <Check /> : <Copy />} onClick={() => void copy(invite)}>
                  {t('nodeModExtra.invites.copy')}
                </Button>
                <IconButton size="sm" label={t('nodeModExtra.invites.revoke')} className={styles.dangerIcon} onClick={() => void revoke(invite)}>
                  <Trash2 />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Link2 />} title={t('nodeModExtra.invites.none')} />
      )}
      {confirmElement}
    </div>
  )
}
