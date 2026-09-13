import { useTranslation } from 'react-i18next'
import { SidebarHeader } from '../../layout/SidebarNav'
import { NewTopicButton } from '../social/NewTopicButton'
import { useMarkNodeVisited } from '../social/use-personal-nav'
import { NodeAbout } from './NodeAbout'
import { NodeHeader, NodeHeaderSkeleton } from './NodeHeader'
import styles from './NodeSidebar.module.css'
import { useNode } from './use-node'

/** Second column inside a node: its header, posting, and what the node is about. */
export function NodeSidebar({ slug }: { slug: string }): React.JSX.Element {
  const { t } = useTranslation()
  const node = useNode(slug)
  const category = node.data?.category
  // Only real nodes take topics; a section slug is about to redirect.
  const isNode = Boolean(node.data?.parent_category)
  useMarkNodeVisited(category?.id)

  if (!category) {
    return node.isPending ? (
      <NodeHeaderSkeleton />
    ) : (
      <SidebarHeader>
        <span className={styles.name}>{slug}</span>
      </SidebarHeader>
    )
  }

  return (
    <>
      <NodeHeader category={category} />
      <NewTopicButton label={t('nodes.postInNode')} categoryId={category.id} disabled={!isNode} />
      {isNode && <NodeAbout category={category} />}
    </>
  )
}
