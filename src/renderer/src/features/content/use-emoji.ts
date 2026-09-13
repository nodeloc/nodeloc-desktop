import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../api/client'
import { absoluteUrl } from '../../lib/discourse'

interface EmojiEntry {
  name: string
  url: string
}

/** Discourse names a few emoji by their alias in reactions settings. */
const ALIASES: Record<string, string> = {
  '+1': 'thumbsup',
  '-1': 'thumbsdown'
}

function index(groups: Record<string, EmojiEntry[]>): Map<string, string> {
  const map = new Map<string, string>()
  for (const entries of Object.values(groups)) {
    for (const entry of entries) map.set(entry.name, entry.url)
  }
  return map
}

/** Standard and custom emoji by name, from `/emojis.json` (loaded once per session). */
export function useEmojiIndex(): Map<string, string> | undefined {
  return useQuery({
    queryKey: ['emojis'],
    queryFn: () => apiRequest<Record<string, EmojiEntry[]>>({ path: '/emojis.json', priority: 'background' }),
    staleTime: Infinity,
    gcTime: Infinity,
    select: index
  }).data
}

export function emojiUrl(emoji: Map<string, string> | undefined, name: string): string {
  const resolved = emoji?.get(name) ?? emoji?.get(ALIASES[name] ?? '') ?? `/images/emoji/unicode/${ALIASES[name] ?? name}.png?v=15`
  return absoluteUrl(resolved)
}
