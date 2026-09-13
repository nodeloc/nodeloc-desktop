import MarkdownIt from 'markdown-it'
import type { StateBlock, StateCore, Token } from 'markdown-it'

type Markdown = InstanceType<typeof MarkdownIt>

export interface PreviewLabels {
  video: (name: string) => string
  audio: (name: string) => string
}

/** Block BBCode the preview understands, each alone on its opening and closing line. */
const OPEN_TAG = /^\[(quote|spoiler|reply|login|pay|poll|details)(?:[= ]("[^"]*"|[^\]]*))?\]$/i

/** Inline BBCode inside a line: spoilers and discourse-permission's hidden content. */
const INLINE_TAG = /(\[\/?spoiler\]|\[\/?reply\]|\[\/?login\]|\[pay amount=\d+\]|\[\/pay\])/

const UPLOAD_PREFIX = 'upload://'

function lineText(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trim()
}

function unquote(param: string | undefined): string {
  return (param ?? '').replace(/^"(.*)"$/, '$1').trim()
}

/** Opening HTML shaped like the server's cooked output, so `PostContent` renders the same blocks. */
function openHtml(md: Markdown, tag: string, param: string): string {
  const escape = md.utils.escapeHtml
  switch (tag) {
    case 'quote': {
      // [quote="username, post:3, topic:42"]
      const [username = '', ...rest] = param.split(',').map((part) => part.trim())
      const post = rest.find((part) => part.startsWith('post:'))?.slice(5)
      const topic = rest.find((part) => part.startsWith('topic:'))?.slice(6)
      const data = [
        username && ` data-username="${escape(username)}"`,
        post && ` data-post="${escape(post)}"`,
        topic && ` data-topic="${escape(topic)}"`
      ].join('')
      const title = username ? `<div class="title">${escape(username)}:</div>` : ''
      return `<aside class="quote"${data}>${title}<blockquote>\n`
    }
    case 'spoiler':
      return '<div class="spoiler">\n'
    case 'reply':
    case 'login':
    case 'pay':
      return `<div class="permission-content" data-type="${tag}"><div class="permission-body">\n`
    case 'poll':
      return '<div class="composer-poll">\n'
    default:
      return `<details><summary>${escape(param)}</summary>\n`
  }
}

function closeHtml(tag: string): string {
  switch (tag) {
    case 'quote':
      return '</blockquote></aside>\n'
    case 'spoiler':
    case 'poll':
      return '</div>\n'
    case 'reply':
    case 'login':
    case 'pay':
      return '</div></div>\n'
    default:
      return '</details>\n'
  }
}

/** `[quote]…[/quote]` and friends as container blocks; their content is parsed as Markdown. */
function bbcodeBlocks(md: Markdown): void {
  md.block.ruler.before(
    'fence',
    'bbcode_block',
    (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false
      const open = OPEN_TAG.exec(lineText(state, startLine))
      if (!open) return false
      if (silent) return true

      const tag = open[1].toLowerCase()
      let depth = 1
      let nextLine = startLine + 1
      for (; nextLine < endLine; nextLine++) {
        const text = lineText(state, nextLine).toLowerCase()
        const nested = OPEN_TAG.exec(text)
        if (nested?.[1] === tag) depth++
        else if (text === `[/${tag}]` && --depth === 0) break
      }

      const opening = state.push('html_block', '', 0)
      opening.content = openHtml(md, tag, unquote(open[2]))
      opening.map = [startLine, nextLine]

      const oldLineMax = state.lineMax
      state.lineMax = nextLine
      state.md.block.tokenize(state, startLine + 1, nextLine)
      state.lineMax = oldLineMax

      const closing = state.push('html_block', '', 0)
      closing.content = closeHtml(tag)
      // An unclosed block runs to the end of the text.
      state.line = nextLine < endLine ? nextLine + 1 : nextLine
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )
}

function textToken(state: StateCore, content: string): Token {
  const token = new state.Token('text', '', 0)
  token.content = content
  return token
}

function htmlToken(state: StateCore, content: string): Token {
  const token = new state.Token('html_inline', '', 0)
  token.content = content
  return token
}

/** Inline spoilers and hidden content inside a line. Code spans are separate tokens, so they stay literal. */
function inlineTags(md: Markdown): void {
  md.core.ruler.push('bbcode_inline', (state: StateCore) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      block.children = block.children.flatMap((token) => {
        if (token.type !== 'text' || !INLINE_TAG.test(token.content)) return [token]
        return token.content
          .split(INLINE_TAG)
          .filter(Boolean)
          .map((part) => {
            if (part === '[spoiler]') return htmlToken(state, '<span class="spoiler">')
            const hidden = /^\[(reply|login|pay)[\] ]/.exec(part)
            if (hidden) return htmlToken(state, `<span class="composer-hidden" data-kind="${hidden[1]}">`)
            if (part.startsWith('[/') && INLINE_TAG.test(part)) return htmlToken(state, '</span>')
            return textToken(state, part)
          })
      })
    }
  })
}

/**
 * Discourse upload syntax. `upload://` URLs only resolve on the server, so
 * uploads show as a labelled chip with the file name instead of a broken
 * image; `name|WxH` alt text is reduced to the name.
 */
function uploadReferences(md: Markdown, labels: PreviewLabels): void {
  const escape = md.utils.escapeHtml
  const chip = (kind: string, label: string): string =>
    `<span class="composer-upload" data-kind="${kind}">${escape(label)}</span>`

  md.core.ruler.push('upload_references', (state: StateCore) => {
    for (const block of state.tokens) {
      if (block.type !== 'inline' || !block.children) continue
      let inUploadLink = false
      block.children = block.children.map((token) => {
        if (token.type === 'image') {
          const [name = '', meta = ''] = token.content.split('|')
          const src = String(token.attrGet('src') ?? '')
          const kind = meta.trim().toLowerCase()
          if (kind === 'video') return htmlToken(state, chip('video', labels.video(name)))
          if (kind === 'audio') return htmlToken(state, chip('audio', labels.audio(name)))
          const size = /^(\d+)x(\d+)/.exec(meta.trim())
          if (src.startsWith(UPLOAD_PREFIX)) {
            return htmlToken(state, chip('image', size ? `${name} · ${size[1]}×${size[2]}` : name))
          }
          if (meta) {
            token.children = [textToken(state, name)]
            if (size) {
              token.attrSet('width', size[1])
              token.attrSet('height', size[2])
            }
          }
          return token
        }
        if (token.type === 'link_open' && String(token.attrGet('href') ?? '').startsWith(UPLOAD_PREFIX)) {
          inUploadLink = true
          token.attrs = token.attrs?.filter(([attribute]) => attribute !== 'href') ?? null
          token.attrSet('class', 'composer-upload')
          token.attrSet('data-kind', 'attachment')
          return token
        }
        if (token.type === 'link_close') inUploadLink = false
        if (inUploadLink && token.type === 'text') token.content = token.content.replace(/\|attachment$/i, '')
        return token
      })
    }
  })
}

/**
 * An approximate, client-side Markdown renderer for the composer preview.
 * Raw HTML in the source is not rendered (the server's sanitizer decides
 * that); line breaks follow Discourse's default of breaking on newlines.
 */
export function createPreviewRenderer(labels: PreviewLabels): (raw: string) => string {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true, langPrefix: 'lang-' })
  bbcodeBlocks(md)
  inlineTags(md)
  uploadReferences(md, labels)
  return (raw) => md.render(raw)
}
