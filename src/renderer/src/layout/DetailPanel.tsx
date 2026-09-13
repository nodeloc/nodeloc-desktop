import { Route, Routes, useMatch, type Location } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ChatDetailPanel } from '../features/chat/ChatDetailPanel'
import { useChatStore } from '../features/chat/chat-store'
import { ComposerHost } from '../features/composer/ComposerHost'
import { TopicPage } from '../features/reader/TopicPage'
import { cx } from '../lib/cx'
import styles from './DetailPanel.module.css'
import { RecentTopicsCard } from './RecentTopicsCard'

/**
 * Right-hand column: a topic opened from the main list, chat threads, or
 * recently viewed topics. A directly opened topic remains in the main column.
 */
export function DetailPanel({ topicLocation, topicFlex }: { topicLocation?: Location; topicFlex?: number }): React.JSX.Element | null {
  const { t } = useTranslation()
  const nodeMatch = useMatch('/n/:slug/*')
  const topicMatch = useMatch('/t/:topicId/*')
  const chatMatch = useMatch('/chat/:channelId/*')
  const chatThreadOpen = useChatStore((state) => state.thread !== null)

  if (topicLocation) {
    return (
      <aside
        className={cx(styles.panel, styles.topicPanel)}
        data-overlay="true"
        data-topic-detail="true"
        data-app-fullscreen-target="true"
        aria-label={t('reader.detailColumnLabel')}
        style={{ flexGrow: topicFlex }}
      >
        <ErrorBoundary resetKey={`${topicLocation.pathname}${topicLocation.search}`}>
          <Routes location={topicLocation}>
            <Route path="/t/:topicId" element={<TopicPage />} />
            <Route path="/t/:topicId/:postNumber" element={<TopicPage />} />
          </Routes>
        </ErrorBoundary>
        <ErrorBoundary>
          <ComposerHost />
        </ErrorBoundary>
      </aside>
    )
  }

  if (nodeMatch?.params.slug || topicMatch?.params.topicId) return null

  let content: React.JSX.Element
  let overlay = false
  if (chatMatch?.params.channelId && /^\d+$/.test(chatMatch.params.channelId)) {
    content = <ChatDetailPanel channelId={Number(chatMatch.params.channelId)} />
    // An open thread is the only way to read it, so narrow windows show it as a drawer.
    overlay = chatThreadOpen
  } else content = <RecentTopicsCard />

  return (
    <aside className={styles.panel} data-overlay={overlay}>
      {content}
    </aside>
  )
}
