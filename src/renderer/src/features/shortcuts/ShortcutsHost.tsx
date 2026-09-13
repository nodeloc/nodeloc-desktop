import { useEffect, useRef } from 'react'
import { matchPath, useLocation, useNavigate } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import type { TopicView } from '../../api/types'
import { paths } from '../../lib/routes'
import { useRequireSignIn } from '../account/use-session'
import { useComposer } from '../composer/composer-store'
import { useVisitedTopics } from '../feed/visited-store'
import { useActiveTopic } from '../reader/reader-store'
import { clearSelection, moveSelection, selectedPostNumber } from './item-navigation'
import { isComposing, isEditor, isModalOpen, isTextField } from './keyboard'
import { QuickSwitcher } from './QuickSwitcher'
import { ShortcutHelpDialog } from './ShortcutHelpDialog'
import './Shortcuts.module.css'
import { useShortcutsUi } from './shortcuts-store'

/** How long `g` waits for its second key. */
const SEQUENCE_MS = 1500

/**
 * App-wide keyboard shortcuts (KEY-*, NAV-05, FEED-07). Mounted once per
 * window by the shell; also hosts the help dialog and the quick switcher.
 */
export function ShortcutsHost(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const categories = useCategoryIndex()
  const requireSignIn = useRequireSignIn()

  // The listener is registered once; it reads the latest values through this ref.
  const latest = useRef({ navigate, pathname: location.pathname, categories, requireSignIn })
  latest.current = { navigate, pathname: location.pathname, categories, requireSignIn }

  // A new page means a new list: forget the J/K selection.
  useEffect(() => clearSelection(), [location.pathname])

  // Remember opened topics, for the switcher's "recent topics" and the recently viewed card.
  useEffect(() => {
    const record = (topic: TopicView | null): void => {
      if (!topic) return
      useVisitedTopics.getState().recordTopic({
        id: topic.id,
        title: topic.title,
        categoryId: topic.category_id,
        createdAt: topic.created_at,
        likeCount: topic.like_count,
        replyCount: Math.max(topic.posts_count - 1, 0),
        imageUrl: topic.image_url
      })
    }
    record(useActiveTopic.getState().topic)
    return useActiveTopic.subscribe((state, previous) => {
      if (state.topic !== previous.topic) record(state.topic)
    })
  }, [])

  useEffect(() => {
    let pendingG = 0

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isComposing(event)) return
      const { navigate, pathname, categories, requireSignIn } = latest.current
      const ui = useShortcutsUi.getState()
      const key = event.key

      // Ctrl+K works from plain inputs too, but not inside editors (which use it for links).
      if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey && key.toLowerCase() === 'k') {
        if (isEditor(event.target) || (isModalOpen() && !ui.switcherOpen)) return
        event.preventDefault()
        ui.setSwitcherOpen(!ui.switcherOpen)
        return
      }

      if (isTextField(event.target) || ui.switcherOpen || ui.helpOpen || isModalOpen()) return

      if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        if (key === ',') {
          event.preventDefault()
          navigate(paths.settings())
        } else if (key.toLowerCase() === 'n') {
          event.preventDefault()
          if (requireSignIn()) useComposer.getState().openNewTopic({ categoryId: currentNodeId(pathname, categories) })
        }
        return
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return

      if (pendingG && Date.now() - pendingG < SEQUENCE_MS) {
        pendingG = 0
        const target = { h: paths.home(), i: paths.inbox(), c: paths.chat() }[key.toLowerCase()]
        if (target) {
          event.preventDefault()
          navigate(target)
          return
        }
      }
      pendingG = 0

      switch (key) {
        case 'g':
        case 'G':
          pendingG = Date.now()
          return
        case 'j':
        case 'J':
          if (moveSelection(1)) event.preventDefault()
          return
        case 'k':
        case 'K':
          if (moveSelection(-1)) event.preventDefault()
          return
        case 'r':
        case 'R': {
          const topic = useActiveTopic.getState().topic
          const onTopic = matchPath('/t/:topicId/*', pathname)
          if (!topic || !onTopic || Number(onTopic.params.topicId) !== topic.id) return
          event.preventDefault()
          if (!requireSignIn()) return
          const postNumber = selectedPostNumber()
          useComposer.getState().openReply({
            topicId: topic.id,
            topicTitle: topic.title,
            replyToPostNumber: postNumber && postNumber > 1 ? postNumber : undefined
          })
          return
        }
        case 'n':
        case 'N':
          event.preventDefault()
          if (requireSignIn()) useComposer.getState().openNewTopic({ categoryId: currentNodeId(pathname, categories) })
          return
        case '/': {
          const input = document.querySelector<HTMLInputElement>('form[role="search"] input')
          event.preventDefault()
          if (input) {
            input.focus()
            input.select()
          } else {
            navigate(paths.search())
          }
          return
        }
        case '?':
          event.preventDefault()
          ui.setHelpOpen(true)
          return
      }
    }

    // Any click takes over from the keyboard selection.
    const onPointerDown = (): void => clearSelection()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])

  return (
    <>
      <ShortcutHelpDialog />
      <QuickSwitcher />
    </>
  )
}

/** The node on screen, so a new topic starts in it. */
function currentNodeId(pathname: string, categories: ReturnType<typeof useCategoryIndex>): number | undefined {
  const match = matchPath('/n/:slug/*', pathname)
  if (!match?.params.slug) return undefined
  let slug = match.params.slug
  try {
    slug = decodeURIComponent(slug)
  } catch {
    // Keep the raw segment.
  }
  return categories?.bySlug.get(slug)?.id
}
