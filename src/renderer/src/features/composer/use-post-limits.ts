import { useSite } from '../../api/site'

/** Used until `site.json` arrives; the server stays the authority either way. */
const FALLBACK = { minTitleLength: 5, maxPostLength: 32_000 }

/** Site length settings for client-side hints. */
export function usePostLimits(): { minTitleLength: number; minPostLength?: number; maxPostLength: number } {
  const site = useSite().data
  return {
    minTitleLength: site?.min_topic_title_length ?? FALLBACK.minTitleLength,
    minPostLength: site?.min_post_length,
    maxPostLength: site?.max_post_length ?? FALLBACK.maxPostLength
  }
}
