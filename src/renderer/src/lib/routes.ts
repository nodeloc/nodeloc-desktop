import { SITE_HOSTS, SITE_ORIGIN } from '@shared/site'

/** Home feed filters. Each maps to a Discourse list endpoint. */
export const FEED_FILTERS = ['latest', 'joined', 'hot', 'new', 'top', 'featured', 'unread', 'bookmarks'] as const
export type FeedFilter = (typeof FEED_FILTERS)[number]

/** Views inside a node (category list filters). */
export const NODE_VIEWS = ['latest', 'new', 'hot', 'featured', 'top'] as const
export type NodeView = (typeof NODE_VIEWS)[number]

export const SEARCH_SCOPES = ['all', 'nodes', 'topics', 'users', 'apps', 'media'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

export const PROFILE_TABS = ['activity', 'topics', 'replies', 'likes', 'points', 'badges'] as const
export type ProfileTab = (typeof PROFILE_TABS)[number]

/** In-app route builders. Keep every route string here so links never drift. */
export const paths = {
  home: (): string => '/',
  feed: (filter: FeedFilter): string => (filter === 'latest' ? '/' : `/feed/${filter}`),
  nodes: (): string => '/nodes',
  nodeGroup: (parentId: number): string => `/nodes/${parentId}`,
  node: (slug: string, view?: NodeView): string =>
    view && view !== 'latest' ? `/n/${encodeURIComponent(slug)}/${view}` : `/n/${encodeURIComponent(slug)}`,
  /** A node's mod tools; `overview` (or no section) is the tools' front page. */
  nodeMod: (slug: string, section?: string): string =>
    section && section !== 'overview'
      ? `/n/${encodeURIComponent(slug)}/mod/${encodeURIComponent(section)}`
      : `/n/${encodeURIComponent(slug)}/mod`,
  category: (id: number): string => `/c/${id}`,
  topic: (topicId: number, postNumber?: number): string =>
    postNumber && postNumber > 1 ? `/t/${topicId}/${postNumber}` : `/t/${topicId}`,
  user: (username: string, tab?: ProfileTab): string =>
    tab && tab !== 'activity' ? `/u/${encodeURIComponent(username)}/${tab}` : `/u/${encodeURIComponent(username)}`,
  tag: (slug: string): string => `/tag/${encodeURIComponent(slug)}`,
  customFeed: (username: string, slug: string): string =>
    `/f/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
  search: (query?: string, scope?: SearchScope): string => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (scope && scope !== 'all') params.set('scope', scope)
    const qs = params.toString()
    return qs ? `/search?${qs}` : '/search'
  },
  inbox: (): string => '/inbox',
  messages: (group?: string): string => (group ? `/inbox/messages/group/${encodeURIComponent(group)}` : '/inbox/messages'),
  chat: (channelId?: number, messageId?: number): string =>
    channelId === undefined ? '/chat' : messageId ? `/chat/${channelId}/${messageId}` : `/chat/${channelId}`,
  apps: (): string => '/apps',
  app: (slug: string): string => `/apps/${encodeURIComponent(slug)}`,
  settings: (): string => '/settings',
  gallery: (): string => '/gallery'
}

export function isSiteUrl(url: URL): boolean {
  return (url.protocol === 'https:' || url.protocol === 'http:') && SITE_HOSTS.includes(url.hostname)
}

/** Parses an href that may be relative to the forum. */
export function parseSiteHref(href: string): URL | null {
  try {
    return new URL(href, SITE_ORIGIN)
  } catch {
    return null
  }
}

const FEED_PATHS: Record<string, FeedFilter> = {
  latest: 'latest',
  joined: 'joined',
  hot: 'hot',
  new: 'new',
  top: 'top',
  featured: 'featured',
  unread: 'unread',
  bookmarks: 'bookmarks'
}

/** discourse-apps paths under /apps that aren't app slugs (see the plugin's routes.rb). */
const WEB_ONLY_APP_PATHS = new Set(['installs', 'directory', 'nodes', 'cli', 'authoring', 'admin'])

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const toInt = (value: string | undefined): number | undefined => {
  if (!value || !/^\d+$/.test(value)) return undefined
  return Number(value)
}

/**
 * Maps a forum URL to an in-app route, or null when the app has no native
 * screen for it (those open in the in-app browser).
 */
export function siteUrlToRoute(url: URL): string | null {
  if (!isSiteUrl(url)) return null
  const segments = url.pathname.replace(/\.json$/, '').split('/').filter(Boolean)
  const [head, a, b, c] = segments

  if (segments.length === 0) return paths.home()

  if (head && FEED_PATHS[head] && segments.length === 1) return paths.feed(FEED_PATHS[head])

  switch (head) {
    case 't': {
      // /t/{id} · /t/{id}/{post} · /t/{slug}/{id} · /t/{slug}/{id}/{post}
      const id = toInt(a)
      if (id !== undefined && !toInt(b)) return paths.topic(id, toInt(b))
      if (id !== undefined && toInt(b) !== undefined && c === undefined) {
        // Ambiguous: numeric slug. Discourse slugs are never purely numeric, so /t/{id}/{post}.
        return paths.topic(id, toInt(b))
      }
      const topicId = toInt(b)
      if (topicId !== undefined) return paths.topic(topicId, toInt(c))
      return null
    }
    case 'n': {
      // /n/{slug} is a node page; /n/{slug}/{topicId}[/{post}] is a nested topic.
      if (!a) return null
      // /n/{slug}/mod[/{section}] is the node's mod tools.
      if (b === 'mod') return paths.nodeMod(decode(a), c ? decode(c) : undefined)
      const topicId = toInt(b)
      if (topicId !== undefined) return paths.topic(topicId, toInt(c))
      return paths.node(decode(a))
    }
    case 'c': {
      // /c/{parent}/{child}/{id}[/l/{filter}] — the id is the last numeric segment.
      const listIndex = segments.indexOf('l')
      const path = listIndex === -1 ? segments.slice(1) : segments.slice(1, listIndex)
      const id = toInt(path[path.length - 1])
      return id !== undefined ? paths.category(id) : null
    }
    case 'u': {
      if (!a) return null
      if (b === 'messages' || b === 'preferences' || b === 'notifications') return null
      return paths.user(decode(a))
    }
    case 'tag':
    case 'tags': {
      if (head === 'tags' && a !== 'c' && segments.length === 1) return null
      return a ? paths.tag(decode(a)) : null
    }
    case 'f':
      return a && b ? paths.customFeed(decode(a), decode(b)) : null
    case 'chat': {
      // /chat/c/{slug}/{channelId}[/{messageId}]
      if (a !== 'c') return paths.chat()
      const channelId = toInt(c)
      return channelId !== undefined ? paths.chat(channelId, toInt(segments[4])) : paths.chat()
    }
    case 'search':
      return paths.search(url.searchParams.get('q') ?? undefined)
    case 'apps': {
      // /apps · /apps/directory · /apps/{slug}. Installs, node tools and authoring stay on the web.
      if (!a || (a === 'directory' && segments.length === 2)) return paths.apps()
      if (segments.length === 2 && /^[a-z0-9][a-z0-9-]*$/.test(a) && !WEB_ONLY_APP_PATHS.has(a)) return paths.app(a)
      return null
    }
    default:
      return null
  }
}
