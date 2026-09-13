import { CircleAlert, ExternalLink, LayoutGrid, WifiOff } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { NodeIcon } from '../../components/NodeIcon'
import { Spinner } from '../../components/Spinner'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './Apps.module.css'
import { APP_KINDS, isAppKind, type AppDetail, type AppKind } from './types'
import { useAppsDirectoryPages } from './use-apps'

/** `/apps` — the community apps directory (APPS-01). */
export function AppsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [params, setParams] = useSearchParams()
  const kindParam = params.get('kind')
  const kind: AppKind | null = isAppKind(kindParam) ? kindParam : null
  const directory = useAppsDirectoryPages(kind)

  const pages = directory.data?.pages ?? []
  const apps = pages.flatMap((page) => page.apps)
  const counts = pages[0]?.counts
  const allCount = counts ? APP_KINDS.reduce((sum, key) => sum + (counts[key] ?? 0), 0) : undefined

  const selectKind = (next: AppKind | null): void => {
    setParams(next ? { kind: next } : {}, { replace: true })
  }

  let body: React.JSX.Element
  if (directory.isPending) {
    body = (
      <div className={styles.grid} aria-busy="true">
        {Array.from({ length: 9 }, (_, index) => (
          <div key={index} className={styles.skeletonCard} />
        ))}
      </div>
    )
  } else if (directory.isError && apps.length === 0) {
    body = (
      <EmptyState
        icon={isApiErrorKind(directory.error, 'offline') ? <WifiOff /> : <CircleAlert />}
        title={errorMessage(directory.error)}
        action={
          <Button variant="primary" onClick={() => void directory.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  } else if (apps.length === 0) {
    body = <EmptyState icon={<LayoutGrid />} title={t('apps.empty')} />
  } else {
    body = (
      <>
        <div className={styles.grid}>
          {apps.map((app) => (
            <AppCard key={app.id ?? app.slug} app={app} />
          ))}
        </div>
        <div className={styles.more}>
          {directory.isFetchingNextPage && <Spinner size={24} />}
          {!directory.isFetchingNextPage && directory.hasNextPage && (
            <Button onClick={() => void directory.fetchNextPage()}>
              {directory.isFetchNextPageError ? `${t('feed.loadMoreFailed')} · ${t('common.retry')}` : t('apps.loadMore')}
            </Button>
          )}
        </div>
      </>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>
          <LayoutGrid />
          {t('apps.title')}
        </h1>
        <Button
          size="sm"
          variant="ghost"
          icon={<ExternalLink />}
          onClick={() => void window.nodeloc.browser.open(`${SITE_ORIGIN}/apps`)}
        >
          {t('apps.openWebDirectory')}
        </Button>
      </header>
      <div className={styles.scroller}>
        <div className={styles.content}>
          <p className={styles.lede}>{t('apps.lede')}</p>
          <div className={styles.tabs} role="tablist">
            <KindTab selected={kind === null} count={allCount} onSelect={() => selectKind(null)}>
              {t('apps.kinds.all')}
            </KindTab>
            {APP_KINDS.map((key) => (
              <KindTab key={key} selected={kind === key} count={counts?.[key]} onSelect={() => selectKind(key)}>
                {t(`apps.kinds.${key}`)}
              </KindTab>
            ))}
          </div>
          {body}
        </div>
      </div>
    </section>
  )
}

function KindTab({
  selected,
  count,
  onSelect,
  children
}: {
  selected: boolean
  count?: number
  onSelect: () => void
  children: string
}): React.JSX.Element {
  const { i18n } = useTranslation()
  return (
    <button type="button" role="tab" aria-selected={selected} className={styles.tab} onClick={onSelect}>
      {children}
      {count !== undefined && <span className={styles.tabCount}>{formatCount(count, i18n.language)}</span>}
    </button>
  )
}

function AppCard({ app }: { app: AppDetail }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  return (
    <Link to={paths.app(app.slug)} className={styles.card}>
      <NodeIcon name={app.name} logo={app.logo_url ? { id: app.id, url: app.logo_url } : null} size={48} shape="square" />
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          <span>{app.name}</span>
          {isAppKind(app.kind) && <span className={styles.chip}>{t(`apps.kinds.${app.kind}`)}</span>}
        </div>
        <p className={styles.cardDescription}>{app.description || t('apps.noDescription')}</p>
        <div className={styles.cardMeta}>
          {t('apps.installs', { value: formatCount(app.installs_count ?? 0, i18n.language) })}
          {app.author?.username && ` · ${app.author.username}`}
        </div>
      </div>
    </Link>
  )
}
