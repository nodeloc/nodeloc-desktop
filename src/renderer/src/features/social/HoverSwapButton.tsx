import type { ComponentProps, ReactNode } from 'react'
import { Button } from '../../components/Button'
import { cx } from '../../lib/cx'
import styles from './HoverSwapButton.module.css'

interface HoverSwapButtonProps extends Omit<ComponentProps<typeof Button>, 'children' | 'icon'> {
  label: string
  icon?: ReactNode
  /** Shown on hover/focus, e.g. 已加入 → 退出. Omit for a plain state label. */
  hoverLabel?: string
  hoverIcon?: ReactNode
}

/**
 * A state button that reveals its undo action on hover (已关注 → 取消关注).
 * Both labels share one grid cell, so the button never changes width.
 */
export function HoverSwapButton({
  label,
  icon,
  hoverLabel,
  hoverIcon,
  variant = 'secondary',
  className,
  ...rest
}: HoverSwapButtonProps): React.JSX.Element {
  return (
    <Button
      variant={variant}
      className={cx(hoverLabel && styles.swappable, !hoverLabel && styles.static, className)}
      title={hoverLabel}
      {...rest}
    >
      <span className={styles.stack}>
        <span className={styles.idle}>
          {icon}
          {label}
        </span>
        {hoverLabel && (
          <span className={styles.hover} aria-hidden="true">
            {hoverIcon}
            {hoverLabel}
          </span>
        )}
      </span>
    </Button>
  )
}
