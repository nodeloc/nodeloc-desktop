import { Check, ChevronsUpDown, LockKeyhole, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useCategoryIndex, type CategoryIndex } from '../../api/site'
import type { Category, NodeListResponse } from '../../api/types'
import { NodeIcon } from '../../components/NodeIcon'
import { Spinner } from '../../components/Spinner'
import { cx } from '../../lib/cx'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { useComposerOverlay } from './composer-overlay'
import styles from './NodePicker.module.css'

interface NodeGroup {
  key: string
  label: string
  nodes: Category[]
}

interface PopoverBox {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

interface NodePickerProps {
  id?: string
  value?: number
  onChange: (categoryId: number) => void
  /** Lets a surrounding dialog ignore Esc while the list is open. */
  onOpenChange?: (open: boolean) => void
  invalid?: boolean
}

const POPOVER_MIN_WIDTH = 400
const POPOVER_MAX_HEIGHT = 420
const EDGE_GAP = 16

/**
 * Nodes are subcategories; sections only group them. Discourse's
 * `permission` of 1 means the user may create topics; when it's missing,
 * let the server decide.
 */
function isPostable(category: Category): boolean {
  return Boolean(category.parent_category_id) && (category.permission == null || category.permission === 1)
}

/** Recent posting nodes, then joined nodes, then the rest by section. Each node appears once. */
function buildGroups(
  index: CategoryIndex,
  recentIds: readonly number[],
  joinedIds: readonly number[],
  query: string,
  labels: { recent: string; joined: string }
): NodeGroup[] {
  const needle = query.trim().toLowerCase()
  const used = new Set<number>()
  const accept = (category: Category): boolean => {
    if (used.has(category.id) || !isPostable(category)) return false
    if (needle && !category.name.toLowerCase().includes(needle) && !category.slug.toLowerCase().includes(needle)) return false
    used.add(category.id)
    return true
  }
  const pick = (ids: readonly number[]): Category[] =>
    ids.flatMap((id) => {
      const category = index.byId.get(id)
      return category && accept(category) ? [category] : []
    })

  const groups: NodeGroup[] = [
    { key: 'recent', label: labels.recent, nodes: pick(recentIds) },
    { key: 'joined', label: labels.joined, nodes: pick(joinedIds) }
  ]
  for (const section of index.sections) {
    const nodes = index.list
      .filter((category) => category.parent_category_id === section.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .filter(accept)
    groups.push({ key: `section-${section.id}`, label: section.name, nodes })
  }
  return groups.filter((group) => group.nodes.length > 0)
}

/** Searchable node dropdown for new topics. The list is portalled so a dialog's scroll area can't clip it. */
export function NodePicker({ id, value, onChange, onOpenChange, invalid = false }: NodePickerProps): React.JSX.Element {
  const { t } = useTranslation()
  const index = useCategoryIndex()
  const signedIn = useIsSignedIn()
  const recentIds = useCurrentUser()?.recent_post_category_ids
  const joined = useQuery({
    queryKey: ['nodes', 'joined'],
    queryFn: () => apiRequest<NodeListResponse>({ path: '/node/joined.json' }),
    enabled: signedIn,
    staleTime: 5 * 60_000
  })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [box, setBox] = useState<PopoverBox | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const listId = useId()
  useComposerOverlay(open)

  const selected = value ? index?.byId.get(value) : undefined
  const sectionOf = (category: Category): string | undefined =>
    category.parent_category_id ? index?.byId.get(category.parent_category_id)?.name : undefined

  const groups = useMemo(
    () =>
      index
        ? buildGroups(index, recentIds ?? [], joined.data?.communities.map((node) => node.id) ?? [], query, {
            recent: t('composer.nodePicker.recent'),
            joined: t('composer.nodePicker.joined')
          })
        : [],
    [index, recentIds, joined.data, query, t]
  )
  const options = useMemo(() => groups.flatMap((group) => group.nodes), [groups])
  const positions = useMemo(() => new Map(options.map((node, position) => [node.id, position])), [options])

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const openList = (): void => {
    setActive(Math.max(0, options.findIndex((node) => node.id === value)))
    setOpenState(true)
  }

  const closeList = useCallback(
    (restoreFocus: boolean) => {
      setOpenState(false)
      setQuery('')
      if (restoreFocus) trigger.current?.focus()
    },
    [setOpenState]
  )

  const choose = (categoryId: number): void => {
    onChange(categoryId)
    closeList(true)
  }

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom - EDGE_GAP
    const above = rect.top - EDGE_GAP
    const upward = below < 240 && above > below
    const width = Math.max(rect.width, POPOVER_MIN_WIDTH)
    setBox({
      left: Math.max(EDGE_GAP, Math.min(rect.left, window.innerWidth - width - EDGE_GAP)),
      width,
      maxHeight: Math.min(POPOVER_MAX_HEIGHT, upward ? above : below),
      ...(upward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !popover.current?.contains(target)) closeList(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, closeList])

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActive((current) => Math.min(options.length - 1, current + 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((current) => Math.max(0, current - 1))
        break
      case 'Enter':
        event.preventDefault()
        if (options[active]) choose(options[active].id)
        break
      case 'Escape':
        event.preventDefault()
        closeList(true)
        break
      case 'Tab':
        closeList(false)
        break
    }
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        className={cx(styles.trigger, invalid && styles.invalid)}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(event) => {
          if (!open && event.key === 'ArrowDown') {
            event.preventDefault()
            openList()
          }
        }}
      >
        {selected ? (
          <>
            <NodeIcon
              name={selected.name}
              color={selected.color}
              logo={selected.uploaded_logo}
              logoDark={selected.uploaded_logo_dark}
              size={22}
            />
            <span className={styles.triggerLabel}>
              {selected.name}
              {sectionOf(selected) && <span className={styles.section}>{sectionOf(selected)}</span>}
            </span>
          </>
        ) : (
          <span className={cx(styles.triggerLabel, styles.placeholder)}>{t('composer.nodePicker.placeholder')}</span>
        )}
        <ChevronsUpDown className={styles.caret} />
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={popover}
            className={styles.popover}
            style={{ left: box.left, width: box.width, maxHeight: box.maxHeight, top: box.top, bottom: box.bottom }}
          >
            <div className={styles.search}>
              <Search />
              <input
                autoFocus
                value={query}
                placeholder={t('composer.nodePicker.search')}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={options[active] ? `${listId}-${options[active].id}` : undefined}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <div ref={list} id={listId} className={styles.list} role="listbox">
              {!index ? (
                <div className={styles.empty}>
                  <Spinner size={20} />
                  {t('composer.nodePicker.loading')}
                </div>
              ) : groups.length === 0 ? (
                <div className={styles.empty}>{t('composer.nodePicker.empty')}</div>
              ) : (
                groups.map((group) => (
                  <div key={group.key} role="group" aria-label={group.label}>
                    <div className={styles.groupLabel}>{group.label}</div>
                    {group.nodes.map((node) => {
                      const position = positions.get(node.id) ?? -1
                      return (
                        <button
                          key={node.id}
                          id={`${listId}-${node.id}`}
                          type="button"
                          role="option"
                          tabIndex={-1}
                          aria-selected={node.id === value}
                          data-active={position === active}
                          className={styles.option}
                          onMouseMove={() => {
                            if (position !== active) setActive(position)
                          }}
                          onClick={() => choose(node.id)}
                        >
                          <NodeIcon
                            name={node.name}
                            color={node.color}
                            logo={node.uploaded_logo}
                            logoDark={node.uploaded_logo_dark}
                            size={32}
                          />
                          <span className={styles.optionText}>
                            <span className={styles.optionTop}>
                              <span className={styles.optionName}>{node.name}</span>
                              <span className={styles.optionSlug}>n/{node.slug}</span>
                            </span>
                            {node.description_text && <span className={styles.optionDescription}>{node.description_text}</span>}
                          </span>
                          {node.read_restricted && <LockKeyhole className={styles.restricted} />}
                          {node.id === value && <Check strokeWidth={2.5} className={styles.check} />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
