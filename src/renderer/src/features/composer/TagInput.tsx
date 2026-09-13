import { Tag } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { useSite } from '../../api/site'
import { ChipInput, type ChipOption } from './ChipInput'
import form from './ComposerForm.module.css'
import type { TagSearchResponse } from './types'
import { useDebouncedValue } from './use-debounced-value'

/**
 * Discourse's `max_tags_per_topic` default. The site value isn't exposed to
 * API clients; the server answers 422 past its own limit.
 */
export const MAX_TAGS_FALLBACK = 5

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  /** Scopes suggestions to tags allowed in the node. */
  categoryId?: number
}

function normalizeTag(text: string): string | null {
  return text.trim().replace(/[,，]/g, '').replace(/\s+/g, '-') || null
}

/** Topic tags (COMP-08). Hidden when the account can't tag topics; free text only for accounts that may create tags. */
export function TagInput({ value, onChange, categoryId }: TagInputProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const site = useSite().data
  const inputId = useId()
  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim(), 250)
  const canTag = Boolean(site?.can_tag_topics)

  const search = useQuery({
    queryKey: ['composer', 'tag-search', term, categoryId ?? null],
    // No `limit`: values above the site's `max_tag_search_results` are a 400.
    queryFn: () => apiRequest<TagSearchResponse>({ path: '/tags/filter/search.json', query: { q: term, categoryId, filterForInput: true } }),
    enabled: canTag && term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  if (!canTag) return null

  const options: ChipOption[] = term
    ? (search.data?.results ?? []).map((tag) => ({
        key: tag.name,
        value: tag.name,
        label: tag.name,
        detail: tag.count ? String(tag.count) : undefined,
        icon: <Tag />
      }))
    : []

  return (
    <div className={form.field}>
      <label className={form.label} htmlFor={inputId}>
        {t('composer.tags.label')}
      </label>
      <ChipInput
        id={inputId}
        values={value}
        onChange={onChange}
        query={query}
        onQueryChange={setQuery}
        options={options}
        loading={search.isFetching}
        placeholder={t('composer.tags.placeholder')}
        max={MAX_TAGS_FALLBACK}
        normalizeCustom={site?.can_create_tag ? normalizeTag : undefined}
        removeLabel={(name) => t('composer.tags.remove', { name })}
      />
      {value.length >= MAX_TAGS_FALLBACK && <p className={form.hint}>{t('composer.tags.max', { count: MAX_TAGS_FALLBACK })}</p>}
    </div>
  )
}
