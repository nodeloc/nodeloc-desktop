import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RedEnvelope } from '../../api/types'
import styles from './RedEnvelopeBanner.module.css'

/** discourse-red-envelope: energy split among people who reply to the topic. */
export function RedEnvelopeBanner({ envelope }: { envelope: RedEnvelope }): React.JSX.Element {
  const { t } = useTranslation()
  const progress = envelope.total_count > 0 ? (envelope.claimed_count / envelope.total_count) * 100 : 0

  return (
    <section className={styles.banner} data-exhausted={envelope.exhausted}>
      <span className={styles.icon}>
        <Wallet />
      </span>
      <div className={styles.body}>
        <div className={styles.titleLine}>
          <strong>{t('reader.envelope.title')}</strong>
          <span>{t('reader.envelope.summary', { points: envelope.total_points, count: envelope.total_count })}</span>
        </div>
        <div className={styles.progress} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.meta}>
          <span>{t('reader.envelope.progress', { claimed: envelope.claimed_count, total: envelope.total_count })}</span>
          <span>
            {envelope.exhausted
              ? t('reader.envelope.exhausted')
              : `${t('reader.envelope.remaining', { points: envelope.remaining_points })} · ${t('reader.envelope.hint')}`}
          </span>
        </div>
      </div>
    </section>
  )
}
