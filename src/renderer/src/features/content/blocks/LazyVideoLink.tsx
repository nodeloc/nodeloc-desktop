import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { parseMediaEmbed } from '@shared/media-embed'
import { absoluteUrl } from '../../../lib/discourse'
import { EmbeddedMedia } from './EmbeddedMedia'
import styles from './LazyVideoLink.module.css'

const PROVIDER_URLS: Record<string, (id: string) => string> = {
  youtube: (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
  bilibili: (id) => `https://www.bilibili.com/video/${encodeURIComponent(id)}`,
  twitter: (id) => `https://x.com/i/web/status/${encodeURIComponent(id)}`,
  x: (id) => `https://x.com/i/web/status/${encodeURIComponent(id)}`,
  vimeo: (id) => `https://vimeo.com/${encodeURIComponent(id)}`,
  tiktok: (id) => `https://www.tiktok.com/embed/v2/${encodeURIComponent(id)}`
}

/**
 * Discourse placeholders use data-provider-name; older plugins use data-provider.
 * Supported providers play inline; other known providers retain their link card.
 */
export function LazyVideoLink({ element }: { element: Element }): React.JSX.Element | null {
  const { t } = useTranslation()
  const provider = (element.getAttribute('data-provider-name') ?? element.getAttribute('data-provider') ?? (element.classList.contains('lazyYT') ? 'youtube' : '')).toLowerCase()
  const id = element.getAttribute('data-video-id') ?? element.getAttribute('data-youtube-id') ?? ''
  const title = element.getAttribute('data-video-title') ?? element.textContent?.trim() ?? ''
  const thumbnail = element.querySelector('img')?.getAttribute('src')
  const url = PROVIDER_URLS[provider]?.(id)
  const media = parseMediaEmbed(element.querySelector('a')?.getAttribute('href')) ?? parseMediaEmbed(url)
  if (media) return <EmbeddedMedia media={media} title={title} />
  if (!url) return null

  return (
    <a className={styles.card} href={url} title={t('content.openVideo')}>
      {thumbnail && <img src={absoluteUrl(thumbnail)} alt="" loading="lazy" />}
      <span className={styles.play}>
        <Play fill="currentColor" />
      </span>
      {title && <span className={styles.title}>{title}</span>}
    </a>
  )
}
