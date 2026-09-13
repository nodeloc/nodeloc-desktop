import { ChevronLeft, ChevronRight, Download, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/Button'
import { useLightbox } from './lightbox-store'
import styles from './Lightbox.module.css'

const MIN_SCALE = 1
const MAX_SCALE = 6
const DOUBLE_CLICK_SCALE = 2.5

/**
 * Full-window image viewer: arrows/wheel/drag to navigate, zoom and pan;
 * Esc closes. Zoomed images pan instead of closing on background click.
 */
export function Lightbox(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { images, index, isOpen, close, step } = useLightbox()
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null)

  const image = images[index]

  const reset = useCallback(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  useEffect(reset, [index, isOpen, reset])

  const zoomBy = useCallback((factor: number) => {
    setScale((current) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * factor))
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowLeft') step(-1)
      else if (event.key === 'ArrowRight') step(1)
      else if (event.key === '+' || event.key === '=') zoomBy(1.25)
      else if (event.key === '-') zoomBy(0.8)
      else if (event.key === '0') reset()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, close, step, zoomBy, reset])

  if (!isOpen || !image) return null

  const onWheel = (event: WheelEvent): void => {
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15)
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y, moved: false }
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent): void => {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true
    if (scale > 1) setOffset({ x: start.originX + dx, y: start.originY + dy })
  }

  const onPointerUp = (event: PointerEvent): void => {
    const start = drag.current
    drag.current = null
    // A plain click on the backdrop (not the image) closes when not zoomed.
    if (start && !start.moved && scale === 1 && event.target === event.currentTarget) close()
  }

  const onDoubleClick = (): void => {
    if (scale > 1) reset()
    else setScale(DOUBLE_CLICK_SCALE)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={image.alt || t('media.viewer')}>
      <div
        className={styles.stage}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        data-zoomed={scale > 1}
      >
        <img
          key={image.src}
          className={styles.image}
          src={image.src}
          alt={image.alt ?? ''}
          draggable={false}
          onDoubleClick={onDoubleClick}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>

      <div className={styles.toolbar}>
        {images.length > 1 && (
          <span className={styles.counter}>
            {index + 1} / {images.length}
          </span>
        )}
        <IconButton label={t('media.zoomOut')} onClick={() => zoomBy(0.8)}>
          <ZoomOut />
        </IconButton>
        <button type="button" className={styles.scale} onClick={reset} title={t('media.resetZoom')}>
          {Math.round(scale * 100)}%
        </button>
        <IconButton label={t('media.zoomIn')} onClick={() => zoomBy(1.25)}>
          <ZoomIn />
        </IconButton>
        <IconButton label={t('media.save')} onClick={() => void window.nodeloc.shell.saveFile(image.src)}>
          <Download />
        </IconButton>
        <IconButton label={t('media.openOriginal')} onClick={() => void window.nodeloc.shell.openExternal(image.src)}>
          <ExternalLink />
        </IconButton>
        <IconButton label={t('common.close')} onClick={close}>
          <X />
        </IconButton>
      </div>

      {images.length > 1 && (
        <>
          <IconButton label={t('media.previous')} className={`${styles.nav} ${styles.prev}`} onClick={() => step(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton label={t('media.next')} className={`${styles.nav} ${styles.next}`} onClick={() => step(1)}>
            <ChevronRight />
          </IconButton>
        </>
      )}
    </div>
  )
}
