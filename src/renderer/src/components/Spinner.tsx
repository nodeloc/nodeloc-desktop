import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../lib/cx'
import styles from './Spinner.module.css'

interface SpinnerProps {
  /** Diameter in px. */
  size?: number
  className?: string
}

/** Standard rotating ring for loading states. */
export function Spinner({ size = 24, className }: SpinnerProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <span
      className={cx(styles.spinner, className)}
      style={{ '--spinner-size': `${size}px`, '--spinner-width': `${Math.max(2, Math.round(size / 10))}px` } as CSSProperties}
      role="status"
      aria-label={t('common.loading')}
    />
  )
}
