/** A textarea's text and selection, as the toolbar helpers read and return it. */
export interface EditState {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type LinePrefix = 'heading' | 'quote' | 'bullet' | 'number'

const LINE_PATTERNS: Record<LinePrefix, RegExp> = {
  heading: /^#{1,6}\s+/,
  quote: /^>\s?/,
  bullet: /^[-*+]\s+/,
  number: /^\d+\.\s+/
}

/** Prefixes a line style replaces instead of stacking on (a bullet becomes a number). */
const REPLACES: Record<LinePrefix, LinePrefix | null> = {
  heading: null,
  quote: null,
  bullet: 'number',
  number: 'bullet'
}

function linePrefix(kind: LinePrefix, index: number): string {
  switch (kind) {
    case 'heading':
      return '## '
    case 'quote':
      return '> '
    case 'bullet':
      return '- '
    case 'number':
      return `${index + 1}. `
  }
}

export function currentEditState(textarea: HTMLTextAreaElement): EditState {
  return { value: textarea.value, selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd }
}

/**
 * Toggles inline markup around the selection (`**bold**`). An empty
 * selection inserts `sample` and selects it so typing replaces it.
 */
export function toggleWrap(state: EditState, before: string, after: string, sample: string): EditState {
  const { value, selectionStart: start, selectionEnd: end } = state
  const selected = value.slice(start, end)

  // Markup selected along with the text: `**bold**` → `bold`.
  if (selected.length > before.length + after.length && selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return { value: value.slice(0, start) + inner + value.slice(end), selectionStart: start, selectionEnd: start + inner.length }
  }

  // Markup just outside the selection: **[bold]** → bold. A single `*` next
  // to another `*` is part of bold, not italic, so leave it alone.
  const outside = value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after
  const partOfLonger = before.length === 1 && (value[start - 2] === before || value[end + 1] === after)
  if (outside && !partOfLonger) {
    return {
      value: value.slice(0, start - before.length) + selected + value.slice(end + after.length),
      selectionStart: start - before.length,
      selectionEnd: end - before.length
    }
  }

  const inner = selected || sample
  return {
    value: value.slice(0, start) + before + inner + after + value.slice(end),
    selectionStart: start + before.length,
    selectionEnd: start + before.length + inner.length
  }
}

/** Expands the selection to whole lines. */
function lineRange(value: string, start: number, end: number): [number, number] {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  // A selection ending right after a newline doesn't include the next line.
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
  const newline = value.indexOf('\n', effectiveEnd)
  return [lineStart, newline === -1 ? value.length : newline]
}

/**
 * Toggles a line prefix (heading, quote, list) on every selected line.
 * Removes it when all non-empty lines already have it.
 */
export function toggleLinePrefix(state: EditState, kind: LinePrefix): EditState {
  const { value, selectionStart, selectionEnd } = state
  const [from, to] = lineRange(value, selectionStart, selectionEnd)
  const lines = value.slice(from, to).split('\n')
  const pattern = LINE_PATTERNS[kind]
  const replaced = REPLACES[kind]
  const filled = lines.filter((line) => line.trim() !== '')
  const remove = filled.length > 0 && filled.every((line) => pattern.test(line))

  let index = 0
  const text = lines
    .map((line) => {
      if (remove) return line.replace(pattern, '')
      if (line.trim() === '' && lines.length > 1) return line
      const bare = (replaced ? line.replace(LINE_PATTERNS[replaced], '') : line).replace(pattern, '')
      return linePrefix(kind, index++) + bare
    })
    .join('\n')

  const next = value.slice(0, from) + text + value.slice(to)
  // A single line with nothing selected: keep typing after the prefix.
  if (lines.length === 1 && selectionStart === selectionEnd) {
    const caret = from + text.length
    return { value: next, selectionStart: caret, selectionEnd: caret }
  }
  return { value: next, selectionStart: from, selectionEnd: from + text.length }
}

/**
 * Wraps the selection in a block on its own lines (``` fences, `[spoiler]`,
 * `[reply]`), adding line breaks only where needed.
 */
export function wrapBlock(state: EditState, open: string, close: string, sample: string): EditState {
  const { value, selectionStart: start, selectionEnd: end } = state
  const inner = value.slice(start, end) || sample
  const before = value.slice(0, start)
  const after = value.slice(end)
  const lead = before === '' || before.endsWith('\n') ? '' : '\n'
  const trail = after === '' || after.startsWith('\n') ? '' : '\n'
  const opening = `${lead}${open}\n`
  const text = `${opening}${inner}\n${close}${trail}`
  const innerStart = start + opening.length
  return { value: before + text + after, selectionStart: innerStart, selectionEnd: innerStart + inner.length }
}

/** BBCode inline around a single-line selection, as a block on its own lines otherwise. */
export function toggleTagged(state: EditState, open: string, close: string, sample: string): EditState {
  const selected = state.value.slice(state.selectionStart, state.selectionEnd)
  return selected.includes('\n') ? wrapBlock(state, open, close, sample) : toggleWrap(state, open, close, sample)
}

export function toggleSpoiler(state: EditState, sample: string): EditState {
  return toggleTagged(state, '[spoiler]', '[/spoiler]', sample)
}

/**
 * `[text](url)`. A selected URL becomes the target with the text selected;
 * otherwise the selection becomes the text and `https://` is selected.
 */
export function insertLink(state: EditState, sample: string): EditState {
  const { value, selectionStart: start, selectionEnd: end } = state
  const selected = value.slice(start, end)
  if (/^https?:\/\/\S+$/.test(selected.trim())) {
    const text = `[${sample}](${selected.trim()})`
    return { value: value.slice(0, start) + text + value.slice(end), selectionStart: start + 1, selectionEnd: start + 1 + sample.length }
  }
  const label = selected || sample
  const url = 'https://'
  const text = `[${label}](${url})`
  const urlStart = start + label.length + 3
  return { value: value.slice(0, start) + text + value.slice(end), selectionStart: urlStart, selectionEnd: urlStart + url.length }
}

/** Inserts `text` on its own line at the selection (upload placeholders), caret after it. */
export function insertOnOwnLine(state: EditState, text: string): EditState {
  const { value, selectionStart: start, selectionEnd: end } = state
  const before = value.slice(0, start)
  const after = value.slice(end)
  const lead = before === '' || before.endsWith('\n') ? '' : '\n'
  const trail = after.startsWith('\n') ? '' : '\n'
  const inserted = `${lead}${text}${trail}`
  const caret = start + inserted.length
  return { value: before + inserted + after, selectionStart: caret, selectionEnd: caret }
}

/** A Discourse quote of another post. */
export function quoteBlock(quote: { username: string; postNumber: number; text: string }, topicId: number): string {
  return `[quote="${quote.username}, post:${quote.postNumber}, topic:${topicId}"]\n${quote.text.trim()}\n[/quote]\n\n`
}

/** Appends a block after existing text, separated by a blank line. */
export function appendBlock(current: string, block: string): string {
  if (current.trim() === '') return block
  const separator = current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n'
  return current + separator + block
}

/**
 * Applies an edit through the browser's editing commands so Ctrl+Z still
 * works. Only the changed span is replaced. Returns false when that isn't
 * possible (textarea hidden, command unavailable); the caller then sets the
 * value itself.
 */
export function applyToTextarea(textarea: HTMLTextAreaElement, next: EditState): boolean {
  const current = textarea.value
  let start = 0
  while (start < current.length && start < next.value.length && current[start] === next.value[start]) start++
  let currentEnd = current.length
  let nextEnd = next.value.length
  while (currentEnd > start && nextEnd > start && current[currentEnd - 1] === next.value[nextEnd - 1]) {
    currentEnd--
    nextEnd--
  }

  textarea.focus()
  // execCommand edits whatever has focus; never let it type into another field.
  if (document.activeElement !== textarea) return false
  if (start !== currentEnd || start !== nextEnd) {
    textarea.setSelectionRange(start, currentEnd)
    const inserted = next.value.slice(start, nextEnd)
    const applied = inserted ? document.execCommand('insertText', false, inserted) : document.execCommand('delete')
    if (!applied || textarea.value !== next.value) return false
  }
  textarea.setSelectionRange(next.selectionStart, next.selectionEnd)
  return true
}

/**
 * Where a selection lands after the text changed underneath it (an upload
 * placeholder replaced elsewhere in the text).
 */
export function shiftSelection(previous: string, next: string, selection: readonly [number, number]): [number, number] {
  let prefix = 0
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++
  const delta = next.length - previous.length
  const move = (position: number): number => (position <= prefix ? position : Math.max(prefix, position + delta))
  return [move(selection[0]), move(selection[1])]
}
