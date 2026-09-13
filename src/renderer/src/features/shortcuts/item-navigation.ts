/**
 * J/K movement between topic rows (`data-topic-id`) and reader posts
 * (`data-post-number`). Both lists are virtualized, so this works on the rows
 * that are rendered and nudges the scroller when it runs off the end.
 */

const ITEM_SELECTOR = '[data-topic-id], [data-post-number]'
const SCROLLER_SELECTOR = '[data-virtuoso-scroller]'
export const CURRENT_ATTRIBUTE = 'data-shortcut-current'

let current: HTMLElement | null = null

function itemsIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (element) => !element.parentElement?.closest(ITEM_SELECTOR)
  )
}

function viewportOf(element: HTMLElement): { top: number; bottom: number } {
  const scroller = element.closest<HTMLElement>(SCROLLER_SELECTOR)
  if (!scroller) return { top: 0, bottom: window.innerHeight }
  const rect = scroller.getBoundingClientRect()
  return { top: rect.top, bottom: rect.bottom }
}

function setCurrent(element: HTMLElement | null): void {
  if (current && current !== element) current.removeAttribute(CURRENT_ATTRIBUTE)
  current = element
  element?.setAttribute(CURRENT_ATTRIBUTE, 'true')
}

function select(element: HTMLElement): void {
  setCurrent(element)
  // Posts aren't focusable on their own; -1 keeps them out of the Tab order.
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1')
  element.focus({ preventScroll: true })

  const view = viewportOf(element)
  const rect = element.getBoundingClientRect()
  const fullyVisible = rect.top >= view.top && rect.bottom <= view.bottom
  if (!fullyVisible) {
    // Tall posts align to their start so reading begins at the top.
    element.scrollIntoView({ block: rect.height > view.bottom - view.top ? 'start' : 'nearest' })
  }
}

/** The selected row: the one holding focus, else the last one selected if still rendered. */
function currentIndex(items: HTMLElement[]): number {
  const active = document.activeElement
  if (active && active !== document.body) {
    const index = items.findIndex((element) => element === active || element.contains(active))
    if (index !== -1) return index
  }
  return current?.isConnected ? items.indexOf(current) : -1
}

/** Moves the selection by one row. Returns false when there is nothing to move through. */
export function moveSelection(delta: 1 | -1, root: ParentNode | null = document.querySelector('main')): boolean {
  if (!root) return false
  const items = itemsIn(root)
  if (items.length === 0) return false

  const index = currentIndex(items)
  if (index === -1) {
    // Nothing selected yet: start from the first row in view.
    const view = viewportOf(items[0])
    const inView = items.find((element) => element.getBoundingClientRect().bottom > view.top + 24)
    select(inView ?? items[0])
    return true
  }

  const target = items[index + delta]
  if (target) {
    select(target)
    return true
  }

  // Past the rendered rows: scroll so the virtual list renders more, then retry once.
  const scroller = items[index].closest<HTMLElement>(SCROLLER_SELECTOR)
  if (!scroller) return true
  scroller.scrollBy({ top: delta * scroller.clientHeight * 0.6 })
  const anchor = items[index]
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const next = itemsIn(root)
      const from = next.indexOf(anchor)
      const candidate = from === -1 ? undefined : next[from + delta]
      if (candidate) select(candidate)
    })
  )
  return true
}

/** The post number of the selected reader post, if a post (not a topic row) is selected. */
export function selectedPostNumber(): number | undefined {
  if (!current?.isConnected) return undefined
  const value = Number(current.getAttribute('data-post-number'))
  return Number.isInteger(value) && value > 0 ? value : undefined
}

export function clearSelection(): void {
  setCurrent(null)
}
