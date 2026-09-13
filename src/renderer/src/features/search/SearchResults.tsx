import { ChevronRight, CircleAlert, Heart, Search, WifiOff } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useEffect, useMemo, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useCategoryIndex } from '../../api/site'
import type { BasicUser, Category, DirectoryApp } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { NodeIcon } from '../../components/NodeIcon'
import { Spinner } from '../../components/Spinner'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { formatCount, formatRelativeTime } from '../../lib/format'
import { paths, type SearchScope } from '../../lib/routes'
import { decodeHtmlEntities } from '../../lib/text'
import { Highlight } from './Highlight'
import styles from './SearchPage.module.css'
import type { SearchResult } from './types'
import { filterApps, useAppsDirectory, useNodeResults, useSearchPosts, useUserSearch } from './use-search'

/** Rows shown per section in the 全部 scope. */
const SECTION_LIMIT = 3
const APP_KINDS = ['game', 'applet', 'bot']

interface ScopeProps {
  /** The trimmed text the user typed, without filter syntax. */
  text: string
  terms: readonly string[]
}

interface PostScopeProps extends ScopeProps {
  /** Text plus filter syntax, as sent to the API. */
  query: string
  onOpenResult: () => void
}

// ---------------------------------------------------------------------------
// Scopes

export function AllResults({ onScope, ...props }: PostScopeProps & { onScope: (scope: SearchScope) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const quick = useNodeResults(props.text)
  const nodes = quick.nodes.slice(0, SECTION_LIMIT)
  const users = (quick.data?.users ?? []).slice(0, SECTION_LIMIT)

  return (
    <>
      <ResultsHeader term={props.text} />
      {quick.isPending ? (
        <RowSkeleton kind="row" count={SECTION_LIMIT} />
      ) : (
        <>
          {nodes.length > 0 && (
            <section className={styles.section}>
              <SectionHeader title={t('search.scopes.nodes')} onViewAll={() => onScope('nodes')} />
              {nodes.map((node) => (
                <NodeRow key={node.id} node={node} terms={props.terms} />
              ))}
            </section>
          )}
          {users.length > 0 && (
            <section className={styles.section}>
              <SectionHeader title={t('search.scopes.users')} onViewAll={() => onScope('users')} />
              {users.map((user) => (
                <UserRow key={user.id} user={user} terms={props.terms} />
              ))}
            </section>
          )}
        </>
      )}
      <PostResults
        {...props}
        heading={<SectionHeader title={t('search.scopes.topics')} onViewAll={() => onScope('topics')} />}
      />
    </>
  )
}

/** 帖子 and 媒体: post hits with infinite loading. */
export function PostResults({ text, terms, query, onOpenResult, heading }: PostScopeProps & { heading?: ReactNode }): React.JSX.Element {
  const search = useSearchPosts(query)
  const categories = useCategoryIndex()
  const { results, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = search

  let body: ReactNode
  if (search.isPending) {
    body = <RowSkeleton kind="post" count={6} />
  } else if (search.isError && results.length === 0) {
    body = <ErrorState error={search.error} onRetry={() => void search.refetch()} />
  } else if (results.length === 0) {
    body = <NoResults description={search.serverError ?? undefined} />
  } else {
    body = (
      <>
        {results.map((result) => (
          <PostRow
            key={result.post.id}
            result={result}
            category={result.topic?.category_id != null ? categories?.byId.get(result.topic.category_id) : undefined}
            terms={terms}
            onOpen={onOpenResult}
          />
        ))}
        <LoadMoreFooter
          hasNextPage={hasNextPage}
          isFetching={isFetchingNextPage}
          isError={isFetchNextPageError}
          fetchNextPage={() => void fetchNextPage()}
        />
      </>
    )
  }

  return (
    <section className={styles.section}>
      {heading ?? <ResultsHeader term={text} count={search.isPending ? undefined : results.length} more={hasNextPage} />}
      {body}
    </section>
  )
}

export function NodeResults({ text, terms }: ScopeProps): React.JSX.Element {
  const { nodes, isPending, isError, error, refetch } = useNodeResults(text)

  let body: ReactNode
  if (isPending) {
    body = <RowSkeleton kind="row" count={6} />
  } else if (nodes.length === 0 && isError) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />
  } else if (nodes.length === 0) {
    body = <NoResults />
  } else {
    body = nodes.map((node) => <NodeRow key={node.id} node={node} terms={terms} />)
  }

  return (
    <section className={styles.section}>
      <ResultsHeader term={text} count={isPending ? undefined : nodes.length} />
      {body}
    </section>
  )
}

export function UserResults({ text, terms }: ScopeProps): React.JSX.Element {
  const { data, isPending, isError, error, refetch } = useUserSearch(text)
  const users = data?.users ?? []

  let body: ReactNode
  if (isPending) {
    body = <RowSkeleton kind="row" count={6} />
  } else if (isError) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />
  } else if (users.length === 0) {
    body = <NoResults />
  } else {
    body = users.map((user) => <UserRow key={user.id} user={user} terms={terms} />)
  }

  return (
    <section className={styles.section}>
      <ResultsHeader term={text} count={isPending || isError ? undefined : users.length} />
      {body}
    </section>
  )
}

export function AppResults({ text, terms }: ScopeProps): React.JSX.Element {
  const { data, isPending, isError, error, refetch } = useAppsDirectory()
  const apps = useMemo(() => filterApps(data ?? [], text), [data, text])

  let body: ReactNode
  if (isPending) {
    body = <RowSkeleton kind="row" count={6} />
  } else if (isError) {
    body = <ErrorState error={error} onRetry={() => void refetch()} />
  } else if (apps.length === 0) {
    body = <NoResults />
  } else {
    body = apps.map((app) => <AppRow key={app.slug} app={app} terms={terms} />)
  }

  return (
    <section className={styles.section}>
      <ResultsHeader term={text} count={isPending || isError ? undefined : apps.length} />
      {body}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Rows

function PostRow({
  result,
  category,
  terms,
  onOpen
}: {
  result: SearchResult
  category?: Category
  terms: readonly string[]
  onOpen: () => void
}): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { post, topic } = result

  const open = (): void => {
    onOpen()
    navigate(paths.topic(post.topic_id, post.post_number))
  }
  // Clicks on the node and author links keep their own behaviour.
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as Element).closest('a, button')) return
    open()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && event.target === event.currentTarget) open()
  }

  return (
    <article className={styles.post} tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} aria-label={topic?.title}>
      <div className={styles.meta}>
        {category && (
          <Link to={paths.node(category.slug)} className={styles.category}>
            <span className={styles.categoryDot} style={{ background: `#${category.color}` }} />
            {category.name}
          </Link>
        )}
        <Link to={paths.user(post.username)} className={styles.author}>
          <Avatar template={post.avatar_template} username={post.username} size={18} />
          {post.username}
        </Link>
        <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString(i18n.language)}>
          {formatRelativeTime(post.created_at, i18n.language)}
        </time>
        {post.post_number > 1 && <span className={styles.floor}>{t('search.results.floor', { value: post.post_number })}</span>}
        <span className={styles.likes} title={t('search.results.likes', { value: post.like_count })}>
          <Heart />
          {formatCount(post.like_count, i18n.language)}
        </span>
      </div>
      {topic && (
        <h3 className={styles.postTitle}>
          <Highlight text={topic.title} terms={terms} />
        </h3>
      )}
      {post.blurb && (
        <p className={styles.blurb}>
          <Highlight text={decodeHtmlEntities(post.blurb)} terms={terms} />
        </p>
      )}
    </article>
  )
}

/** Sections (no parent) open their node group; nodes open the node page. */
const nodeHref = (category: Category): string =>
  category.parent_category_id ? paths.node(category.slug) : paths.nodeGroup(category.id)

function NodeRow({ node, terms }: { node: Category; terms: readonly string[] }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const description = node.description_text ?? node.description_excerpt
  return (
    <Link to={nodeHref(node)} className={styles.row}>
      <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} size={36} />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>
          <Highlight text={node.name} terms={terms} />
        </span>
        {description && <span className={styles.rowDescription}>{decodeHtmlEntities(description)}</span>}
      </span>
      {node.topic_count != null && (
        <span className={styles.rowMeta}>
          {t('search.results.topics', { value: formatCount(node.topic_count, i18n.language) })}
        </span>
      )}
    </Link>
  )
}

function UserRow({ user, terms }: { user: BasicUser; terms: readonly string[] }): React.JSX.Element {
  return (
    <Link to={paths.user(user.username)} className={styles.row}>
      <Avatar template={user.avatar_template} username={user.username} size={36} />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>
          <Highlight text={user.name || user.username} terms={terms} />
        </span>
        {user.name && (
          <span className={styles.rowDescription}>
            @<Highlight text={user.username} terms={terms} />
          </span>
        )}
      </span>
    </Link>
  )
}

function AppRow({ app, terms }: { app: DirectoryApp; terms: readonly string[] }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const open = (): void => {
    void window.nodeloc.browser.open(`${SITE_ORIGIN}/apps/${encodeURIComponent(app.slug)}`)
  }
  return (
    <button type="button" className={styles.row} onClick={open}>
      <NodeIcon name={app.name} logo={app.logo_url ? { id: app.id ?? 0, url: app.logo_url } : null} size={36} shape="square" />
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>
          <Highlight text={app.name} terms={terms} />
          {app.kind && APP_KINDS.includes(app.kind) && <span className={styles.kind}>{t(`search.appKinds.${app.kind}`)}</span>}
        </span>
        {app.description && (
          <span className={styles.rowDescription}>
            <Highlight text={app.description} terms={terms} />
          </span>
        )}
      </span>
      {app.installs_count != null && (
        <span className={styles.rowMeta}>
          {t('search.results.installs', { value: formatCount(app.installs_count, i18n.language) })}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// States

function ResultsHeader({ term, count, more = false }: { term: string; count?: number; more?: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <header className={styles.resultsHeader}>
      <h2 className={styles.resultsTitle}>{t('search.results.header', { term })}</h2>
      {count !== undefined && (
        <span className={styles.resultsCount}>
          {t(more ? 'search.results.countMore' : 'search.results.count', { value: count })}
        </span>
      )}
    </header>
  )
}

function SectionHeader({ title, onViewAll }: { title: string; onViewAll: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <header className={styles.sectionHeader}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <Button variant="ghost" size="sm" onClick={onViewAll}>
        {t('search.results.viewAll')}
        <ChevronRight />
      </Button>
    </header>
  )
}

function NoResults({ description }: { description?: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={<Search />}
      title={t('search.results.empty')}
      description={description ?? t('search.results.emptyHint')}
    />
  )
}

/** Search is rate limited per IP, so 429 gets an explanation along with the retry. */
function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  return (
    <EmptyState
      icon={isApiErrorKind(error, 'offline') ? <WifiOff /> : <CircleAlert />}
      title={errorMessage(error)}
      description={isApiErrorKind(error, 'rateLimited') ? t('search.rateLimitedHint') : undefined}
      action={
        <Button variant="primary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  )
}

const LINE_WIDTHS = [0.82, 0.64, 0.9, 0.56, 0.74]

function RowSkeleton({ kind, count }: { kind: 'post' | 'row'; count: number }): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.skeleton}>
      {Array.from({ length: count }, (_, index) =>
        kind === 'post' ? (
          <div key={index} className={styles.skeletonPost}>
            <SkeletonLine width={0.32} height={11} />
            <SkeletonLine width={LINE_WIDTHS[index % LINE_WIDTHS.length]} height={16} />
            <SkeletonLine width={0.95} height={12} />
            <SkeletonLine width={0.6} height={12} />
          </div>
        ) : (
          <div key={index} className={styles.skeletonRow}>
            <SkeletonCircle size={36} />
            <div className={styles.skeletonBody}>
              <SkeletonLine width={LINE_WIDTHS[index % LINE_WIDTHS.length] * 0.4} height={14} />
              <SkeletonLine width={0.6} height={11} />
            </div>
          </div>
        )
      )}
    </SkeletonGroup>
  )
}

interface LoadMoreFooterProps {
  hasNextPage: boolean
  isFetching: boolean
  isError: boolean
  fetchNextPage: () => void
}

/** Loads the next page as the footer nears the viewport; the button stays for keyboard users and retries. */
function LoadMoreFooter({ hasNextPage, isFetching, isError, fetchNextPage }: LoadMoreFooterProps): React.JSX.Element {
  const { t } = useTranslation()
  const footer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = footer.current
    // A failed page waits for the retry button, so a 429 isn't hammered.
    if (!element || !hasNextPage || isFetching || isError) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchNextPage()
    }, { rootMargin: '600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isFetching, isError, fetchNextPage])

  return (
    <div ref={footer} className={styles.footer}>
      {isFetching ? (
        <Spinner size={24} />
      ) : isError ? (
        <Button size="sm" onClick={fetchNextPage}>
          {t('search.results.loadMoreFailed')} · {t('common.retry')}
        </Button>
      ) : hasNextPage ? (
        <Button size="sm" onClick={fetchNextPage}>
          {t('search.results.loadMore')}
        </Button>
      ) : (
        <span className={styles.end}>{t('search.results.end')}</span>
      )}
    </div>
  )
}
