import { createElement, type ReactNode } from 'react'
import { parseMediaEmbed } from '@shared/media-embed'
import type { Post } from '../../api/types'
import { absoluteUrl } from '../../lib/discourse'
import type { LightboxImage } from '../media/lightbox-store'
import { CodeBlock } from './blocks/CodeBlock'
import { ContentImage } from './blocks/ContentImage'
import { EmbeddedMedia } from './blocks/EmbeddedMedia'
import { HiddenPlaceholder, UnlockedContent } from './blocks/HiddenContent'
import { LazyVideoLink } from './blocks/LazyVideoLink'
import { LocalDate } from './blocks/LocalDate'
import { MathBlock } from './blocks/MathBlock'
import { MiniAppLauncher } from './blocks/MiniAppLauncher'
import { PollBlock } from './blocks/PollBlock'
import { QuoteBlock } from './blocks/QuoteBlock'
import { Spoiler } from './blocks/Spoiler'
import { VideoBlock } from './blocks/VideoBlock'

export interface RenderContext {
  /** The post being rendered, for data that lives outside the HTML (polls). */
  post?: Post
  /** Images in document order, so the lightbox can page through the whole post. */
  images: LightboxImage[]
  /** Inside a link preview: images are decoration, not lightbox content. */
  inOnebox?: boolean
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'source', 'track', 'wbr', 'col'])

/** Whitespace text directly inside these is invalid DOM nesting for React. */
const TABLE_PARENTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup'])

const RENAMED_ATTRIBUTES: Record<string, string> = {
  class: 'className',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  srcset: 'srcSet',
  datetime: 'dateTime'
}

const PASSED_ATTRIBUTES = new Set([
  'href',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'lang',
  'dir',
  'start',
  'type',
  'cite',
  'loading',
  'align',
  'valign',
  'controls',
  'poster',
  'preload'
])

const BOOLEAN_ATTRIBUTES = new Set(['open', 'reversed', 'controls'])

export function renderChildren(node: Node, context: RenderContext, keyPrefix: string): ReactNode[] {
  const parentTag = node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName.toLowerCase() : ''
  const result: ReactNode[] = []
  node.childNodes.forEach((child, index) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? ''
      if (TABLE_PARENTS.has(parentTag) && text.trim() === '') return
      result.push(text)
      return
    }
    if (child.nodeType === Node.ELEMENT_NODE) {
      const rendered = renderElement(child as Element, context, `${keyPrefix}.${index}`)
      if (rendered !== null && rendered !== undefined) result.push(rendered)
    }
  })
  return result
}

function toProps(element: Element, key: string): Record<string, unknown> {
  const props: Record<string, unknown> = { key }
  for (const { name, value } of Array.from(element.attributes)) {
    if (name.startsWith('data-') || name.startsWith('aria-')) {
      props[name] = value
    } else if (RENAMED_ATTRIBUTES[name]) {
      props[RENAMED_ATTRIBUTES[name]] = value
    } else if (BOOLEAN_ATTRIBUTES.has(name)) {
      props[name] = true
    } else if (PASSED_ATTRIBUTES.has(name)) {
      props[name] = name === 'src' || name === 'href' || name === 'poster' ? absoluteUrl(value) : value
    }
  }
  if (element.tagName === 'A') props.rel = 'noreferrer noopener'
  return props
}

function generic(element: Element, context: RenderContext, key: string, childContext = context): ReactNode {
  const tag = element.tagName.toLowerCase()
  const props = toProps(element, key)
  if (VOID_TAGS.has(tag)) return createElement(tag, props)
  return createElement(tag, props, ...renderChildren(element, childContext, key))
}

function numberAttribute(element: Element, name: string): number | undefined {
  const value = Number(element.getAttribute(name))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function image(img: Element, fullSize: string | null, context: RenderContext, key: string): ReactNode {
  const src = img.getAttribute('src')
  if (!src) return null
  const entry: LightboxImage = {
    src: absoluteUrl(fullSize ?? src),
    thumb: absoluteUrl(src),
    alt: img.getAttribute('alt') ?? undefined,
    width: numberAttribute(img, 'width'),
    height: numberAttribute(img, 'height')
  }
  const index = context.images.push(entry) - 1
  return (
    <ContentImage
      key={key}
      image={entry}
      srcSet={img.getAttribute('srcset') ?? undefined}
      images={context.images}
      index={index}
    />
  )
}

function renderElement(element: Element, context: RenderContext, key: string): ReactNode {
  const tag = element.tagName.toLowerCase()
  const classes = element.classList

  switch (tag) {
    case 'iframe': {
      const media = parseMediaEmbed(element.getAttribute('src'))
      return media ? <EmbeddedMedia key={key} media={media} title={element.getAttribute('title') ?? undefined} /> : null
    }

    case 'p': {
      // Standalone video links can arrive before Discourse has generated a onebox.
      const children = Array.from(element.childNodes).filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
      const anchor = children.length === 1 && children[0] instanceof Element && children[0].tagName === 'A' ? children[0] : null
      const media = !context.inOnebox && anchor ? parseMediaEmbed(anchor.getAttribute('href')) : null
      return media ? <EmbeddedMedia key={key} media={media} /> : generic(element, context, key)
    }

    case 'blockquote': {
      if (classes.contains('twitter-tweet') || classes.contains('twitter-video')) {
        // The last status link belongs to the embedded post, after any quoted links.
        const media = Array.from(element.querySelectorAll('a[href]')).reverse()
          .map((anchor) => parseMediaEmbed(anchor.getAttribute('href'))).find((entry) => entry?.provider === 'x')
        if (media) return <EmbeddedMedia key={key} media={media} />
      }
      return generic(element, context, key)
    }

    case 'div': {
      if (classes.contains('discourse-app-embed')) {
        const installId = numberAttribute(element, 'data-app-install')
        return installId ? <MiniAppLauncher key={key} installId={installId} post={context.post} /> : null
      }
      if (classes.contains('lightbox-wrapper')) {
        const anchor = element.querySelector('a.lightbox')
        const img = element.querySelector('img')
        return img ? image(img, anchor?.getAttribute('href') ?? null, context, key) : null
      }
      if (classes.contains('video-placeholder-container')) {
        const src = element.getAttribute('data-video-src')
        return src ? (
          <VideoBlock key={key} src={absoluteUrl(src)} poster={element.getAttribute('data-thumbnail-src') ?? undefined} />
        ) : null
      }
      if (classes.contains('lazy-video-container') || classes.contains('lazyYT')) {
        return <LazyVideoLink key={key} element={element} />
      }
      if (classes.contains('poll')) {
        return (
          <PollBlock key={key} name={element.getAttribute('data-poll-name') ?? 'poll'} post={context.post} />
        )
      }
      if (classes.contains('math')) {
        return <MathBlock key={key} tex={element.textContent ?? ''} display />
      }
      if (classes.contains('spoiler')) {
        return (
          <Spoiler key={key} block>
            {renderChildren(element, context, key)}
          </Spoiler>
        )
      }
      if (classes.contains('permission-content')) {
        const body = element.querySelector(':scope > .permission-body')
        return (
          <UnlockedContent key={key} type={element.getAttribute('data-type') ?? undefined}>
            {renderChildren(body ?? element, context, key)}
          </UnlockedContent>
        )
      }
      if (classes.contains('read-permission-notice')) {
        return <HiddenPlaceholder key={key} kind="trust" text={element.textContent?.trim()} />
      }
      return generic(element, context, key)
    }

    case 'span': {
      if (classes.contains('spoiler') || classes.contains('spoiled')) {
        return <Spoiler key={key}>{renderChildren(element, context, key)}</Spoiler>
      }
      if (classes.contains('math')) {
        return <MathBlock key={key} tex={element.textContent ?? ''} />
      }
      if (classes.contains('permission-reply-placeholder')) return <HiddenPlaceholder key={key} kind="reply" />
      if (classes.contains('permission-login-placeholder')) return <HiddenPlaceholder key={key} kind="login" />
      if (classes.contains('permission-pay-placeholder')) {
        return (
          <HiddenPlaceholder
            key={key}
            kind="pay"
            amount={numberAttribute(element, 'data-amount')}
            contentId={element.getAttribute('data-content-id') ?? undefined}
            post={context.post}
          />
        )
      }
      if (classes.contains('permission-pay-closed')) return <HiddenPlaceholder key={key} kind="payClosed" />
      if (classes.contains('discourse-local-date') || classes.contains('relative-date')) {
        return <LocalDate key={key} element={element} />
      }
      if (classes.contains('hashtag-icon-placeholder')) return null
      return generic(element, context, key)
    }

    case 'pre': {
      const code = element.querySelector(':scope > code')
      if (!code) return generic(element, context, key)
      const language = Array.from(code.classList)
        .find((name) => name.startsWith('lang-'))
        ?.slice('lang-'.length)
      return <CodeBlock key={key} code={code.textContent ?? ''} language={language} />
    }

    case 'img': {
      if (classes.contains('emoji')) {
        return (
          <img
            key={key}
            className={classes.contains('only-emoji') ? 'emoji only-emoji' : 'emoji'}
            src={absoluteUrl(element.getAttribute('src') ?? '')}
            alt={element.getAttribute('alt') ?? ''}
            title={element.getAttribute('title') ?? undefined}
            loading="lazy"
            draggable={false}
          />
        )
      }
      if (classes.contains('avatar') || context.inOnebox) return generic(element, context, key)
      return image(element, null, context, key)
    }

    case 'a': {
      if (classes.contains('anchor')) return null
      if (classes.contains('onebox') && !context.inOnebox) {
        const media = parseMediaEmbed(element.getAttribute('href'))
        if (media) return <EmbeddedMedia key={key} media={media} />
      }
      if (classes.contains('lightbox')) {
        const img = element.querySelector('img')
        return img ? image(img, element.getAttribute('href'), context, key) : generic(element, context, key)
      }
      return generic(element, context, key)
    }

    case 'aside': {
      if (classes.contains('quote')) {
        const blockquote = element.querySelector(':scope > blockquote')
        const avatar = element.querySelector(':scope > .title img')
        const titleText = element.querySelector(':scope > .title')?.textContent?.replace(/:\s*$/, '').trim()
        return (
          <QuoteBlock
            key={key}
            username={element.getAttribute('data-username') ?? undefined}
            displayName={element.getAttribute('data-display-name') ?? titleText}
            avatarSrc={avatar?.getAttribute('src') ?? undefined}
            topicId={numberAttribute(element, 'data-topic')}
            postNumber={numberAttribute(element, 'data-post')}
          >
            {blockquote ? renderChildren(blockquote, context, key) : null}
          </QuoteBlock>
        )
      }
      if (classes.contains('onebox')) {
        const media = parseMediaEmbed(element.getAttribute('data-onebox-src'))
          ?? parseMediaEmbed(element.querySelector('header.source a[href], h3 a[href], h4 a[href]')?.getAttribute('href'))
        if (media) return <EmbeddedMedia key={key} media={media} />
        return generic(element, context, key, { ...context, inOnebox: true })
      }
      return generic(element, context, key)
    }

    case 'video': {
      const src = element.getAttribute('src') ?? element.querySelector('source')?.getAttribute('src')
      return src ? <VideoBlock key={key} src={absoluteUrl(src)} poster={element.getAttribute('poster') ?? undefined} /> : null
    }

    case 'table':
      return (
        <div key={key} className="table-scroll">
          {generic(element, context, `${key}.t`)}
        </div>
      )

    default:
      return generic(element, context, key)
  }
}
