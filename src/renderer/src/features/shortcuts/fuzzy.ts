const isBoundary = (char: string | undefined): boolean => char === undefined || /[\s\-_/.·|:：（(]/.test(char)

/**
 * Scores `text` against `query`; higher is better, null means no match.
 * A contiguous match beats a scattered one, and matches at the start of the
 * text or of a word score extra. Works on CJK text as-is (no word splitting).
 */
export function fuzzyScore(query: string, text: string): number | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  const haystack = text.toLowerCase()

  const index = haystack.indexOf(needle)
  if (index !== -1) {
    let score = 1000 - index * 2 - (haystack.length - needle.length) * 0.5
    if (index === 0) score += 500
    else if (isBoundary(haystack[index - 1])) score += 250
    return score
  }

  // Subsequence: every character in order, gaps allowed.
  let score = 0
  let position = 0
  let streak = 0
  let first = -1
  for (const char of needle) {
    if (/\s/.test(char)) continue
    const found = haystack.indexOf(char, position)
    if (found === -1) return null
    if (first === -1) first = found
    streak = found === position ? streak + 1 : 0
    score += 10 + streak * 8 + (isBoundary(haystack[found - 1]) ? 15 : 0)
    position = found + char.length
  }
  return score - first - (haystack.length - needle.length) * 0.2
}

/** The best score of any of the candidate texts. */
export function bestScore(query: string, texts: ReadonlyArray<string | null | undefined>): number | null {
  let best: number | null = null
  for (const text of texts) {
    if (!text) continue
    const score = fuzzyScore(query, text)
    if (score !== null && (best === null || score > best)) best = score
  }
  return best
}
