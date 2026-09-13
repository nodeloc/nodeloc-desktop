import { useTranslation } from 'react-i18next'
import type { NestedSort } from '../../api/types'
import styles from './SortSelect.module.css'

const SORTS: readonly NestedSort[] = ['top', 'hot', 'new', 'old']

interface SortSelectProps {
  /** The sort the server actually applied, shown when no explicit choice was made. */
  value: NestedSort
  onChange: (sort: NestedSort) => void
}

export function SortSelect({ value, onChange }: SortSelectProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className={styles.group} role="radiogroup" aria-label={t('reader.sort.label')}>
      {SORTS.map((sort) => (
        <button
          key={sort}
          type="button"
          role="radio"
          aria-checked={value === sort}
          className={styles.option}
          data-selected={value === sort}
          onClick={() => onChange(sort)}
        >
          {t(`reader.sort.${sort}`)}
        </button>
      ))}
    </div>
  )
}
