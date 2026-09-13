import { useState } from 'react'
import type { UploadRef } from '../api/types'
import { cx } from '../lib/cx'
import { absoluteUrl } from '../lib/discourse'
import styles from './NodeIcon.module.css'

interface NodeIconProps {
  name: string
  color?: string
  logo?: UploadRef | null
  logoDark?: UploadRef | null
  size?: number
  /** Nodes are circles; `square` (rounded) for app logos. */
  shape?: 'square' | 'circle'
  className?: string
}

/** A node's logo, or its first character on the node colour. */
export function NodeIcon({ name, color, logo, logoDark, size = 32, shape = 'circle', className }: NodeIconProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  if (logo && !failed) {
    return (
      <picture className={cx(styles.icon, styles[shape], className)} style={style}>
        {logoDark && <source srcSet={absoluteUrl(logoDark.url)} media="(prefers-color-scheme: dark)" />}
        <img src={absoluteUrl(logo.url)} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      </picture>
    )
  }

  return (
    <span
      className={cx(styles.icon, styles.fallback, styles[shape], className)}
      style={{ ...style, background: color ? `#${color}` : undefined, fontSize: Math.round(size * 0.44) }}
      aria-hidden="true"
    >
      {Array.from(name)[0]?.toUpperCase()}
    </span>
  )
}
