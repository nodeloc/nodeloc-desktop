import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './PanelCard.module.css'

interface PanelCardProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** A titled card for the detail panel and similar side content. */
export function PanelCard({ title, action, children, className }: PanelCardProps): React.JSX.Element {
  return (
    <section className={cx(styles.card, className)}>
      {(title || action) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
