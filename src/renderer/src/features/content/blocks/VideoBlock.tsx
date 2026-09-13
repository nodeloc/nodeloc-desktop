import { Play } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../../api/client'
import type { AnyVideo } from '../../../api/types'
import { Spinner } from '../../../components/Spinner'
import { absoluteUrl } from '../../../lib/discourse'
import styles from './VideoBlock.module.css'

/** Upload URLs carry the file's sha1, which discourse-anyvideo uses as the lookup key. */
const SHA1_PATTERN = /\/original\/\dX\/(?:[^/]+\/)*([0-9a-f]{40})\.[^./?#]+(?:[?#]|$)/i

/**
 * A post video. Shows the poster until played, then asks discourse-anyvideo
 * for the HLS stream; while the stream is still being transcoded it plays
 * the original upload, as the web player does.
 */
export function VideoBlock({ src, poster }: { src: string; poster?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const sha1 = src.match(SHA1_PATTERN)?.[1]

  const info = useQuery({
    queryKey: ['anyvideo', sha1],
    queryFn: () => apiRequest<AnyVideo>({ path: `/anyvideo/videos/by_sha1/${sha1}.json`, priority: 'user' }),
    enabled: active && Boolean(sha1),
    staleTime: 5 * 60_000,
    retry: false
  })

  const posterUrl = info.data?.thumbnail_url ? absoluteUrl(info.data.thumbnail_url) : poster ? absoluteUrl(poster) : undefined

  if (!active) {
    return (
      <button
        type="button"
        className={styles.poster}
        style={posterUrl ? { backgroundImage: `url("${posterUrl}")` } : undefined}
        onClick={() => setActive(true)}
        aria-label={t('content.playVideo')}
      >
        <span className={styles.play}>
          <Play fill="currentColor" />
        </span>
      </button>
    )
  }

  // Wait briefly for the stream lookup; without a sha1 play the file directly.
  if (sha1 && info.isPending) {
    return (
      <div className={styles.poster} style={posterUrl ? { backgroundImage: `url("${posterUrl}")` } : undefined}>
        <Spinner size={36} />
      </div>
    )
  }

  const video = info.data
  const hls = video?.status === 'ready' && video.hls_url ? absoluteUrl(video.hls_url) : undefined
  const direct = video?.source_url ? absoluteUrl(video.source_url) : src

  return (
    <div className={styles.wrapper}>
      <Player src={hls ?? direct} isHls={Boolean(hls)} poster={posterUrl} />
      {video && video.status !== 'ready' && video.status !== 'failed' && (
        <p className={styles.note}>{t('content.videoProcessing')}</p>
      )}
    </div>
  )
}

function Player({ src, isHls, poster }: { src: string; isHls: boolean; poster?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let disposed = false
    let destroy: (() => void) | undefined

    if (!isHls) {
      element.src = src
      void element.play().catch(() => undefined)
      return
    }

    // hls.js is large; load it only when a stream actually plays.
    void import('hls.js').then(({ default: Hls }) => {
      if (disposed) return
      if (!Hls.isSupported()) {
        element.src = src
        return
      }
      const hls = new Hls({ enableWorker: true })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true)
      })
      hls.loadSource(src)
      hls.attachMedia(element)
      void element.play().catch(() => undefined)
      destroy = () => hls.destroy()
    })

    return () => {
      disposed = true
      destroy?.()
    }
  }, [src, isHls])

  if (failed) return <p className={styles.note}>{t('content.videoFailed')}</p>

  return <video ref={ref} className={styles.video} controls playsInline poster={poster} onError={() => setFailed(true)} />
}
