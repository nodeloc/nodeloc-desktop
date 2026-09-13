import katex from 'katex'
import 'katex/dist/katex.min.css'
import { createElement, useMemo } from 'react'

/**
 * discourse-math leaves raw TeX in `.math` elements. KaTeX turns the text
 * into its own markup; with `trust: false` it never emits links or HTML
 * from the source, so its output is safe to inject.
 */
export function MathBlock({ tex, display = false }: { tex: string; display?: boolean }): React.JSX.Element {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' })
    } catch {
      return null
    }
  }, [tex, display])

  if (!html) return <code>{tex}</code>
  return createElement(display ? 'div' : 'span', {
    className: display ? 'math-block' : 'math-inline',
    dangerouslySetInnerHTML: { __html: html }
  })
}
