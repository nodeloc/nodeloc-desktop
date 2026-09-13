import { X } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import styles from './ChipInput.module.css'
import { useComposerOverlay } from './composer-overlay'
import { SuggestionList, type Suggestion } from './SuggestionList'

export interface ChipOption extends Suggestion {
  value: string
}

interface ChipInputProps {
  id?: string
  values: string[]
  onChange: (values: string[]) => void
  query: string
  onQueryChange: (query: string) => void
  /** Suggestions for the query; already chosen values are left out automatically. */
  options: ChipOption[]
  loading?: boolean
  placeholder?: string
  max?: number
  /** Turns typed text into a value on Enter or comma; leave out to allow only suggestions. */
  normalizeCustom?: (text: string) => string | null
  invalid?: boolean
  removeLabel: (value: string) => string
}

/** A list of values as removable chips with a search field and suggestions (tags, recipients). */
export function ChipInput({
  id,
  values,
  onChange,
  query,
  onQueryChange,
  options,
  loading = false,
  placeholder,
  max,
  normalizeCustom,
  invalid = false,
  removeLabel
}: ChipInputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [active, setActive] = useState(0)
  const [anchor, setAnchor] = useState<{ left: number; top: number; height: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const full = max !== undefined && values.length >= max
  const available = options.filter((option) => !values.includes(option.value))
  const open = focused && !dismissed && !full && query.trim() !== '' && (available.length > 0 || loading)
  const current = Math.min(active, Math.max(0, available.length - 1))
  useComposerOverlay(open)

  useLayoutEffect(() => {
    if (!open) return
    const rect = box.current?.getBoundingClientRect()
    if (rect) setAnchor({ left: rect.left, top: rect.top, height: rect.height })
  }, [open, values.length])

  const add = (value: string): void => {
    if (!full && !values.includes(value)) onChange([...values, value])
    onQueryChange('')
    setActive(0)
  }

  const addTyped = (): boolean => {
    const text = query.trim()
    const value = text && normalizeCustom ? normalizeCustom(text) : null
    if (!value) return false
    add(value)
    return true
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!open || available.length === 0) break
        event.preventDefault()
        setActive((current + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length)
        break
      case 'Enter':
        if (open && available[current]) {
          event.preventDefault()
          add(available[current].value)
        } else if (addTyped()) {
          event.preventDefault()
        }
        break
      case ',':
      case '，':
        if (addTyped()) event.preventDefault()
        break
      case 'Backspace':
        if (query === '' && values.length > 0) onChange(values.slice(0, -1))
        break
      case 'Escape':
        if (open) {
          event.preventDefault()
          setDismissed(true)
        }
        break
    }
  }

  return (
    <div
      ref={box}
      className={cx(styles.box, focused && styles.focused, invalid && styles.invalid)}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        input.current?.focus()
      }}
    >
      {values.map((value) => (
        <span key={value} className={styles.chip}>
          <span className={styles.chipLabel}>{value}</span>
          <button
            type="button"
            className={styles.remove}
            aria-label={removeLabel(value)}
            title={removeLabel(value)}
            onClick={() => onChange(values.filter((other) => other !== value))}
          >
            <X />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        className={styles.input}
        value={query}
        placeholder={values.length === 0 ? placeholder : undefined}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && available.length > 0 ? `${listId}-${current}` : undefined}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setDismissed(false)
          setActive(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
      />
      {open && anchor && (
        <SuggestionList
          id={listId}
          items={available}
          active={current}
          anchor={anchor}
          loading={loading}
          onSelect={(index) => add(available[index].value)}
          onActiveChange={setActive}
        />
      )}
    </div>
  )
}
