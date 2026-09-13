import DOMPurify from 'dompurify'
import { parseMediaEmbed } from '@shared/media-embed'

/**
 * Nesting limit for rendered post HTML. Real posts stay under ~15 levels;
 * pathological nesting (hundreds deep) would blow the stack in the
 * recursive renderer, so deeper subtrees degrade to their plain text.
 */
const MAX_DEPTH = 40

const FORBID_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'noscript',
  'template',
  'svg',
  'math',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option'
]

// Inline styles are dropped too: a post must not be able to overlay the app's UI.
const FORBID_ATTR = ['style', 'srcdoc', 'formaction', 'action', 'target', 'ping', 'id']

/** Cleans server-rendered ("cooked") HTML into an inert fragment ready for rendering. */
export function sanitizeCooked(html: string): DocumentFragment {
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    ADD_TAGS: ['iframe'],
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOW_DATA_ATTR: true
  })
  // Keep only normalized provider frames. No post-authored frame attributes survive.
  for (const frame of fragment.querySelectorAll('iframe')) {
    const media = parseMediaEmbed(frame.getAttribute('src'))
    if (!media) {
      frame.remove()
      continue
    }
    const title = frame.getAttribute('title')
    for (const attribute of Array.from(frame.attributes)) frame.removeAttribute(attribute.name)
    frame.setAttribute('src', media.src)
    if (title) frame.setAttribute('title', title)
  }
  flattenBeyondDepth(fragment, 0)
  return fragment
}

function flattenBeyondDepth(node: Node, depth: number): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    if (depth >= MAX_DEPTH) {
      child.replaceWith(document.createTextNode(child.textContent ?? ''))
    } else {
      flattenBeyondDepth(child, depth + 1)
    }
  }
}
