import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../components/Spinner'
import styles from './SuggestionList.module.css'

export interface Suggestion {
  key: string
  label: string
  detail?: string
  icon?: ReactNode
}

interface Anchor {
  left: number
  top: number
  /** Height of the anchor line; the list opens below it, or above when there's no room. */
  height: number
}

interface SuggestionListProps {
  id: string
  items: Suggestion[]
  active: number
  anchor: Anchor
  loading?: boolean
  /** Shown when nothing matches and nothing is loading. */
  emptyText?: string
  onSelect: (index: number) => void
  onActiveChange: (index: number) => void
}

const WIDTH = 300
const EDGE_GAP = 12
const PREFERRED_HEIGHT = 280

/**
 * Floating suggestions for autocomplete and tag inputs. Keyboard handling
 * stays with the input; this only renders and reports pointer choices.
 */
export function SuggestionList({ id, items, active, anchor, loading = false, emptyText, onSelect, onActiveChange }: SuggestionListProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const list = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const below = window.innerHeight - (anchor.top + anchor.height) - EDGE_GAP
    const above = anchor.top - EDGE_GAP
    const upward = below < Math.min(PREFERRED_HEIGHT, 180) && above > below
    setPlacement({
      left: Math.max(EDGE_GAP, Math.min(anchor.left, window.innerWidth - WIDTH - EDGE_GAP)),
      maxHeight: Math.min(PREFERRED_HEIGHT, upward ? above : below),
      ...(upward ? { bottom: window.innerHeight - anchor.top + 2 } : { top: anchor.top + anchor.height + 2 })
    })
  }, [anchor.left, anchor.top, anchor.height])

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  if (!placement || (items.length === 0 && !loading && !emptyText)) return null

  return createPortal(
    <div
      ref={list}
      id={id}
      role="listbox"
      className={styles.list}
      style={{ width: WIDTH, ...placement }}
      // Never take focus from the input.
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.length === 0 ? (
        <div className={styles.empty}>
          {loading ? <Spinner size={18} /> : emptyText}
          {loading && t('common.loading')}
        </div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.key}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === active}
            data-active={index === active}
            className={styles.item}
            onMouseMove={() => {
              if (index !== active) onActiveChange(index)
            }}
            onClick={() => onSelect(index)}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.label}>{item.label}</span>
            {item.detail && <span className={styles.detail}>{item.detail}</span>}
          </div>
        ))
      )}
    </div>,
    document.body
  )
}
