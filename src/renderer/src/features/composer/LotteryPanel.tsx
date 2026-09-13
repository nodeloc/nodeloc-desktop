import { Gift, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../components/Button'
import form from './ComposerForm.module.css'
import { localDateTimeValue, type LotteryConfig, type LotteryLevel } from './lottery'

interface LotteryPanelProps {
  value: LotteryConfig
  onChange: (next: LotteryConfig) => void
  onRemove: () => void
  /** Translated validation message, shown after a publish attempt. */
  problem?: string | null
  /** Non-staff cap on the minimum participants, when the plugin sets one. */
  cap?: number | null
}

const TRUST_LEVELS = [0, 1, 2, 3, 4] as const

/** Lottery settings for a new topic (COMP-10). Created right after the topic is posted. */
export function LotteryPanel({ value, onChange, onRemove, problem, cap }: LotteryPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const set = (patch: Partial<LotteryConfig>): void => onChange({ ...value, ...patch })
  const setLevel = (index: number, patch: Partial<LotteryLevel>): void =>
    set({ levels: value.levels.map((level, position) => (position === index ? { ...level, ...patch } : level)) })

  return (
    <section className={form.panel}>
      <header className={form.panelHeader}>
        <Gift />
        {t('composer.lottery.title')}
        <IconButton size="sm" label={t('composer.lottery.remove')} onClick={onRemove}>
          <X />
        </IconButton>
      </header>

      <div className={form.row}>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.name')}</span>
          <input
            className={form.input}
            value={value.title}
            maxLength={255}
            placeholder={t('composer.lottery.namePlaceholder')}
            onChange={(event) => set({ title: event.target.value })}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.drawAt')}</span>
          <input
            className={form.input}
            type="datetime-local"
            min={localDateTimeValue(new Date())}
            value={value.drawAt}
            onChange={(event) => set({ drawAt: event.target.value })}
          />
        </label>
      </div>

      <div className={form.row}>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.minParticipants')}</span>
          <input
            className={form.input}
            type="number"
            min={1}
            max={cap ?? undefined}
            inputMode="numeric"
            value={value.minParticipants}
            onChange={(event) => set({ minParticipants: event.target.value })}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.maxParticipants')}</span>
          <input
            className={form.input}
            type="number"
            min={0}
            inputMode="numeric"
            value={value.maxParticipants}
            onChange={(event) => set({ maxParticipants: event.target.value })}
          />
        </label>
      </div>

      <div className={form.row}>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.minTickets')}</span>
          <input
            className={form.input}
            type="number"
            min={1}
            inputMode="numeric"
            value={value.minTickets}
            onChange={(event) => set({ minTickets: event.target.value })}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.maxTickets')}</span>
          <input
            className={form.input}
            type="number"
            min={1}
            inputMode="numeric"
            value={value.maxTickets}
            onChange={(event) => set({ maxTickets: event.target.value })}
          />
        </label>
        <label className={form.field}>
          <span className={form.label}>{t('composer.lottery.minTrustLevel')}</span>
          <select className={form.select} value={value.minTrustLevel} onChange={(event) => set({ minTrustLevel: event.target.value })}>
            {TRUST_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t('composer.lottery.trustLevel', { level })}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={form.field}>
        <span className={form.label}>{t('composer.lottery.levels')}</span>
        <div className={form.levels}>
          {value.levels.map((level, index) => (
            <div key={index} className={form.levelRow}>
              <input
                className={form.input}
                value={level.name}
                maxLength={50}
                placeholder={t('composer.lottery.levelName')}
                aria-label={t('composer.lottery.levelName')}
                onChange={(event) => setLevel(index, { name: event.target.value })}
              />
              <input
                className={form.input}
                value={level.prize}
                maxLength={200}
                placeholder={t('composer.lottery.prize')}
                aria-label={t('composer.lottery.prize')}
                onChange={(event) => setLevel(index, { prize: event.target.value })}
              />
              <input
                className={form.input}
                type="number"
                min={1}
                inputMode="numeric"
                value={level.quantity}
                aria-label={t('composer.lottery.quantity')}
                title={t('composer.lottery.quantity')}
                onChange={(event) => setLevel(index, { quantity: event.target.value })}
              />
              <IconButton
                size="sm"
                label={t('composer.lottery.removeLevel')}
                disabled={value.levels.length <= 1}
                onClick={() => set({ levels: value.levels.filter((_, position) => position !== index) })}
              >
                <Trash2 />
              </IconButton>
            </div>
          ))}
        </div>
        <div className={form.actions}>
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus />}
            onClick={() => set({ levels: [...value.levels, { name: '', prize: '', quantity: '1' }] })}
          >
            {t('composer.lottery.addLevel')}
          </Button>
        </div>
      </div>

      <p className={form.hint}>
        {t('composer.lottery.hint')}
        {cap !== null && cap !== undefined && ` ${t('composer.lottery.capHint', { cap })}`}
      </p>
      {problem && (
        <p className={form.error} role="alert">
          {problem}
        </p>
      )}
    </section>
  )
}
