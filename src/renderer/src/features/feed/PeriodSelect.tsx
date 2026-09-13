import { useTranslation } from 'react-i18next'
import { TOP_PERIODS, type TopPeriod } from './topic-list-source'
import styles from './PeriodSelect.module.css'

export function PeriodSelect({ value, onChange }: { value: TopPeriod; onChange: (period: TopPeriod) => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <select
      className={styles.select}
      value={value}
      aria-label={t('feed.period.label')}
      onChange={(event) => onChange(event.target.value as TopPeriod)}
    >
      {TOP_PERIODS.map((period) => (
        <option key={period} value={period}>
          {t(`feed.period.${period}`)}
        </option>
      ))}
    </select>
  )
}
