import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppWindow, Maximize2, Minimize2 } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useTranslation } from 'react-i18next'
import type { EmbeddedAppBounds } from '@shared/bridge'
import type { Post } from '../../../api/types'
import { cx } from '../../../lib/cx'
import styles from './MiniAppLauncher.module.css'

export function MiniAppLauncher({ installId, post }: { installId: number; post?: Post }): React.JSX.Element {
  const { t } = useTranslation()
  const player = useRef<HTMLDivElement>(null)
  const viewId = useRef(`mini-app-${crypto.randomUUID()}`)
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenTarget, setFullscreenTarget] = useState<HTMLElement | null>(null)
  const [failed, setFailed] = useState(false)
  const homeUrl = post?.post_url ? new URL(post.post_url, SITE_ORIGIN).href : undefined

  useLayoutEffect(() => {
    setFullscreenTarget(player.current?.closest<HTMLElement>('[data-app-fullscreen-target="true"]') ?? null)
  }, [])

  useEffect(() => {
    const element = player.current
    if (!element) return
    let alive = true
    void window.nodeloc.apps
      .mount({ viewId: viewId.current, installId, homeUrl, ...measure(element, false) })
      .then((mounted) => {
        if (alive) setFailed(!mounted)
      })
    return () => {
      alive = false
      void window.nodeloc.apps.unmount(viewId.current)
    }
  }, [homeUrl, installId])

  useEffect(() => {
    const element = player.current
    if (!element) return
    let frame = 0
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => void window.nodeloc.apps.update(viewId.current, measure(element, fullscreen)))
    }
    const syncFullscreen = (event: Event): void => {
      const activeView = (event as CustomEvent<string | null>).detail
      if (activeView && activeView !== viewId.current) {
        void window.nodeloc.apps.update(viewId.current, { ...measure(element, false), visible: false })
      } else update()
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (fullscreenTarget) observer.observe(fullscreenTarget)
    document.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('nodeloc-mini-app-fullscreen', syncFullscreen)
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('nodeloc-mini-app-fullscreen', syncFullscreen)
    }
  }, [fullscreen, fullscreenTarget])

  useEffect(() => {
    if (!fullscreen) return
    const exit = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setFullscreen(false)
        window.dispatchEvent(new CustomEvent('nodeloc-mini-app-fullscreen', { detail: null }))
      }
    }
    window.addEventListener('keydown', exit)
    return () => {
      window.removeEventListener('keydown', exit)
      window.dispatchEvent(new CustomEvent('nodeloc-mini-app-fullscreen', { detail: null }))
    }
  }, [fullscreen])

  const frame = (
    <section className={cx(styles.frame, fullscreen && styles.fullscreen)} aria-label={t('apps.embeddedTitle')}>
      <header className={styles.toolbar}>
        <span className={styles.label}>
          <AppWindow aria-hidden="true" />
          {t('apps.embeddedTitle')}
        </span>
        {fullscreenTarget && (
          <button
            type="button"
            className={styles.control}
            aria-label={fullscreen ? t('apps.exitColumnFullscreen') : t('apps.columnFullscreen')}
            title={fullscreen ? t('apps.exitColumnFullscreen') : t('apps.columnFullscreen')}
            onClick={() => {
              const next = !fullscreen
              setFullscreen(next)
              window.dispatchEvent(new CustomEvent('nodeloc-mini-app-fullscreen', { detail: next ? viewId.current : null }))
            }}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </button>
        )}
      </header>
      <div ref={player} className={styles.player}>
        {failed && <span className={styles.error}>{t('apps.embeddedFailed')}</span>}
      </div>
    </section>
  )

  return <div className={styles.root}>{fullscreen && fullscreenTarget ? createPortal(frame, fullscreenTarget) : frame}</div>
}

function measure(element: HTMLElement, fullscreen: boolean): EmbeddedAppBounds {
  const rect = element.getBoundingClientRect()
  const clip = element.closest<HTMLElement>('[data-app-fullscreen-target="true"]')?.getBoundingClientRect()
  const left = Math.max(0, clip?.left ?? 0)
  const top = Math.max(0, clip?.top ?? 0)
  const right = Math.min(window.innerWidth, clip?.right ?? window.innerWidth)
  const bottom = Math.min(window.innerHeight, clip?.bottom ?? window.innerHeight)
  const fullyInside = rect.left >= left && rect.top >= top && rect.right <= right && rect.bottom <= bottom
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    visible: document.visibilityState === 'visible' && fullyInside && rect.width > 1 && rect.height > 1,
    fullscreen
  }
}
