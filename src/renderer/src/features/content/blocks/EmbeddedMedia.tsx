import type { MediaEmbed } from '@shared/media-embed'
import styles from './EmbeddedMedia.module.css'

const PROVIDERS = { youtube: 'YouTube', bilibili: 'Bilibili', x: 'X' }

export function EmbeddedMedia({ media, title }: { media: MediaEmbed; title?: string }): React.JSX.Element {
  return (
    <span className={styles.embed}>
      <iframe
        className={media.provider === 'x' ? styles.tweet : styles.video}
        src={media.src}
        title={title || PROVIDERS[media.provider]}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </span>
  )
}
