import type { ReactNode } from 'react'
import styles from './Switch.module.css'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

/** A labelled on/off switch row for settings. */
export function Switch({ checked, onChange, label, description, disabled = false }: SwitchProps): React.JSX.Element {
  return (
    <label className={styles.row} data-disabled={disabled}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  )
}
