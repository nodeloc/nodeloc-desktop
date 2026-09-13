import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button type="button" className={cx(styles.button, styles[variant], styles[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as the tooltip. */
  label: string
  size?: 'sm' | 'md'
}

export function IconButton({ label, size = 'md', className, children, ...rest }: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(styles.iconButton, styles[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}
