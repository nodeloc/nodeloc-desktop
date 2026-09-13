import type { Location } from 'react-router'

export interface TopicDetailNavigationState {
  /** Route that stays in the third column while the topic opens in the fourth. */
  backgroundLocation: Location
}

export function topicDetailState(backgroundLocation: Location): TopicDetailNavigationState {
  return { backgroundLocation }
}

export function topicBackgroundLocation(state: unknown): Location | undefined {
  if (!state || typeof state !== 'object' || !('backgroundLocation' in state)) return undefined
  const location = (state as { backgroundLocation?: Partial<Location> }).backgroundLocation
  if (!location || typeof location.pathname !== 'string' || isTopicPath(location.pathname)) return undefined
  return location as Location
}

export function isTopicPath(pathname: string): boolean {
  return /^\/t\/\d+(?:\/\d+)?\/?$/.test(pathname)
}
