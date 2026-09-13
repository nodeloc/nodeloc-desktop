/** Computed styles that decide where text wraps inside a textarea. */
const MIRRORED = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize'
] as const

export interface CaretBox {
  left: number
  top: number
  height: number
}

/**
 * Viewport coordinates of a text position in a textarea, measured with a
 * hidden mirror element that wraps text the same way.
 */
export function caretBox(textarea: HTMLTextAreaElement, position: number): CaretBox {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  for (const property of MIRRORED) mirror.style[property] = style[property]
  mirror.style.position = 'fixed'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.textContent = textarea.value.slice(0, position)

  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(position, position + 1) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const box = textarea.getBoundingClientRect()
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5
  const result = {
    left: box.left + marker.offsetLeft - textarea.scrollLeft,
    top: box.top + marker.offsetTop - textarea.scrollTop,
    height: lineHeight
  }
  mirror.remove()
  return result
}
