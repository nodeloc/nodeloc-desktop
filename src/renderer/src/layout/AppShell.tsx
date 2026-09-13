import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Outlet, useLocation, type Location } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ToastHost } from '../components/ToastHost'
import { SignInDialog } from '../features/account/SignInDialog'
import { ChatUnreadSync } from '../features/chat/use-channels'
import { useAuthSync } from '../features/account/use-session'
import { ComposerHost } from '../features/composer/ComposerHost'
import { Lightbox } from '../features/media/Lightbox'
import { ShortcutsHost } from '../features/shortcuts/ShortcutsHost'
import { isPopoutWindow } from '../features/windows/window-mode'
import { cx } from '../lib/cx'
import styles from './AppShell.module.css'
import { DeepLinkHandler } from './DeepLinkHandler'
import { DetailPanel } from './DetailPanel'
import { DevHooks } from './DevHooks'
import { NodeRail } from './NodeRail'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

const DEFAULT_SIDEBAR_WIDTH = 320
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 520
const DEFAULT_TOPIC_RATIO = 0.5
const MIN_TOPIC_WIDTH = 280
const SIDEBAR_STORAGE_KEY = 'layout.sidebarWidth'
const TOPIC_RATIO_STORAGE_KEY = 'layout.topicRatio'

function storedNumber(key: string, fallback: number): number {
  const stored = window.localStorage.getItem(key)
  if (stored === null) return fallback
  const value = Number(stored)
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function trackResize(event: ReactPointerEvent<HTMLDivElement>, onMove: (deltaX: number) => void): void {
  if (event.button !== 0) return
  event.preventDefault()
  const handle = event.currentTarget
  const startX = event.clientX
  handle.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent): void => onMove(moveEvent.clientX - startX)
  const end = (): void => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

/**
 * Discord-style frame: node rail, context sidebar, main column and a detail
 * panel that folds away on narrower windows. Pop-out windows get the compact
 * frame: title bar and main column only.
 */
export function AppShell({ topicLocation }: { topicLocation?: Location }): React.JSX.Element {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const workspace = useRef<HTMLDivElement>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    clamp(storedNumber(SIDEBAR_STORAGE_KEY, DEFAULT_SIDEBAR_WIDTH), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)
  )
  const [topicRatio, setTopicRatio] = useState(() =>
    clamp(storedNumber(TOPIC_RATIO_STORAGE_KEY, DEFAULT_TOPIC_RATIO), 0.2, 0.8)
  )
  useAuthSync()
  const compact = isPopoutWindow

  useEffect(() => window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth)), [sidebarWidth])
  useEffect(() => window.localStorage.setItem(TOPIC_RATIO_STORAGE_KEY, String(topicRatio)), [topicRatio])

  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const startWidth = sidebarWidth
    trackResize(event, (delta) => setSidebarWidth(clamp(Math.round(startWidth + delta), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH)))
  }

  const topicRatioBounds = (): [number, number] => {
    const width = workspace.current?.clientWidth ?? 0
    if (width <= MIN_TOPIC_WIDTH * 2) return [0.45, 0.55]
    const minimum = MIN_TOPIC_WIDTH / width
    return [minimum, 1 - minimum]
  }

  const resizeTopic = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const width = workspace.current?.clientWidth ?? 0
    if (width <= 0) return
    const startRatio = topicRatio
    const [minimum, maximum] = topicRatioBounds()
    trackResize(event, (delta) => setTopicRatio(clamp(startRatio + delta / width, minimum, maximum)))
  }

  const shellStyle = { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties

  return (
    <div className={styles.shell} style={shellStyle}>
      <TitleBar compact={compact} />
      <div className={styles.body}>
        {!compact && <NodeRail />}
        {!compact && (
          <ErrorBoundary resetKey={pathname} quiet>
            <Sidebar />
          </ErrorBoundary>
        )}
        {!compact && (
          <div
            className={cx(styles.splitter, styles.sidebarSplitter)}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('nav.resizeSidebar')}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={resizeSidebar}
            onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              setSidebarWidth((value) => clamp(value + (event.key === 'ArrowRight' ? 16 : -16), MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH))
            }}
          />
        )}
        <div ref={workspace} className={styles.workspace}>
          <main
            className={cx(styles.main, compact && styles.compactMain)}
            style={topicLocation ? { flexGrow: topicRatio, flexBasis: 0 } : undefined}
          >
            <ErrorBoundary resetKey={pathname}>
              <Outlet />
            </ErrorBoundary>
            {!topicLocation && (
              <ErrorBoundary>
                <ComposerHost />
              </ErrorBoundary>
            )}
          </main>
          {topicLocation && !compact && (
            <div
              className={cx(styles.splitter, styles.topicSplitter)}
              role="separator"
              aria-orientation="vertical"
              aria-label={t('nav.resizeTopicColumns')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(topicRatio * 100)}
              tabIndex={0}
              onPointerDown={resizeTopic}
              onDoubleClick={() => setTopicRatio(DEFAULT_TOPIC_RATIO)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const [minimum, maximum] = topicRatioBounds()
                setTopicRatio((value) => clamp(value + (event.key === 'ArrowRight' ? 0.03 : -0.03), minimum, maximum))
              }}
            />
          )}
          {!compact && (
            <ErrorBoundary resetKey={pathname} quiet>
              <DetailPanel topicLocation={topicLocation} topicFlex={1 - topicRatio} />
            </ErrorBoundary>
          )}
        </div>
      </div>
      <Lightbox />
      <SignInDialog />
      {/* Deep links and notification clicks are delivered to the main window only. */}
      {!compact && <DeepLinkHandler />}
      {!compact && <ChatUnreadSync />}
      <ShortcutsHost />
      <ToastHost />
      {import.meta.env.DEV && <DevHooks />}
    </div>
  )
}
