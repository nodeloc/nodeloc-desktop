import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCategoryIndex } from '../../api/site'
import { Button } from '../../components/Button'
import { countActiveFilters, EMPTY_FILTERS, filterSyntax, SEARCH_ORDERS, SEARCH_STATUSES } from './search-query'
import styles from './SearchPage.module.css'
import type { SearchFilters } from './types'

interface AdvancedFiltersProps {
  value: SearchFilters
  onChange: (filters: SearchFilters) => void
  /** Media scope adds `with:images`; shown in the syntax preview. */
  withImages: boolean
}

/** The advanced filter panel. Composes into search syntax; the typed text stays untouched. */
export function AdvancedFilters({ value, onChange, withImages }: AdvancedFiltersProps): React.JSX.Element {
  const { t } = useTranslation()
  const index = useCategoryIndex()

  // Nodes grouped under their sections, in site order.
  const groups = useMemo(() => {
    if (!index) return []
    return index.sections
      .map((section) => ({
        section,
        nodes: index.list
          .filter((category) => category.parent_category_id === section.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      }))
      .filter((group) => group.nodes.length > 0)
  }, [index])

  const update = <K extends keyof SearchFilters>(key: K, next: SearchFilters[K]): void =>
    onChange({ ...value, [key]: next })

  const syntax = filterSyntax(value, withImages)

  return (
    <div className={styles.filters}>
      <div className={styles.filterGrid}>
        <label className={styles.field}>
          <span>{t('search.filters.node')}</span>
          <select value={value.nodeSlug} onChange={(event) => update('nodeSlug', event.target.value)}>
            <option value="">{t('search.filters.anyNode')}</option>
            {groups.map(({ section, nodes }) => (
              <optgroup key={section.id} label={section.name}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.slug}>
                    {node.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.tags')}</span>
          <input
            value={value.tags}
            placeholder={t('search.filters.tagsPlaceholder')}
            spellCheck={false}
            onChange={(event) => update('tags', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.author')}</span>
          <input
            value={value.author}
            placeholder={t('search.filters.authorPlaceholder')}
            spellCheck={false}
            onChange={(event) => update('author', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.after')}</span>
          <input
            type="date"
            value={value.after}
            max={value.before || undefined}
            onChange={(event) => update('after', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.before')}</span>
          <input
            type="date"
            value={value.before}
            min={value.after || undefined}
            onChange={(event) => update('before', event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.status')}</span>
          <select value={value.status} onChange={(event) => update('status', event.target.value as SearchFilters['status'])}>
            <option value="">{t('search.filters.statuses.any')}</option>
            {SEARCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`search.filters.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>{t('search.filters.order')}</span>
          <select value={value.order} onChange={(event) => update('order', event.target.value as SearchFilters['order'])}>
            <option value="">{t('search.filters.orders.relevance')}</option>
            {SEARCH_ORDERS.map((order) => (
              <option key={order} value={order}>
                {t(`search.filters.orders.${order}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.filterFooter}>
        {syntax && (
          <span className={styles.syntax}>
            {t('search.filters.syntax')}
            <code>{syntax}</code>
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={countActiveFilters(value) === 0}
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          {t('search.filters.reset')}
        </Button>
      </div>
    </div>
  )
}
