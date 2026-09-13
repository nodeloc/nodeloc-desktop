import { Hash, Tag, Users } from 'lucide-react'
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../api/client'
import type { BasicUser, NestedTopicResponse, TopicResponse } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { emojiUrl, useEmojiIndex } from '../content/use-emoji'
import type { Trigger } from './autocomplete'
import type { Suggestion } from './SuggestionList'
import type { HashtagSearchResponse, UserSearchResponse } from './types'
import { useDebouncedValue } from './use-debounced-value'

export interface AutocompleteOption extends Suggestion {
  /** Replaces the trigger text, trailing space included. */
  insert: string
}

const LIMIT = 8
const SEARCH_DELAY_MS = 200

/** Participants of a topic the reader already loaded (flat or nested view). */
function cachedParticipants(queryClient: QueryClient, topicId: number): BasicUser[] {
  const found = new Map<string, BasicUser>()
  for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: ['topic', topicId] })) {
    const flat = data as Partial<TopicResponse> | undefined
    const nested = data as { pages?: Array<Partial<NestedTopicResponse>> } | undefined
    const participants = flat?.details?.participants ?? nested?.pages?.[0]?.topic?.details?.participants ?? []
    for (const participant of participants) found.set(participant.username, participant)
  }
  return [...found.values()]
}

function userOption(user: { username: string; name?: string | null; avatar_template: string }): AutocompleteOption {
  return {
    key: `user:${user.username}`,
    label: user.username,
    detail: user.name ?? undefined,
    icon: <Avatar template={user.avatar_template} username={user.username} size={20} />,
    insert: `@${user.username} `
  }
}

/**
 * Suggestions for the current trigger: users and mentionable groups (topic
 * participants before anything is typed), emoji from `/emojis.json`, and
 * nodes/tags from the hashtag search.
 */
export function useAutocompleteOptions(trigger: Trigger | null, topicId?: number): { options: AutocompleteOption[]; loading: boolean } {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const emoji = useEmojiIndex()
  const kind = trigger?.kind
  const term = useDebouncedValue(trigger?.query ?? '', SEARCH_DELAY_MS)

  const users = useQuery({
    queryKey: ['composer', 'mention', term, topicId ?? null],
    queryFn: () =>
      apiRequest<UserSearchResponse>({
        path: '/u/search/users.json',
        query: { term, topic_id: topicId, include_mentionable_groups: 'true', limit: LIMIT }
      }),
    enabled: kind === 'mention' && term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const hashtags = useQuery({
    queryKey: ['composer', 'hashtag', term],
    // `order[]` is required; without it the endpoint answers 400.
    queryFn: () => apiRequest<HashtagSearchResponse>({ path: '/hashtags/search.json', query: { term, 'order[]': ['category', 'tag'] } }),
    enabled: kind === 'hashtag',
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const options = useMemo((): AutocompleteOption[] => {
    if (!trigger) return []
    switch (trigger.kind) {
      case 'mention': {
        if (!trigger.query) return topicId ? cachedParticipants(queryClient, topicId).slice(0, LIMIT).map(userOption) : []
        const groups = (users.data?.groups ?? []).map((group) => ({
          key: `group:${group.name}`,
          label: group.name,
          detail: group.full_name || t('composer.autocomplete.group'),
          icon: <Users />,
          insert: `@${group.name} `
        }))
        return [...(users.data?.users ?? []).map(userOption), ...groups].slice(0, LIMIT)
      }
      case 'emoji': {
        if (!emoji) return []
        const query = trigger.query.toLowerCase()
        const prefixed: string[] = []
        const containing: string[] = []
        for (const name of emoji.keys()) {
          if (name.startsWith(query)) prefixed.push(name)
          else if (name.includes(query)) containing.push(name)
        }
        prefixed.sort((a, b) => a.length - b.length)
        return [...prefixed, ...containing].slice(0, LIMIT).map((name) => ({
          key: `emoji:${name}`,
          label: `:${name}:`,
          icon: <img src={emojiUrl(emoji, name)} alt="" loading="lazy" draggable={false} />,
          insert: `:${name}: `
        }))
      }
      case 'hashtag':
        return (hashtags.data?.results ?? []).slice(0, LIMIT).map((item) => ({
          key: `${item.type}:${item.ref}`,
          label: item.text,
          detail: item.type === 'tag' ? t('composer.autocomplete.tag') : t('composer.autocomplete.category'),
          icon: item.type === 'tag' ? <Tag /> : <Hash />,
          insert: `#${item.ref} `
        }))
    }
  }, [trigger, topicId, queryClient, users.data, hashtags.data, emoji, t])

  const loading = (kind === 'mention' && users.isFetching) || (kind === 'hashtag' && hashtags.isFetching)
  return { options, loading }
}
