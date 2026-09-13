import { History, Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Button, IconButton } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { cx } from '../../lib/cx'
import { SEARCH_SCOPES, type SearchScope } from '../../lib/routes'
import { AdvancedFilters } from './AdvancedFilters'
import { useSearchHistory } from './search-history-store'
import { composeQuery, countActiveFilters, EMPTY_FILTERS, highlightTerms, isSearchable } from './search-query'
import styles from './SearchPage.module.css'
import { AllResults, AppResults, NodeResults, PostResults, UserResults } from './SearchResults'
import type { SearchFilters } from './types'
import { useDebouncedValue } from './use-search'

const DEBOUNCE_MS = 400

/** Scopes the advanced filters apply to; nodes, users and apps match by name only. */
const FILTERABLE_SCOPES: ReadonlySet<SearchScope> = new Set<SearchScope>(['all', 'topics', 'media'])

const parseScope = (value: string | null): SearchScope =>
  SEARCH_SCOPES.includes(value as SearchScope) ? (value as SearchScope) : 'all'

export function SearchPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const urlText = params.get('q') ?? ''
  const scope = parseScope(params.get('scope'))
  const recordHistory = useSearchHistory((state) => state.record)

  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(urlText)
  // The text this page last wrote to the URL. Any other change came from
  // outside (title bar search, back/forward) and replaces the draft.
  const written = useRef(urlText)

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Tags and author are typed too; don't search on every keystroke.
  const appliedFilters = useDebouncedValue(filters, DEBOUNCE_MS)

  useEffect(() => {
    if (urlText === written.current) return
    written.current = urlText
    setDraft(urlText)
  }, [urlText])

  const writeText = useCallback(
    (value: string, replace: boolean) => {
      written.current = value
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (value) next.set('q', value)
          else next.delete('q')
          return next
        },
        { replace }
      )
    },
    [setParams]
  )

  // Typing replaces the history entry, so Back leaves search instead of replaying keystrokes.
  useEffect(() => {
    const trimmed = draft.trim()
    if (trimmed === written.current) return
    const timer = setTimeout(() => writeText(trimmed, true), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, writeText])

  /** Searches now: Enter and history chips skip the debounce and count as history. */
  const commit = (value: string): void => {
    const trimmed = value.trim()
    setDraft(value)
    if (trimmed !== written.current) writeText(trimmed, false)
    if (isSearchable(trimmed)) recordHistory(trimmed)
  }

  const setScope = (next: SearchScope): void => {
    setParams((previous) => {
      const updated = new URLSearchParams(previous)
      if (next === 'all') updated.delete('scope')
      else updated.set('scope', next)
      return updated
    })
  }

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    commit(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // A search input clears itself on Escape; here Escape only leaves the box.
    if (event.key === 'Escape') {
      event.preventDefault()
      input.current?.blur()
    }
  }

  const clear = (): void => {
    setDraft('')
    writeText('', true)
    input.current?.focus()
  }

  const text = urlText.trim()
  const searchable = isSearchable(text)
  const filterable = FILTERABLE_SCOPES.has(scope)
  const query = composeQuery(text, filterable ? appliedFilters : EMPTY_FILTERS, scope === 'media')
  const terms = useMemo(() => highlightTerms(text), [text])
  const activeFilters = countActiveFilters(filters)
  const onOpenResult = (): void => recordHistory(text)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <form className={styles.searchBox} role="search" onSubmit={onSubmit}>
            <Search className={styles.searchIcon} />
            <input
              ref={input}
              type="search"
              value={draft}
              autoFocus={!urlText}
              placeholder={t('search.placeholder')}
              aria-label={t('search.title')}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {draft && (
              <IconButton label={t('search.clear')} size="sm" onClick={clear}>
                <X />
              </IconButton>
            )}
          </form>

          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label={t('search.scopeLabel')}>
              {SEARCH_SCOPES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={item === scope}
                  className={styles.tab}
                  onClick={() => setScope(item)}
                >
                  {t(`search.scopes.${item}`)}
                </button>
              ))}
            </div>
            {filterable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<SlidersHorizontal />}
                aria-expanded={filtersOpen}
                className={cx(filtersOpen && styles.filterToggleOpen)}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {t('search.filters.toggle')}
                {activeFilters > 0 && <span className={styles.badge}>{activeFilters}</span>}
              </Button>
            )}
          </div>

          {filterable && filtersOpen && (
            <AdvancedFilters value={filters} onChange={setFilters} withImages={scope === 'media'} />
          )}
        </div>
      </header>

      <div className={styles.scroller}>
        <div className={styles.content}>
          {!searchable ? (
            <SearchHistory tooShort={text.length > 0} onSearch={commit} />
          ) : scope === 'all' ? (
            <AllResults text={text} terms={terms} query={query} onOpenResult={onOpenResult} onScope={setScope} />
          ) : scope === 'topics' || scope === 'media' ? (
            <PostResults text={text} terms={terms} query={query} onOpenResult={onOpenResult} />
          ) : scope === 'nodes' ? (
            <NodeResults text={text} terms={terms} />
          ) : scope === 'users' ? (
            <UserResults text={text} terms={terms} />
          ) : (
            <AppResults text={text} terms={terms} />
          )}
        </div>
      </div>
    </section>
  )
}

function SearchHistory({ tooShort, onSearch }: { tooShort: boolean; onSearch: (query: string) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const entries = useSearchHistory((state) => state.entries)
  const remove = useSearchHistory((state) => state.remove)
  const clear = useSearchHistory((state) => state.clear)

  if (entries.length === 0) {
    return <EmptyState icon={<Search />} title={t(tooShort ? 'search.tooShort' : 'search.history.empty')} />
  }

  return (
    <section className={styles.section}>
      {tooShort && <p className={styles.hint}>{t('search.tooShort')}</p>}
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <History />
          {t('search.history.title')}
        </h2>
        <Button variant="ghost" size="sm" onClick={clear}>
          {t('search.history.clear')}
        </Button>
      </header>
      <ul className={styles.chips}>
        {entries.map((entry) => (
          <li key={entry} className={styles.chip}>
            <button type="button" className={styles.chipLabel} onClick={() => onSearch(entry)}>
              {entry}
            </button>
            <IconButton
              label={t('search.history.remove', { query: entry })}
              size="sm"
              className={styles.chipRemove}
              onClick={() => remove(entry)}
            >
              <X />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  )
}
