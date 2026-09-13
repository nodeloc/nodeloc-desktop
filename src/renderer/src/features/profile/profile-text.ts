const parser = new DOMParser()

/**
 * Flattens cooked HTML (bio excerpts, action excerpts, badge descriptions)
 * to plain text for a React text node. Parsing happens in an inert document,
 * so nothing loads or runs. Images and lightbox captions ("image 1920×1080
 * 120 KB") are dropped first. `textContent` already decodes entities once,
 * so decoding again would turn a literal `&lt;` into `<`.
 */
export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return html.replace(/\s+/g, ' ').trim()
  const document = parser.parseFromString(html, 'text/html')
  document.querySelectorAll('img, .lightbox .meta, script, style').forEach((node) => node.remove())
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Discourse colours arrive as bare hex ("d4a708", "000"); anything else is ignored. */
export function hexColor(value: string | null | undefined): string | undefined {
  return value && /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? `#${value}` : undefined
}

/** `flair_url` and badge images are either a path/URL or a Font Awesome icon name like "gem". */
export function isImageUrl(value: string | null | undefined): value is string {
  return Boolean(value && (value.startsWith('/') || /^https?:\/\//i.test(value)))
}

/** Profile websites are sometimes saved without a scheme; never resolve them against the forum. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}
