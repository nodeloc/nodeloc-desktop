import { Users } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import { Avatar } from '../../components/Avatar'
import { ChipInput, type ChipOption } from './ChipInput'
import type { UserSearchResponse } from './types'
import { useDebouncedValue } from './use-debounced-value'

interface RecipientInputProps {
  id?: string
  value: string[]
  onChange: (recipients: string[]) => void
  invalid?: boolean
}

const LIMIT = 8

function normalizeRecipient(text: string): string | null {
  return text.trim().replace(/^@/, '') || null
}

/** Usernames and messageable groups for a private message. */
export function RecipientInput({ id, value, onChange, invalid }: RecipientInputProps): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim().replace(/^@/, ''), 250)

  const search = useQuery({
    queryKey: ['composer', 'recipient-search', term],
    queryFn: () =>
      apiRequest<UserSearchResponse>({
        path: '/u/search/users.json',
        // The group flag must be the string "true".
        query: { term, include_messageable_groups: 'true', limit: LIMIT }
      }),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const options: ChipOption[] = term
    ? [
        ...(search.data?.users ?? []).map((user) => ({
          key: `user:${user.username}`,
          value: user.username,
          label: user.username,
          detail: user.name ?? undefined,
          icon: <Avatar template={user.avatar_template} username={user.username} size={20} />
        })),
        ...(search.data?.groups ?? []).map((group) => ({
          key: `group:${group.name}`,
          value: group.name,
          label: group.name,
          detail: group.full_name || t('composer.autocomplete.group'),
          icon: <Users />
        }))
      ]
    : []

  return (
    <ChipInput
      id={id}
      values={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={options}
      loading={search.isFetching}
      placeholder={t('composer.message.recipientsPlaceholder')}
      normalizeCustom={normalizeRecipient}
      invalid={invalid}
      removeLabel={(name) => t('composer.message.removeRecipient', { name })}
    />
  )
}
