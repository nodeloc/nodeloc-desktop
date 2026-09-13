import { Gift, LockKeyhole, Wallet } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeatures } from '../../api/site'
import { Button } from '../../components/Button'
import form from './ComposerForm.module.css'
import { defaultLottery, type LotteryConfig } from './lottery'
import { LotteryPanel } from './LotteryPanel'
import { ReadPermissionSelect } from './ReadPermissionSelect'
import { defaultRedEnvelope, type RedEnvelopeConfig } from './red-envelope'
import { RedEnvelopePanel } from './RedEnvelopePanel'

interface TopicExtrasProps {
  readPermission: number | null
  onReadPermissionChange: (value: number | null) => void
  /** Leave the handler out where lotteries can't be added. */
  lottery?: LotteryConfig | null
  onLotteryChange?: (next: LotteryConfig | null) => void
  lotteryProblem?: string | null
  lotteryCap?: number | null
  /** Leave the handler out where red envelopes can't be added (anything but a new topic). */
  redEnvelope?: RedEnvelopeConfig | null
  onRedEnvelopeChange?: (next: RedEnvelopeConfig | null) => void
  redEnvelopeProblem?: string | null
}

/** Topic-level options under the body: read permission, lottery, red envelope. Plugins that aren't installed stay hidden. */
export function TopicExtras({
  readPermission,
  onReadPermissionChange,
  lottery,
  onLotteryChange,
  lotteryProblem,
  lotteryCap,
  redEnvelope,
  onRedEnvelopeChange,
  redEnvelopeProblem
}: TopicExtrasProps): React.JSX.Element {
  const { t } = useTranslation()
  const features = useFeatures()
  const readPermissionId = useId()

  return (
    <div className={form.stack}>
      <div className={form.actions}>
        <label className={form.inline} htmlFor={readPermissionId}>
          <LockKeyhole />
          {t('composer.readPermission.label')}
        </label>
        <ReadPermissionSelect id={readPermissionId} value={readPermission} onChange={onReadPermissionChange} />
        {onLotteryChange && features?.lottery && !lottery && (
          <Button size="sm" variant="ghost" icon={<Gift />} onClick={() => onLotteryChange(defaultLottery())}>
            {t('composer.lottery.add')}
          </Button>
        )}
        {onRedEnvelopeChange && features?.red_envelope && !redEnvelope && (
          <Button size="sm" variant="ghost" icon={<Wallet />} onClick={() => onRedEnvelopeChange(defaultRedEnvelope())}>
            {t('composer.redEnvelope.add')}
          </Button>
        )}
      </div>

      {lottery && onLotteryChange && (
        <LotteryPanel
          value={lottery}
          onChange={onLotteryChange}
          onRemove={() => onLotteryChange(null)}
          problem={lotteryProblem}
          cap={lotteryCap}
        />
      )}
      {redEnvelope && onRedEnvelopeChange && (
        <RedEnvelopePanel
          value={redEnvelope}
          onChange={onRedEnvelopeChange}
          onRemove={() => onRedEnvelopeChange(null)}
          problem={redEnvelopeProblem}
        />
      )}
    </div>
  )
}
