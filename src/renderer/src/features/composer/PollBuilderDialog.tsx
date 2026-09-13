import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { cx } from '../../lib/cx'
import form from './ComposerForm.module.css'
import { useComposerOverlay } from './composer-overlay'
import {
  buildPollMarkdown,
  defaultPoll,
  POLL_MAXIMUM_OPTIONS,
  validatePoll,
  type PollChart,
  type PollConfig,
  type PollResults,
  type PollType
} from './poll-markdown'

const TYPES: readonly PollType[] = ['regular', 'multiple', 'number', 'ranked_choice']
const RESULTS: readonly PollResults[] = ['always', 'on_vote', 'on_close', 'staff_only']
const CHARTS: readonly PollChart[] = ['bar', 'pie']

interface PollBuilderDialogProps {
  /** Polls already in the post, to name the new one uniquely. */
  existingPolls: number
  /** Pass a stable callback: the dialog re-focuses when it changes. */
  onClose: () => void
  onInsert: (markdown: string) => void
}

/** Builds `[poll]` Markdown (COMP-09) with the poll plugin's own validation rules. */
export function PollBuilderDialog({ existingPolls, onClose, onInsert }: PollBuilderDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [config, setConfig] = useState<PollConfig>(defaultPoll)
  const [attempted, setAttempted] = useState(false)
  useComposerOverlay(true)

  const set = (patch: Partial<PollConfig>): void => setConfig((current) => ({ ...current, ...patch }))
  const problem = validatePoll(config)
  const ranged = config.type === 'multiple' || config.type === 'number'

  const insert = (): void => {
    setAttempted(true)
    if (problem) return
    onInsert(buildPollMarkdown(config, existingPolls > 0 ? `poll${existingPolls + 1}` : undefined))
  }

  return (
    <Dialog
      open
      onClose={onClose}
      width={520}
      title={t('composer.poll.title')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={insert}>
            {t('composer.poll.insert')}
          </Button>
        </>
      }
    >
      <div className={cx(form.stack)}>
        <div className={form.field}>
          <span className={form.label}>{t('composer.poll.type')}</span>
          <div className={form.segmented} role="group">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={form.segment}
                aria-pressed={config.type === type}
                onClick={() => set({ type })}
              >
                {t(`composer.poll.types.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <label className={form.field}>
          <span className={form.label}>{t('composer.poll.pollTitle')}</span>
          <input className={form.input} value={config.title} maxLength={255} onChange={(event) => set({ title: event.target.value })} />
        </label>

        {config.type !== 'number' && (
          <label className={form.field}>
            <span className={form.label}>{t('composer.poll.options', { count: POLL_MAXIMUM_OPTIONS })}</span>
            <textarea
              className={form.textarea}
              rows={5}
              value={config.optionsText}
              placeholder={t('composer.poll.optionsHint')}
              onChange={(event) => set({ optionsText: event.target.value })}
            />
          </label>
        )}

        {ranged && (
          <div className={form.row}>
            <label className={form.field}>
              <span className={form.label}>{t('composer.poll.min')}</span>
              <input
                className={form.input}
                type="number"
                min={0}
                inputMode="numeric"
                value={config.min}
                placeholder={config.type === 'number' ? '1' : '1'}
                onChange={(event) => set({ min: event.target.value })}
              />
            </label>
            <label className={form.field}>
              <span className={form.label}>{t('composer.poll.max')}</span>
              <input
                className={form.input}
                type="number"
                min={1}
                inputMode="numeric"
                value={config.max}
                placeholder={config.type === 'number' ? '10' : t('composer.poll.maxDefault')}
                onChange={(event) => set({ max: event.target.value })}
              />
            </label>
            {config.type === 'number' && (
              <label className={form.field}>
                <span className={form.label}>{t('composer.poll.step')}</span>
                <input
                  className={form.input}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={config.step}
                  placeholder="1"
                  onChange={(event) => set({ step: event.target.value })}
                />
              </label>
            )}
          </div>
        )}

        <div className={form.row}>
          <label className={form.field}>
            <span className={form.label}>{t('composer.poll.results')}</span>
            <select className={form.select} value={config.results} onChange={(event) => set({ results: event.target.value as PollResults })}>
              {RESULTS.map((value) => (
                <option key={value} value={value}>
                  {t(`composer.poll.resultsOptions.${value}`)}
                </option>
              ))}
            </select>
          </label>
          {config.type !== 'number' && (
            <label className={form.field}>
              <span className={form.label}>{t('composer.poll.chartType')}</span>
              <select className={form.select} value={config.chartType} onChange={(event) => set({ chartType: event.target.value as PollChart })}>
                {CHARTS.map((value) => (
                  <option key={value} value={value}>
                    {t(`composer.poll.charts.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className={form.field}>
          <span className={form.label}>{t('composer.poll.close')}</span>
          <input className={form.input} type="datetime-local" value={config.close} onChange={(event) => set({ close: event.target.value })} />
        </label>

        <label className={form.check}>
          <input type="checkbox" checked={config.public} onChange={(event) => set({ public: event.target.checked })} />
          {t('composer.poll.public')}
        </label>

        {attempted && problem && (
          <p className={form.error} role="alert">
            {t(`composer.poll.errors.${problem}`, { count: POLL_MAXIMUM_OPTIONS })}
          </p>
        )}
        <p className={form.hint}>{t('composer.poll.permissionHint')}</p>
      </div>
    </Dialog>
  )
}
