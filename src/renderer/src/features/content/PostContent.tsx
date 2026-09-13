import { useMemo, useRef } from 'react'
import type { Post } from '../../api/types'
import { cx } from '../../lib/cx'
import { useLinkInterception } from '../../lib/open-link'
import styles from './PostContent.module.css'
import { renderChildren, type RenderContext } from './render-dom'
import { sanitizeCooked } from './sanitize'

interface PostContentProps {
  /** Server-rendered ("cooked") HTML. */
  html: string
  post?: Post
  /** `body` for the opening post, `reply` for the smaller reply text. */
  size?: 'body' | 'reply'
  className?: string
}

/**
 * Renders cooked post HTML as React: sanitized, depth-limited, with
 * interactive pieces (images, code, spoilers, polls, video) swapped for
 * components and every link routed through the app.
 */
export function PostContent({ html, post, size = 'body', className }: PostContentProps): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null)
  useLinkInterception(container)

  const content = useMemo(() => {
    const context: RenderContext = { post, images: [] }
    return renderChildren(sanitizeCooked(html), context, 'c')
  }, [html, post])

  return (
    <div ref={container} className={cx(styles.content, styles[size], className)}>
      {content}
    </div>
  )
}
