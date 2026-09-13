import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../lib/cx'
import styles from './Skeleton.module.css'

/**
 * Pulses once for the whole group, so every placeholder inside fades in
 * phase. Per-line animations drift apart.
 */
export function SkeletonGroup({ children, className }: { children: ReactNode; className?: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className={cx(styles.group, className)} role="status" aria-label={t('common.loading')}>
      {children}
    </div>
  )
}

/** A text-line placeholder; `width` is a fraction of the container. */
export function SkeletonLine({ width = 1, height = 13 }: { width?: number; height?: number }): React.JSX.Element {
  return <span className={styles.line} style={{ width: `${width * 100}%`, height } as CSSProperties} />
}

export function SkeletonCircle({ size }: { size: number }): React.JSX.Element {
  return <span className={styles.circle} style={{ width: size, height: size }} />
}
