import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useCategoryIndex, useSite } from '../../api/site'
import { Button, IconButton } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './NodeBrowse.module.css'
import { NodeCard, NodeCardSkeletons, NodeGrid } from './NodeCard'
import { NodeLoadError } from './NodeLoadError'
import { useInView } from './use-in-view'
import { uniqueNodes, useSectionNodes } from './use-node-directory'

/** `/nodes/:parentId`: every node in one top-level section. */
export function NodeGroupPage(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { parentId = '' } = useParams()
  const id = /^\d+$/.test(parentId) ? Number(parentId) : null

  const site = useSite()
  const index = useCategoryIndex()
  const section = id !== null ? index?.byId.get(id) : undefined

  const nodes = useSectionNodes(id ?? 0, id !== null)
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = nodes
  const list = useMemo(() => uniqueNodes(nodes.data?.pages.map((page) => page.communities) ?? []), [nodes.data])
  const total = nodes.data?.pages[0]?.meta.total

  // Auto-load the next page as the end of the grid scrolls near.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)
  const nearEnd = useInView(sentinel, scroller, '800px')
  useEffect(() => {
    if (nearEnd && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [nearEnd, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  const isSection = section !== undefined && !section.parent_category_id
  if (id === null || (index && !isSection) || isApiErrorKind(nodes.error, 'notFound')) return <NotFoundPage />

  let title: React.JSX.Element
  if (section) {
    title = (
      <>
        <span className={styles.dot} style={{ background: `#${section.color}` }} aria-hidden="true" />
        <span className={styles.titleText}>{section.name}</span>
      </>
    )
  } else if (site.isError) {
    title = <span className={styles.titleText}>{t('nav.browseNodes')}</span>
  } else {
    title = (
      <SkeletonGroup>
        <SkeletonLine width={1} height={16} />
      </SkeletonGroup>
    )
  }

  let body: React.JSX.Element
  if (nodes.data) {
    body =
      list.length > 0 ? (
        <>
          <NodeGrid>
            {list.map((node) => (
              <NodeCard key={node.id} node={node} />
            ))}
          </NodeGrid>
          <div ref={setSentinel} className={styles.footer}>
            {isFetchingNextPage && <Spinner size={24} />}
            {isFetchNextPageError && (
              <Button size="sm" onClick={() => void fetchNextPage()}>
                {t('nodes.loadMoreFailed')} · {t('common.retry')}
              </Button>
            )}
            {!hasNextPage && !isFetchNextPageError && <span className={styles.end}>{t('feed.end')}</span>}
          </div>
        </>
      ) : (
        <EmptyState icon={<LayoutGrid />} title={t('nodes.group.empty')} />
      )
  } else if (nodes.isError) {
    body = <NodeLoadError error={nodes.error} onRetry={() => void nodes.refetch()} />
  } else {
    body = <NodeCardSkeletons count={12} />
  }

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <IconButton label={t('nodes.group.back')} onClick={() => navigate(paths.nodes())}>
          <ArrowLeft />
        </IconButton>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div ref={setScroller} className={styles.scroller}>
        <div className={styles.content}>
          {(section?.description_text || total !== undefined) && (
            <div className={styles.intro}>
              {section?.description_text && <p>{section.description_text}</p>}
              {total !== undefined && (
                <strong>{t('nodes.group.total', { value: formatCount(total, i18n.language) })}</strong>
              )}
            </div>
          )}
          <div className={styles.section}>{body}</div>
        </div>
      </div>
    </section>
  )
}
