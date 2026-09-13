import type { Category } from '../../api/types'

const parser = new DOMParser()

/**
 * `NodeSummary.description` is cooked HTML (`<p>…</p>`, `<br>`). Parsing it
 * in an inert document never runs scripts, and the text is rendered as a
 * React text node, so nothing is re-interpreted as markup.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  if (!/[<&]/.test(html)) return html.trim()
  const document = parser.parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html')
  return (document.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

export interface NodeRule {
  title: string
  body?: string
}

/** `community_rules` entries are plain strings or `{ title, description | body }`. */
export function normalizeRules(rules: Category['community_rules']): NodeRule[] {
  const result: NodeRule[] = []
  for (const rule of rules ?? []) {
    if (typeof rule === 'string') {
      const title = htmlToText(rule)
      if (title) result.push({ title })
      continue
    }
    if (!rule) continue
    const title = htmlToText(rule.title)
    const body = htmlToText(rule.description ?? rule.body)
    if (title) result.push({ title, body: body || undefined })
    else if (body) result.push({ title: body })
  }
  return result
}
