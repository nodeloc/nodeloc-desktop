import { useMatch } from 'react-router'
import { useCategoryIndex } from '../api/site'
import { ChatSidebar } from '../features/chat/ChatSidebar'
import { InboxSidebar } from '../features/inbox/InboxSidebar'
import { NodeModSidebar } from '../features/node-mod/NodeModSidebar'
import { NodeHeaderSkeleton } from '../features/nodes/NodeHeader'
import { NodeSidebar } from '../features/nodes/NodeSidebar'
import { useActiveTopic } from '../features/reader/reader-store'
import { HomeSidebar } from './HomeSidebar'
import styles from './Sidebar.module.css'
import { UserBar } from './UserBar'

/** The second column follows the route: a node (also while reading one of its topics), the inbox, chat, feeds everywhere else. */
export function Sidebar(): React.JSX.Element {
  const nodeMatch = useMatch('/n/:slug/*')
  const nodeModMatch = useMatch('/n/:slug/mod/*')
  const topicMatch = useMatch('/t/:topicId/*')
  const inboxMatch = useMatch('/inbox/*')
  const chatMatch = useMatch('/chat/*')

  let content: React.JSX.Element
  if (nodeModMatch?.params.slug) content = <NodeModSidebar slug={nodeModMatch.params.slug} />
  else if (nodeMatch?.params.slug) content = <NodeSidebar slug={nodeMatch.params.slug} />
  else if (topicMatch?.params.topicId) content = <TopicNodeSidebar topicId={Number(topicMatch.params.topicId)} />
  else if (inboxMatch) content = <InboxSidebar />
  else if (chatMatch) content = <ChatSidebar />
  else content = <HomeSidebar />

  return (
    <aside className={styles.sidebar}>
      <div className={styles.content}>{content}</div>
      <UserBar />
    </aside>
  )
}

/** The node of the topic being read. Topics outside a node (announcements, messages) keep the feeds. */
function TopicNodeSidebar({ topicId }: { topicId: number }): React.JSX.Element {
  const topic = useActiveTopic((state) => state.topic)
  const index = useCategoryIndex()

  if (topic?.id !== topicId || !index) return <NodeHeaderSkeleton />
  const category = index.byId.get(topic.category_id)
  if (!category?.parent_category_id) return <HomeSidebar />
  return <NodeSidebar key={category.slug} slug={category.slug} />
}
