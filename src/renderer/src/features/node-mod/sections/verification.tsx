import { BadgeCheck, Clock, ShieldHalf, TriangleAlert, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Switch } from '../../../components/Switch'
import { cx } from '../../../lib/cx'
import { absoluteUrl } from '../../../lib/discourse'
import { modRequest, type VerificationState } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, formatDay, useConfirm, useErrorToast } from './extra-ui'
import { useInvalidateNodeMod } from './use-invalidate'

/**
 * The node's verified mark from its owner's side, plus the admin's manual
 * grant and the official mark. Shown as a tab of the settings section.
 */
export function VerificationSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const [confirm, confirmElement] = useConfirm()
  const [latest, setLatest] = useState<VerificationState | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const endpoint = `/node/${category.id}/verification`

  const state = latest ?? mod.verification
  const endsAt = formatDay(state.ends_at, i18n.language)

  const run = async (request: Parameters<typeof modRequest>[0], after?: () => void): Promise<void> => {
    setBusy(true)
    try {
      const result = await modRequest<{ verification: VerificationState }>(request)
      setLatest(result.verification)
      after?.()
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const apply = (event?: FormEvent): void => {
    event?.preventDefault()
    if (busy) return
    void run({ method: 'POST', path: `${endpoint}.json`, json: { note: note.trim() } }, () => setNote(''))
  }

  const withdraw = async (): Promise<void> => {
    if (await confirm({ message: t('nodeModExtra.verification.confirmWithdraw'), danger: false })) {
      void run({ method: 'DELETE', path: `${endpoint}.json` })
    }
  }

  const grant = async (): Promise<void> => {
    const message = state.status === 'approved' ? t('nodeModExtra.verification.confirmExtend') : t('nodeModExtra.verification.confirmGrant')
    if (await confirm({ message, danger: false })) void run({ method: 'POST', path: `${endpoint}/grant.json` })
  }

  const revoke = async (): Promise<void> => {
    if (await confirm({ message: t('nodeModExtra.verification.confirmRevoke'), confirmLabel: t('nodeModExtra.verification.revoke') })) {
      void run({ method: 'DELETE', path: `${endpoint}/grant.json` })
    }
  }

  const openRenew = (): void => {
    void window.nodeloc.browser.open(absoluteUrl(state.renew_url))
  }

  if (!state.available && !state.can_manage) {
    return <EmptyState icon={<BadgeCheck />} title={t('nodeModExtra.verification.unavailable')} />
  }

  return (
    <section className={styles.panel}>
      <p className={styles.hint}>{t('nodeModExtra.verification.hint')}</p>

      {state.official && (
        <div className={cx(styles.status, styles.statusOfficial)}>
          <BadgeCheck />
          <span className={styles.statusText}>{t('nodeModExtra.verification.officialNote')}</span>
        </div>
      )}

      {state.status === 'approved' ? (
        <>
          <div className={cx(styles.status, styles.statusSuccess)}>
            <BadgeCheck />
            <span className={styles.statusText}>
              {state.manual
                ? t('nodeModExtra.verification.manualApprovedUntil', { date: endsAt })
                : t('nodeModExtra.verification.approvedUntil', { date: endsAt })}
            </span>
          </div>
          {state.expiring && (
            <div className={cx(styles.status, styles.statusWarning)}>
              <TriangleAlert />
              <span className={styles.statusText}>{t('nodeModExtra.verification.expiring', { count: state.days_remaining ?? 0 })}</span>
              <Button size="sm" variant="primary" onClick={openRenew}>
                {t('nodeModExtra.verification.renew')}
              </Button>
            </div>
          )}
        </>
      ) : state.status === 'pending' ? (
        <div className={styles.status}>
          <Clock />
          <span className={styles.statusText}>{t('nodeModExtra.verification.pending')}</span>
          <Button size="sm" disabled={busy} onClick={() => void withdraw()}>
            {t('nodeModExtra.verification.withdraw')}
          </Button>
        </div>
      ) : (
        <>
          {state.status === 'rejected' && (
            <div className={cx(styles.status, styles.statusDanger)}>
              <X />
              <span className={styles.statusText}>
                {t('nodeModExtra.verification.rejected', { reason: state.moderation_reason || t('nodeModExtra.verification.noReason') })}
              </span>
            </div>
          )}
          {state.status === 'expired' && (
            <div className={styles.status}>
              <Clock />
              <span className={styles.statusText}>
                {state.manual ? t('nodeModExtra.verification.manualExpired') : t('nodeModExtra.verification.expired')}
              </span>
            </div>
          )}

          {state.can_apply ? (
            <form className={styles.field} onSubmit={apply}>
              <p className={styles.hint}>
                {t('nodeModExtra.verification.backedBy', {
                  name: state.merchant?.name ?? '',
                  date: formatDay(state.merchant?.ends_at, i18n.language)
                })}
              </p>
              <textarea
                className={styles.textarea}
                rows={3}
                maxLength={500}
                placeholder={t('nodeModExtra.verification.notePlaceholder')}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className={styles.row}>
                <Button type="submit" variant="primary" icon={<BadgeCheck />} disabled={busy}>
                  {t('nodeModExtra.verification.apply')}
                </Button>
              </div>
            </form>
          ) : state.merchant ? (
            <p className={styles.hint}>{t('nodeModExtra.verification.merchantUsedElsewhere')}</p>
          ) : state.available ? (
            <p className={styles.hint}>
              {t('nodeModExtra.verification.needMerchant')}{' '}
              <button type="button" className={styles.linkButton} onClick={openRenew}>
                {t('nodeModExtra.verification.becomeMerchant')}
              </button>
            </p>
          ) : null}
        </>
      )}

      {state.can_manage && (
        <>
          <div className={styles.divider} />
          <h3 className={styles.panelTitle}>
            <ShieldHalf />
            {t('nodeModExtra.verification.manualTitle')}
          </h3>
          <p className={styles.hint}>{t('nodeModExtra.verification.manualHint')}</p>
          <div className={styles.row}>
            <Button variant="primary" icon={<BadgeCheck />} disabled={busy} onClick={() => void grant()}>
              {state.status === 'approved' ? t('nodeModExtra.verification.extend') : t('nodeModExtra.verification.grant')}
            </Button>
            {state.status === 'approved' && (
              <Button className={styles.dangerButton} icon={<X />} disabled={busy} onClick={() => void revoke()}>
                {t('nodeModExtra.verification.revoke')}
              </Button>
            )}
          </div>
          <Switch
            checked={state.official}
            disabled={busy}
            onChange={(official) => void run({ method: 'PUT', path: `${endpoint}/official.json`, json: { official } })}
            label={t('nodeModExtra.verification.officialToggle')}
            description={t('nodeModExtra.verification.officialHint')}
          />
        </>
      )}
      {confirmElement}
    </section>
  )
}
