import { useRef } from 'react'
import { Route, Routes, useLocation, type Location } from 'react-router'
import { AppDetailPage } from './features/apps/AppDetailPage'
import { AppsPage } from './features/apps/AppsPage'
import { ChatChannelPage } from './features/chat/ChatChannelPage'
import { ChatHomePage } from './features/chat/ChatHomePage'
import { CustomFeedPage } from './features/feed/CustomFeedPage'
import { FeedPage } from './features/feed/FeedPage'
import { TagFeedPage } from './features/feed/TagFeedPage'
import { Gallery } from './features/gallery/Gallery'
import { InboxPage } from './features/inbox/InboxPage'
import { MessagesPage } from './features/inbox/MessagesPage'
import { NodeModPage } from './features/node-mod/NodeModPage'
import { CategoryRedirect } from './features/nodes/CategoryRedirect'
import { NodeBrowsePage } from './features/nodes/NodeBrowsePage'
import { NodeGroupPage } from './features/nodes/NodeGroupPage'
import { NodePage } from './features/nodes/NodePage'
import { ProfilePage } from './features/profile/ProfilePage'
import { TopicPage } from './features/reader/TopicPage'
import { SearchPage } from './features/search/SearchPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { AppShell } from './layout/AppShell'
import { NotFoundPage } from './layout/NotFoundPage'
import { isTopicPath, topicBackgroundLocation } from './lib/topic-detail-navigation'

export function App(): React.JSX.Element {
  const location = useLocation()
  const retainedBackground = useRef<Location | null>(null)
  const topicRoute = isTopicPath(location.pathname)

  if (topicRoute) {
    retainedBackground.current = topicBackgroundLocation(location.state) ?? retainedBackground.current
  } else {
    retainedBackground.current = null
  }

  const backgroundLocation = topicRoute ? retainedBackground.current ?? undefined : undefined

  return (
    <Routes location={backgroundLocation ?? location}>
      <Route element={<AppShell topicLocation={backgroundLocation ? location : undefined} />}>
        <Route index element={<FeedPage />} />
        <Route path="feed/:filter" element={<FeedPage />} />
        <Route path="nodes" element={<NodeBrowsePage />} />
        <Route path="nodes/:parentId" element={<NodeGroupPage />} />
        <Route path="n/:slug" element={<NodePage />} />
        <Route path="n/:slug/:view" element={<NodePage />} />
        <Route path="n/:slug/mod" element={<NodeModPage />} />
        <Route path="n/:slug/mod/:section" element={<NodeModPage />} />
        <Route path="c/:categoryId" element={<CategoryRedirect />} />
        <Route path="t/:topicId" element={<TopicPage />} />
        <Route path="t/:topicId/:postNumber" element={<TopicPage />} />
        <Route path="u/:username" element={<ProfilePage />} />
        <Route path="u/:username/:tab" element={<ProfilePage />} />
        <Route path="tag/:slug" element={<TagFeedPage />} />
        <Route path="f/:username/:slug" element={<CustomFeedPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="inbox/messages" element={<MessagesPage />} />
        <Route path="inbox/messages/group/:group" element={<MessagesPage />} />
        <Route path="chat" element={<ChatHomePage />} />
        <Route path="chat/:channelId" element={<ChatChannelPage />} />
        <Route path="chat/:channelId/:messageId" element={<ChatChannelPage />} />
        <Route path="apps" element={<AppsPage />} />
        <Route path="apps/:slug" element={<AppDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
