import { Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import styles from './DropdownMenu.module.css'

export interface MenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** Shown instead of acting, e.g. why it's disabled. */
  title?: string
  /** One option of a choice (theme, sort…): the current one gets a check mark. */
  checked?: boolean
}

interface DropdownMenuProps {
  /** Renders the trigger; call `toggle` from its click handler. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: Array<MenuItem | 'separator'>
  align?: 'start' | 'end'
  /** Open upwards (for triggers near the bottom of the window). */
  placement?: 'bottom' | 'top'
  /** Render outside scrolling containers so the menu cannot be clipped by a column. */
  portal?: boolean
}

/** A small popover menu anchored to its trigger. Closes on outside click, Esc or selection. */
export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  placement = 'bottom',
  portal = false
}: DropdownMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [portalStyle, setPortalStyle] = useState<CSSProperties>()
  const root = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !portal) return

    const position = (): void => {
      const triggerRect = root.current?.getBoundingClientRect()
      const menuRect = menu.current?.getBoundingClientRect()
      if (!triggerRect || !menuRect) return

      const edge = 8
      const gap = 4
      const desiredLeft = align === 'start' ? triggerRect.left : triggerRect.right - menuRect.width
      const desiredTop = placement === 'bottom' ? triggerRect.bottom + gap : triggerRect.top - menuRect.height - gap
      setPortalStyle({
        left: Math.max(edge, Math.min(desiredLeft, window.innerWidth - menuRect.width - edge)),
        top: Math.max(edge, Math.min(desiredTop, window.innerHeight - menuRect.height - edge))
      })
    }

    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [align, open, placement, portal])

  const menuElement = open ? (
    <div
      ref={menu}
      className={cx(styles.menu, portal ? styles.portal : styles[align], !portal && styles[placement])}
      style={portal ? portalStyle : undefined}
      data-positioned={!portal || portalStyle ? '' : undefined}
      role="menu"
    >
      {items.map((item, index) =>
        item === 'separator' ? (
          <div key={`separator-${index}`} className={styles.separator} role="separator" />
        ) : (
          <button
            key={item.key}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={item.checked}
            className={cx(styles.item, item.danger && styles.danger)}
            disabled={item.disabled}
            title={item.title}
            onClick={() => {
              setOpen(false)
              item.onSelect()
            }}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
            {item.checked && <Check className={styles.check} />}
          </button>
        )
      )}
    </div>
  ) : null

  return (
    <div ref={root} className={styles.root}>
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {portal && menuElement ? createPortal(menuElement, document.body) : menuElement}
    </div>
  )
}
