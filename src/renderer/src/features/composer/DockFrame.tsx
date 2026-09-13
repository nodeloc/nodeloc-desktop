import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../components/Button'
import { cx } from '../../lib/cx'
import styles from './ReplyDock.module.css'

/** Smallest height the dock can be dragged to. */
const MIN_DOCK_HEIGHT = 180
/** Largest share of the main column a dragged dock may take. */
const MAX_DOCK_SHARE = 0.8

interface DockFrameProps {
  heading: string
  /** Muted text after the heading (the topic title when replying to a user). */
  subheading?: string
  /** Changing it (a new session) expands a minimized dock. */
  sessionKey: unknown
  onRequestClose: () => void
  /** Rendered with the dock's resized state, so the editor can fill a dragged dock. */
  children: (resized: boolean) => ReactNode
}

/**
 * Docked panel chrome under the main column: drag the top edge to resize
 * (double-click resets), minimize to the header, close.
 */
export function DockFrame({ heading, subheading, sessionKey, onRequestClose, children }: DockFrameProps): React.JSX.Element {
  const { t } = useTranslation()
  const [minimized, setMinimized] = useState(false)
  const [height, setHeight] = useState<number | null>(null)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    setMinimized(false)
  }, [sessionKey])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const element = panel.current
    const container = element?.parentElement
    if (!element || !container || event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const startY = event.clientY
    const startHeight = element.offsetHeight
    const maxHeight = container.clientHeight * MAX_DOCK_SHARE
    handle.setPointerCapture(event.pointerId)

    const onMove = (move: PointerEvent): void => {
      setHeight(Math.round(Math.min(maxHeight, Math.max(MIN_DOCK_HEIGHT, startHeight + startY - move.clientY))))
    }
    const onEnd = (): void => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onEnd)
      handle.removeEventListener('pointercancel', onEnd)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onEnd)
    handle.addEventListener('pointercancel', onEnd)
  }

  const resized = height !== null && !minimized

  return (
    <section
      ref={panel}
      className={cx(styles.dock, minimized && styles.minimized, resized && styles.resized)}
      style={resized ? { height } : undefined}
      aria-label={heading}
    >
      {!minimized && (
        <div className={styles.handle} title={t('composer.reply.resize')} onPointerDown={startResize} onDoubleClick={() => setHeight(null)} />
      )}

      <header className={styles.header} onClick={minimized ? () => setMinimized(false) : undefined}>
        <h2 className={styles.title}>
          <span>{heading}</span>
          {subheading && <span className={styles.topicTitle}>{subheading}</span>}
        </h2>
        <IconButton
          size="sm"
          label={minimized ? t('composer.reply.expand') : t('composer.reply.minimize')}
          onClick={(event) => {
            event.stopPropagation()
            setMinimized((value) => !value)
          }}
        >
          {minimized ? <ChevronUp /> : <ChevronDown />}
        </IconButton>
        <IconButton
          size="sm"
          label={t('common.close')}
          onClick={(event) => {
            event.stopPropagation()
            onRequestClose()
          }}
        >
          <X />
        </IconButton>
      </header>

      {/* Hidden rather than unmounted when minimized: keeps uploads, undo history and the caret. */}
      <div className={styles.body} hidden={minimized}>
        {children(resized)}
      </div>
    </section>
  )
}
