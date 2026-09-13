const parser = new DOMParser()

/**
 * Discourse excerpts arrive HTML-escaped (`&hellip;`, `&amp;`). Decoding
 * through an inert document never runs scripts, and the result is rendered
 * as a React text node, so nothing here is re-interpreted as markup.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text
  return parser.parseFromString(text, 'text/html').documentElement.textContent ?? text
}
