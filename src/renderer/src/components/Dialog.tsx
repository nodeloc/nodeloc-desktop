import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { cx } from '../lib/cx'
import { IconButton } from './Button'
import styles from './Dialog.module.css'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** Allow Esc and backdrop clicks to close (default true). */
  dismissible?: boolean
  /** Render only the supplied card, without the standard panel chrome. */
  bare?: boolean
  /** Place the panel beside this element instead of centring it. */
  anchor?: HTMLElement | null
}

/** A modal panel over a dimmed backdrop. Focus moves inside on open and returns on close. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 440,
  dismissible = true,
  bare = false,
  anchor
}: DialogProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const panel = useRef<HTMLDivElement>(null)
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = panel.current?.querySelector<HTMLElement>('input, textarea, button:not([data-dialog-close]), [tabindex]')
    ;(focusable ?? panel.current)?.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      previous?.focus?.()
    }
  }, [open, dismissible, onClose])

  useLayoutEffect(() => {
    if (!open || !anchor) return

    const position = (): void => {
      const panelRect = panel.current?.getBoundingClientRect()
      if (!panelRect || !anchor.isConnected) return

      const anchorRect = anchor.getBoundingClientRect()
      const edge = 12
      const gap = 12
      const right = anchorRect.right + gap
      const left = right + panelRect.width <= window.innerWidth - edge
        ? right
        : anchorRect.left - panelRect.width - gap
      const top = anchorRect.top + anchorRect.height / 2 - panelRect.height / 2

      setAnchorStyle({
        left: Math.max(edge, Math.min(left, window.innerWidth - panelRect.width - edge)),
        top: Math.max(edge, Math.min(top, window.innerHeight - panelRect.height - edge))
      })
    }

    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [anchor, open])

  if (!open) return null

  return createPortal(
    <div
      className={cx(styles.backdrop, anchor && styles.anchoredBackdrop)}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        className={cx(styles.panel, bare && styles.barePanel, anchor && styles.anchoredPanel)}
        role="dialog"
        aria-modal="true"
        aria-label={bare && typeof title === 'string' ? title : undefined}
        data-dialog-variant={bare ? 'bare' : 'default'}
        data-dialog-position={anchor ? 'anchored' : 'centered'}
        data-positioned={!anchor || anchorStyle ? '' : undefined}
        style={{ width, ...anchorStyle }}
        tabIndex={-1}
      >
        {!bare && (title || dismissible) && (
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {dismissible && (
              <IconButton label={t('common.close')} size="sm" onClick={onClose} data-dialog-close>
                <X />
              </IconButton>
            )}
          </header>
        )}
        <div className={cx(styles.body, bare && styles.bareBody)}>{children}</div>
        {!bare && footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
