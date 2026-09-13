import { Code, Crown, Diamond, Flame, Heart, Leaf, Medal, Rocket, ShieldCheck, Snowflake, Star, Trophy, User, Zap, type LucideIcon } from 'lucide-react'
import type { FlairFields } from '../api/types'
import { absoluteUrl } from '../lib/discourse'
import styles from './UserFlair.module.css'

/** Font Awesome names used by NodeLoc groups, mapped to the closest Lucide icon. */
const ICONS: Record<string, LucideIcon> = {
  user: User,
  gem: Diamond,
  icicles: Snowflake,
  snowflake: Snowflake,
  crown: Crown,
  star: Star,
  fire: Flame,
  'fire-flame-curved': Flame,
  heart: Heart,
  bolt: Zap,
  rocket: Rocket,
  leaf: Leaf,
  trophy: Trophy,
  medal: Medal,
  shield: ShieldCheck,
  'user-shield': ShieldCheck,
  'shield-halved': ShieldCheck,
  code: Code
}

/**
 * Group flair badge. `flair_url` is either an image path/URL or a Font
 * Awesome icon name ("gem"); only the former is ever fetched.
 */
export function UserFlair({ flair, size = 16 }: { flair: FlairFields; size?: number }): React.JSX.Element | null {
  const value = flair.flair_url
  if (!value) return null
  const title = flair.flair_name?.replace(/_/g, ' ') ?? undefined

  if (value.startsWith('/') || value.startsWith('http')) {
    return <img className={styles.image} src={absoluteUrl(value)} alt="" title={title} width={size} height={size} />
  }

  const IconComponent = ICONS[value.replace(/^(fa|fas|far|fab)-/, '')] ?? Star
  return (
    <span
      className={styles.badge}
      title={title}
      style={{
        width: size,
        height: size,
        background: flair.flair_bg_color ? `#${flair.flair_bg_color}` : undefined,
        color: flair.flair_color ? `#${flair.flair_color}` : undefined
      }}
    >
      <IconComponent size={Math.round(size * 0.66)} />
    </span>
  )
}
