import { Wallet, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/Button'
import { formatCount } from '../../lib/format'
import { useCurrentUser } from '../account/use-session'
import form from './ComposerForm.module.css'
import { RED_ENVELOPE_MAX_COUNT, type RedEnvelopeConfig } from './red-envelope'

interface RedEnvelopePanelProps {
  value: RedEnvelopeConfig
  onChange: (next: RedEnvelopeConfig) => void
  onRemove: () => void
  /** Translated validation message, shown after a publish attempt. */
  problem?: string | null
}

/** Red envelope settings for a new topic (COMP-11). Created right after the topic is posted. */
export function RedEnvelopePanel({ value, onChange, onRemove, problem }: RedEnvelopePanelProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const balance = useCurrentUser()?.gamification_score

  return (
    <section className={form.panel}>
      <header className={form.panelHeader}>
        <Wallet />
        {t('composer.redEnvelope.title')}
        <IconButton size="sm" label={t('composer.redEnvelope.remove')} onClick={onRemove}>
          <X />
        </IconButton>
      </header>

      <div className={form.row}>
        <label className={form.field}>
          <span className={form.label}>{t('composer.redEnvelope.totalPoints')}</span>
          <input
            className={form.input}
            type="number"
            min={10}
            inputMode="numeric"
            value={value.totalPoints}
            onChange={(event) => onChange({ ...value, totalPoints: event.target.value })}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>{t('composer.redEnvelope.totalCount')}</span>
          <input
            className={form.input}
            type="number"
            min={1}
            max={RED_ENVELOPE_MAX_COUNT}
            inputMode="numeric"
            value={value.totalCount}
            onChange={(event) => onChange({ ...value, totalCount: event.target.value })}
          />
        </label>
      </div>

      <p className={form.hint}>
        {t('composer.redEnvelope.hint')}
        {balance !== undefined && ` ${t('composer.redEnvelope.balance', { points: formatCount(balance, i18n.language) })}`}
      </p>
      {problem && (
        <p className={form.error} role="alert">
          {problem}
        </p>
      )}
    </section>
  )
}
