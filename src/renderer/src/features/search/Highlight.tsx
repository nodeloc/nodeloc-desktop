import { useMemo } from 'react'
import styles from './SearchPage.module.css'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Wraps each search term in `<mark>` (SEARCH-05). Works on plain text only:
 * the caller decodes entities first, and nothing is parsed as markup.
 */
export function Highlight({ text, terms }: { text: string; terms: readonly string[] }): React.JSX.Element {
  const parts = useMemo(() => {
    const words = terms.filter(Boolean)
    if (words.length === 0) return [text]
    // Longest first, so "vps" inside "vpsdime" highlights the longer term when both are searched.
    const pattern = new RegExp(`(${[...words].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`, 'gi')
    return text.split(pattern)
  }, [text, terms])

  // With one capture group, `split` puts the matches at odd indexes.
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className={styles.mark}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}
