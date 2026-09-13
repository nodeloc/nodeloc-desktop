export type TriggerKind = 'mention' | 'emoji' | 'hashtag'

/** An autocomplete trigger before the caret: `@name`, `:emoji`, `#node`. */
export interface Trigger {
  kind: TriggerKind
  /** Index of the sigil (`@`, `:`, `#`); a suggestion replaces from here to the caret. */
  start: number
  query: string
}

const MENTION = /(?:^|[\s(（【「，,、])@([\p{L}\p{N}_.-]{0,40})$/u
/** Two characters at least, so times (`12:30`) and ordinary colons stay quiet. */
const EMOJI = /(?:^|\s):([\w+-]{2,40})$/
const HASHTAG = /(?:^|\s)#([\p{L}\p{N}_:-]{0,50})$/u

/** Inside a fenced block (odd number of fences above) or an open inline code span. */
function insideCode(textBeforeLine: string, line: string): boolean {
  const fences = textBeforeLine.split('\n').filter((text) => /^\s{0,3}(```|~~~)/.test(text)).length
  if (fences % 2 === 1) return true
  return (line.match(/`/g)?.length ?? 0) % 2 === 1
}

export function detectTrigger(value: string, caret: number): Trigger | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1
  const line = value.slice(lineStart, caret)
  if (insideCode(value.slice(0, lineStart), line)) return null

  const match = (pattern: RegExp, kind: TriggerKind): Trigger | null => {
    const found = pattern.exec(line)
    return found ? { kind, query: found[1], start: caret - found[1].length - 1 } : null
  }

  const hashtag = match(HASHTAG, 'hashtag')
  // A bare `#` at the start of a line is a heading being typed.
  const usableHashtag = hashtag && !(hashtag.start === lineStart && hashtag.query === '') ? hashtag : null
  return match(MENTION, 'mention') ?? match(EMOJI, 'emoji') ?? usableHashtag
}
