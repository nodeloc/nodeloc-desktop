import { Compass, FileText, Hash, House, Inbox, LayoutGrid, Mail, MessageCircle, MessagesSquare, Rss, Search, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCategoryIndex, useFeatures } from '../../api/site'
import { NodeIcon } from '../../components/NodeIcon'
import { paths } from '../../lib/routes'
import { useIsSignedIn } from '../account/use-session'
import { useChatChannels } from '../chat/use-channels'
import { useVisitedTopics } from '../feed/visited-store'
import { useJoinedNodes } from '../social/use-joined-nodes'
import { useCustomFeeds, useRecentlyVisitedNodes } from '../social/use-personal-nav'
import { bestScore } from './fuzzy'
import { Kbd } from './ShortcutHelpDialog'
import styles from './QuickSwitcher.module.css'
import { useShortcutsUi } from './shortcuts-store'

type GroupId = 'pages' | 'topics' | 'joined' | 'recentNodes' | 'channels' | 'feeds' | 'nodes' | 'search'

interface SwitcherItem {
  key: string
  group: GroupId
  label: string
  detail?: string
  icon: ReactNode
  /** Also matched besides the label: slugs, usernames, English page names. */
  keywords?: string[]
  route: string
}

/** Listing order when nothing is typed, and a tie-breaker when something is. */
const GROUP_ORDER: GroupId[] = ['pages', 'topics', 'joined', 'recentNodes', 'channels', 'feeds', 'nodes', 'search']
const GROUP_BONUS: Record<GroupId, number> = {
  pages: 40,
  topics: 30,
  joined: 30,
  recentNodes: 25,
  channels: 20,
  feeds: 20,
  nodes: 0,
  search: -Infinity
}
/** Rows per group with an empty query. All nodes only appear once you type. */
const BROWSE_LIMIT: Partial<Record<GroupId, number>> = { topics: 6, joined: 8, recentNodes: 5, channels: 6, feeds: 5, nodes: 0 }
const RESULT_LIMIT = 40

/** Ctrl+K — jump to nodes, recent topics, chat channels and fixed pages by name. */
export function QuickSwitcher(): React.JSX.Element | null {
  const open = useShortcutsUi((state) => state.switcherOpen)
  if (!open) return null
  return createPortal(<SwitcherPanel />, document.body)
}

function useSwitcherItems(): SwitcherItem[] {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const features = useFeatures()
  const categories = useCategoryIndex()
  const joined = useJoinedNodes().data?.communities
  const recentNodes = useRecentlyVisitedNodes().data?.communities
  const recentTopics = useVisitedTopics((state) => state.recent)
  const channels = useChatChannels().data
  const feeds = useCustomFeeds().data?.custom_feeds

  return useMemo(() => {
    const items: SwitcherItem[] = []
    const page = (key: string, route: string, icon: ReactNode, keywords: string[]): void => {
      items.push({ key: `page:${key}`, group: 'pages', label: t(`shortcuts.switcher.pages.${key}`), icon, route, keywords })
    }
    page('home', paths.home(), <House />, ['home', 'latest', 'shouye'])
    if (signedIn) {
      page('inbox', paths.inbox(), <Inbox />, ['inbox', 'notifications', 'tongzhi'])
      page('messages', paths.messages(), <Mail />, ['messages', 'pm', 'sixin'])
      if (features?.chat !== false) page('chat', paths.chat(), <MessagesSquare />, ['chat', 'liaotian'])
    }
    page('nodes', paths.nodes(), <Compass />, ['nodes', 'browse', 'jiedian'])
    if (features?.apps !== false) page('apps', paths.apps(), <LayoutGrid />, ['apps', 'yingyong'])
    page('search', paths.search(), <Search strokeWidth={2.5} />, ['search', 'sousuo'])
    page('settings', paths.settings(), <Settings />, ['settings', 'preferences', 'shezhi'])

    for (const topic of recentTopics) {
      items.push({
        key: `topic:${topic.id}`,
        group: 'topics',
        label: topic.title,
        icon: <FileText />,
        route: paths.topic(topic.id),
        keywords: [String(topic.id)]
      })
    }

    const nodeItem = (group: GroupId, node: { id: number; name: string; slug: string; color?: string; uploaded_logo?: { id: number; url: string } | null; uploaded_logo_dark?: { id: number; url: string } | null }): SwitcherItem => ({
      key: `${group}:${node.id}`,
      group,
      label: node.name,
      detail: node.slug,
      icon: <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} size={20} />,
      route: paths.node(node.slug),
      keywords: [node.slug]
    })
    for (const node of joined ?? []) items.push(nodeItem('joined', node))
    for (const node of recentNodes ?? []) items.push(nodeItem('recentNodes', node))

    if (channels) {
      for (const channel of channels.publicChannels) {
        items.push({
          key: `channel:${channel.id}`,
          group: 'channels',
          label: channel.title,
          detail: channel.chatable?.name ?? undefined,
          icon: <Hash strokeWidth={2.5} />,
          route: paths.chat(channel.id),
          keywords: [channel.slug ?? '']
        })
      }
      for (const channel of channels.directChannels) {
        const usernames = channel.chatable?.users?.map((user) => user.username) ?? []
        items.push({
          key: `channel:${channel.id}`,
          group: 'channels',
          label: channel.title || usernames.join(', '),
          detail: t('shortcuts.switcher.directMessage'),
          icon: <MessageCircle />,
          route: paths.chat(channel.id),
          keywords: usernames
        })
      }
    }

    for (const feed of feeds ?? []) {
      items.push({
        key: `feed:${feed.id}`,
        group: 'feeds',
        label: feed.name,
        detail: feed.username,
        icon: <Rss strokeWidth={2.5} />,
        route: paths.customFeed(feed.username, feed.slug),
        keywords: [feed.slug]
      })
    }

    for (const category of categories?.list ?? []) {
      const parent = category.parent_category_id ? categories?.byId.get(category.parent_category_id) : undefined
      items.push({
        key: `nodes:${category.id}`,
        group: 'nodes',
        label: category.name,
        detail: parent ? parent.name : t('shortcuts.switcher.section'),
        icon: <NodeIcon name={category.name} color={category.color} logo={category.uploaded_logo} logoDark={category.uploaded_logo_dark} size={20} />,
        route: parent ? paths.node(category.slug) : paths.nodeGroup(category.id),
        keywords: [category.slug]
      })
    }

    return items
  }, [t, signedIn, features, categories, joined, recentNodes, recentTopics, channels, feeds])
}

type Row = { type: 'header'; key: string; label: string } | { type: 'item'; item: SwitcherItem; index: number }

function SwitcherPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setOpen = useShortcutsUi((state) => state.setSwitcherOpen)
  const items = useSwitcherItems()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // Focus the field, and give focus back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => previous?.focus?.({ preventScroll: true })
  }, [])

  const results = useMemo<SwitcherItem[]>(() => {
    const trimmed = query.trim()
    const seen = new Set<string>()
    const unique = (item: SwitcherItem): boolean => {
      if (seen.has(item.route)) return false
      seen.add(item.route)
      return true
    }

    if (!trimmed) {
      const counts = new Map<GroupId, number>()
      return items.filter((item) => {
        const used = counts.get(item.group) ?? 0
        const limit = BROWSE_LIMIT[item.group]
        if (limit !== undefined && used >= limit) return false
        if (!unique(item)) return false
        counts.set(item.group, used + 1)
        return true
      })
    }

    const ranked = items
      .map((item) => ({ item, score: bestScore(trimmed, [item.label, ...(item.keywords ?? [])]) }))
      .filter((entry): entry is { item: SwitcherItem; score: number } => entry.score !== null)
      .sort((a, b) => b.score + GROUP_BONUS[b.item.group] - (a.score + GROUP_BONUS[a.item.group]))
      .map((entry) => entry.item)
      .filter(unique)
      .slice(0, RESULT_LIMIT)

    ranked.push({
      key: 'search',
      group: 'search',
      label: t('shortcuts.switcher.searchFor', { query: trimmed }),
      icon: <Search strokeWidth={2.5} />,
      route: paths.search(trimmed)
    })
    return ranked
  }, [items, query, t])

  const rows = useMemo<Row[]>(() => {
    if (query.trim()) return results.map((item, index) => ({ type: 'item', item, index }))
    const out: Row[] = []
    let index = 0
    for (const group of GROUP_ORDER) {
      const members = results.filter((item) => item.group === group)
      if (members.length === 0) continue
      out.push({ type: 'header', key: `header:${group}`, label: t(`shortcuts.switcher.groups.${group}`) })
      for (const item of members) out.push({ type: 'item', item, index: index++ })
    }
    return out
  }, [results, query, t])

  const ordered = useMemo(() => rows.flatMap((row) => (row.type === 'item' ? [row.item] : [])), [rows])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows])

  const close = (): void => setOpen(false)
  const choose = (item: SwitcherItem | undefined): void => {
    if (!item) return
    close()
    navigate(item.route)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    const count = ordered.length
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      if (count) setActive((value) => (value + 1) % count)
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      if (count) setActive((value) => (value - 1 + count) % count)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(ordered[active])
    } else if (event.key === 'Escape' || (event.key.toLowerCase() === 'k' && event.ctrlKey)) {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      event.preventDefault()
    }
  }

  const activeItem = ordered[active]

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('shortcuts.switcher.label')}
        data-quick-switcher=""
        onKeyDown={onKeyDown}
      >
        <div className={styles.inputRow}>
          <Search />
          <input
            ref={input}
            className={styles.input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('shortcuts.switcher.placeholder')}
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-switcher-list"
            aria-activedescendant={activeItem ? `quick-switcher-${activeItem.key}` : undefined}
          />
        </div>
        <div ref={list} className={styles.list} id="quick-switcher-list" role="listbox">
          {rows.length === 0 && <p className={styles.empty}>{t('shortcuts.switcher.empty')}</p>}
          {rows.map((row) =>
            row.type === 'header' ? (
              <div key={row.key} className={styles.header} role="presentation">
                {row.label}
              </div>
            ) : (
              <button
                key={row.item.key}
                id={`quick-switcher-${row.item.key}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={row.index === active}
                data-active={row.index === active}
                className={styles.item}
                onMouseMove={() => {
                  if (row.index !== active) setActive(row.index)
                }}
                onClick={() => choose(row.item)}
              >
                <span className={styles.icon}>{row.item.icon}</span>
                <span className={styles.label}>{row.item.label}</span>
                {(row.item.detail || query.trim()) && (
                  <span className={styles.detail}>
                    {query.trim() && row.item.group !== 'search' ? t(`shortcuts.switcher.groups.${row.item.group}`) : row.item.detail}
                  </span>
                )}
              </button>
            )
          )}
        </div>
        <footer className={styles.footer}>
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t('shortcuts.switcher.footer.navigate')}
          </span>
          <span>
            <Kbd>Enter</Kbd>
            {t('shortcuts.switcher.footer.open')}
          </span>
          <span>
            <Kbd>Esc</Kbd>
            {t('shortcuts.switcher.footer.close')}
          </span>
        </footer>
      </div>
    </div>
  )
}
