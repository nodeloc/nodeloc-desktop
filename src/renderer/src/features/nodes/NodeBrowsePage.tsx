import { ChevronRight, Compass } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { NodesResponse } from '../../api/types'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './NodeBrowse.module.css'
import { NodeCard, NodeCardSkeletons, NodeGrid } from './NodeCard'
import { InlineRetry, NodeLoadError } from './NodeLoadError'
import type { NodeGroup } from './types'
import { useInView } from './use-in-view'
import {
  SECTION_PREVIEW_COUNT,
  uniqueNodes,
  useMoreRecommended,
  useNodesOverview,
  useSectionPreview
} from './use-node-directory'

/** `/nodes`: recommended nodes, then a preview of every section. */
export function NodeBrowsePage(): React.JSX.Element {
  const { t } = useTranslation()
  const overview = useNodesOverview()
  // The scroll container is the root for lazy section previews.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)

  const groups = useMemo(
    () =>
      Object.values(overview.data?.grouped ?? {})
        .filter((group) => group.total_count > 0)
        .sort((a, b) => (a.category.position ?? 0) - (b.category.position ?? 0)),
    [overview.data]
  )

  let body: React.JSX.Element
  if (overview.data) {
    body = (
      <>
        <RecommendedSection overview={overview.data} />
        {groups.map((group) => (
          <SectionPreview key={group.category.id} group={group} root={scroller} />
        ))}
      </>
    )
  } else if (overview.isError) {
    body = <NodeLoadError error={overview.error} onRetry={() => void overview.refetch()} />
  } else {
    body = (
      <section className={styles.section}>
        <SkeletonGroup>
          <SkeletonLine width={0.16} height={18} />
        </SkeletonGroup>
        <NodeCardSkeletons count={9} />
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>
          <Compass />
          <span className={styles.titleText}>{t('nav.browseNodes')}</span>
        </h1>
      </header>
      <div ref={setScroller} className={styles.scroller}>
        <div className={styles.content}>
          <p className={styles.intro}>{t('nodes.browse.subtitle')}</p>
          {body}
        </div>
      </div>
    </section>
  )
}

function RecommendedSection({ overview }: { overview: NodesResponse }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const first = overview.recommended_meta
  const [wantsMore, setWantsMore] = useState(false)
  const more = useMoreRecommended(wantsMore, first.offset + first.limit)

  const nodes = useMemo(
    () => uniqueNodes([overview.recommended, ...(more.data?.pages.map((page) => page.recommended) ?? [])]),
    [overview.recommended, more.data]
  )
  const hasMore = more.data ? more.hasNextPage : first.has_more

  const loadMore = (): void => {
    if (!wantsMore) setWantsMore(true)
    else if (more.data) void more.fetchNextPage()
    else void more.refetch()
  }

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          {t('nodes.browse.recommended')}
          {first.total > 0 && <span className={styles.sectionCount}>{formatCount(first.total, i18n.language)}</span>}
        </h2>
      </header>
      {nodes.length > 0 ? (
        <NodeGrid>
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </NodeGrid>
      ) : (
        <p className={styles.muted}>{t('nodes.browse.empty')}</p>
      )}
      {(hasMore || more.isError) && (
        <div className={styles.footer}>
          {more.isFetching ? (
            <Spinner size={24} />
          ) : (
            <Button size="sm" onClick={loadMore}>
              {more.isError ? `${t('nodes.loadMoreFailed')} · ${t('common.retry')}` : t('nodes.loadMore')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

function SectionPreview({ group, root }: { group: NodeGroup; root: Element | null }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { category, total_count: total } = group
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const inView = useInView(anchor, root, '600px')

  // Fetch once the section nears the viewport, then keep it.
  const [seen, setSeen] = useState(false)
  if (inView && !seen) setSeen(true)
  const preview = useSectionPreview(category.id, seen)

  let content: React.JSX.Element
  if (preview.data) {
    content =
      preview.data.communities.length > 0 ? (
        <NodeGrid>
          {preview.data.communities.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </NodeGrid>
      ) : (
        <p className={styles.muted}>{t('nodes.browse.sectionEmpty')}</p>
      )
  } else if (preview.isError) {
    content = <InlineRetry error={preview.error} onRetry={() => void preview.refetch()} />
  } else {
    content = <NodeCardSkeletons count={Math.min(Math.max(total, 1), SECTION_PREVIEW_COUNT)} />
  }

  return (
    <section ref={setAnchor} className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.dot} style={{ background: `#${category.color}` }} aria-hidden="true" />
            {category.name}
          </h2>
          {category.description_text && <p className={styles.sectionDescription}>{category.description_text}</p>}
        </div>
        <Link to={paths.nodeGroup(category.id)} className={styles.sectionLink}>
          {t('nodes.browse.viewAll', { value: formatCount(total, i18n.language) })}
          <ChevronRight strokeWidth={2.5} />
        </Link>
      </header>
      {content}
    </section>
  )
}
