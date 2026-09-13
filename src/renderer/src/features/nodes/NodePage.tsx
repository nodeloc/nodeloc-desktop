import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useCategoryIndex, useSite } from '../../api/site'
import { IconButton } from '../../components/Button'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { NODE_VIEWS, paths, type NodeView } from '../../lib/routes'
import { PeriodSelect } from '../feed/PeriodSelect'
import { categorySource, type TopPeriod } from '../feed/topic-list-source'
import { TopicList } from '../feed/TopicList'
import { TopicRowSkeleton } from '../feed/TopicRowSkeleton'
import { NodeLoadError } from './NodeLoadError'
import styles from './NodePage.module.css'
import { NodeViewTabs } from './NodeViewTabs'
import { nodeListPath, useNode } from './use-node'

/** `/n/:slug` and `/n/:slug/:view`: a node's topic list. Its header and about live in the sidebar. */
export function NodePage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { slug = '', view = 'latest' } = useParams()
  const [period, setPeriod] = useState<TopPeriod>('weekly')

  const node = useNode(slug)
  const site = useSite()
  const index = useCategoryIndex()

  const validView = (NODE_VIEWS as readonly string[]).includes(view)
  const nodeView = view as NodeView
  const listPath = node.data ? nodeListPath(node.data) : null
  const source = useMemo(
    () => (listPath ? categorySource(listPath, nodeView, period) : null),
    [listPath, nodeView, period]
  )

  if (!validView) return <NotFoundPage />

  if (node.data) {
    const { category } = node.data
    // Top-level sections have no node page; their nodes are listed instead.
    if (!source) return <Navigate to={paths.nodeGroup(category.id)} replace />

    return (
      <TopicList
        key={`${slug}:${nodeView}`}
        source={source}
        title={category.name}
        nav={<NodeViewTabs slug={slug} />}
        actions={
          <>
            {nodeView === 'top' && <PeriodSelect value={period} onChange={setPeriod} />}
            <IconButton label={t('nodes.searchInNode')} onClick={() => navigate(paths.search(`#${category.slug}`))}>
              <Search />
            </IconButton>
          </>
        }
        emptyTitle={t('nodes.emptyTopics')}
        showCategory={false}
      />
    )
  }

  if (node.isError) {
    if (isApiErrorKind(node.error, 'notFound')) {
      // `/n/{section}` 404s; wait for the site categories before calling it missing.
      if (!index && site.isPending) return <NodePageSkeleton />
      const section = index?.bySlug.get(slug)
      if (section && !section.parent_category_id) return <Navigate to={paths.nodeGroup(section.id)} replace />
      return <NotFoundPage />
    }
    return (
      <section className={styles.page}>
        <header className={styles.toolbar} />
        <NodeLoadError error={node.error} onRetry={() => void node.refetch()} />
      </section>
    )
  }

  return <NodePageSkeleton />
}

function NodePageSkeleton(): React.JSX.Element {
  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <SkeletonGroup className={styles.toolbarSkeleton}>
          <SkeletonLine width={1} height={28} />
        </SkeletonGroup>
      </header>
      <div className={styles.scroller}>
        <TopicRowSkeleton count={8} />
      </div>
    </section>
  )
}
