import { SITE_ORIGIN } from '@shared/site'

/** Discourse's default `avatar_sizes`; other sizes aren't served. */
const AVATAR_SIZES = [24, 32, 45, 48, 60, 96, 120, 144, 240, 360]

/** Resolves the relative and protocol-relative URLs Discourse returns. */
export function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('//')) return `https:${pathOrUrl}`
  if (pathOrUrl.startsWith('/')) return `${SITE_ORIGIN}${pathOrUrl}`
  return pathOrUrl
}

/** Picks the smallest served size that stays sharp at this display size. */
export function avatarUrl(template: string, displaySize: number): string {
  const needed = Math.ceil(displaySize * (window.devicePixelRatio || 1))
  const size = AVATAR_SIZES.find((candidate) => candidate >= needed) ?? AVATAR_SIZES[AVATAR_SIZES.length - 1]
  return absoluteUrl(template.replace('{size}', String(size)))
}

export function topicUrl(topic: { id: number; slug: string }, postNumber?: number): string {
  const base = `${SITE_ORIGIN}/t/${topic.slug}/${topic.id}`
  return postNumber ? `${base}/${postNumber}` : base
}
