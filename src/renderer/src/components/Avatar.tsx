import { useState } from 'react'
import { cx } from '../lib/cx'
import { avatarUrl } from '../lib/discourse'
import styles from './Avatar.module.css'

interface AvatarProps {
  /** Discourse `avatar_template` with a `{size}` placeholder. */
  template?: string | null
  username: string
  size?: number
  className?: string
}

/** Round avatar that falls back to the first letter on a two-variant palette, as on iOS. */
export function Avatar({ template, username, size = 32, className }: AvatarProps): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const dimensions = { width: size, height: size }

  if (template && !failed) {
    return (
      <img
        className={cx(styles.avatar, className)}
        src={avatarUrl(template, size)}
        style={dimensions}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      className={cx(styles.avatar, styles.fallback, className)}
      data-variant={paletteVariant(username)}
      style={{ ...dimensions, fontSize: Math.round(size * 0.45) }}
      aria-hidden="true"
    >
      {username.charAt(0).toUpperCase()}
    </span>
  )
}

/** Stable per username; FNV-1a so similar names don't all land on one colour. */
function paletteVariant(username: string): 0 | 1 {
  let hash = 0x811c9dc5
  for (const char of username) hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193)
  return ((hash >>> 0) % 2) as 0 | 1
}
