import { ArrowLeft, CircleAlert, ExternalLink, MessagesSquare, Play, ShieldCheck, WifiOff } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { NodeIcon } from '../../components/NodeIcon'
import { Spinner } from '../../components/Spinner'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { formatCount } from '../../lib/format'
import { useOpenLink } from '../../lib/open-link'
import { paths } from '../../lib/routes'
import { PostContent } from '../content/PostContent'
import styles from './Apps.module.css'
import { isAppKind, type AppDetail } from './types'
import { useAppDetail } from './use-apps'

/** Granted to every app and not worth listing. */
const IMPLICIT_SCOPES = new Set(['context'])

/** `/apps/:slug` — one app's page: facts, readme, permissions, and where to run it. */
export function AppDetailPage(): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { slug = '' } = useParams()
  const detail = useAppDetail(slug)

  const toolbar = (
    <header className={styles.toolbar}>
      <Link to={paths.apps()} className={styles.back}>
        <ArrowLeft />
        {t('apps.back')}
      </Link>
    </header>
  )

  let body: React.JSX.Element
  if (detail.isPending) {
    body = (
      <div className={styles.more}>
        <Spinner size={40} />
      </div>
    )
  } else if (detail.isError) {
    if (isApiErrorKind(detail.error, 'notFound')) return <NotFoundPage />
    body = (
      <EmptyState
        icon={isApiErrorKind(detail.error, 'offline') ? <WifiOff /> : <CircleAlert />}
        title={errorMessage(detail.error)}
        action={
          <Button variant="primary" onClick={() => void detail.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    )
  } else {
    body = <AppDetailContent app={detail.data} />
  }

  return (
    <section className={styles.page}>
      {toolbar}
      <div className={styles.scroller}>
        <div className={styles.content}>{body}</div>
      </div>
    </section>
  )
}

function AppDetailContent({ app }: { app: AppDetail }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const openLink = useOpenLink()
  const isService = app.is_service === true || app.surface === 'service'
  const scopes = (app.approved_scopes ?? []).filter((scope) => !IMPLICIT_SCOPES.has(scope))
  const descriptors = app.content_descriptors ?? []
  const webUrl = `${SITE_ORIGIN}/apps/${encodeURIComponent(app.slug)}`
  const surface = isService ? 'service' : app.surface === 'webview' ? 'webview' : 'blocks'

  // Games/applets run in a dedicated, isolated desktop window. The main
  // process resolves webview installs from their home post.
  const openApp = (): void => {
    if (!app.home_url) return
    void window.nodeloc.apps.open({
      name: app.name,
      homeUrl: new URL(app.home_url, SITE_ORIGIN).href,
      surface: app.surface === 'webview' ? 'webview' : 'blocks'
    })
  }

  return (
    <>
      <div className={styles.hero}>
        <NodeIcon name={app.name} logo={app.logo_url ? { id: app.id, url: app.logo_url } : null} size={72} shape="square" />
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            {app.name}
            {isAppKind(app.kind) && <span className={styles.chip}>{t(`apps.kinds.${app.kind}`)}</span>}
          </h1>
          {app.author?.username && (
            <Link to={paths.user(app.author.username)} className={styles.author}>
              {app.author.avatar_template && <Avatar template={app.author.avatar_template} username={app.author.username} size={20} />}
              {t('apps.byAuthor', { username: app.author.username })}
            </Link>
          )}
        </div>
        <div className={styles.actions}>
          {!isService && app.home_url && (
            <Button variant="primary" icon={<Play fill="currentColor" />} onClick={openApp}>
              {t('apps.open')}
            </Button>
          )}
          {app.category_url && (
            <Button icon={<MessagesSquare />} onClick={() => openLink(app.category_url!)}>
              {t('apps.discuss')}
            </Button>
          )}
          <Button variant="ghost" icon={<ExternalLink />} onClick={() => void window.nodeloc.browser.open(webUrl)}>
            {t('apps.viewOnWeb')}
          </Button>
        </div>
      </div>

      {app.description && <p className={styles.description}>{app.description}</p>}

      <dl className={styles.facts}>
        {app.version_number != null && (
          <div>
            <dt>{t('apps.facts.version')}</dt>
            <dd>v{app.version_number}</dd>
          </div>
        )}
        <div>
          <dt>{t('apps.facts.installs')}</dt>
          <dd>{formatCount(app.installs_count ?? 0, i18n.language)}</dd>
        </div>
        <div>
          <dt>{t('apps.facts.kind')}</dt>
          <dd>{t(`apps.surfaces.${surface}`)}</dd>
        </div>
        {app.age_rating != null && (
          <div>
            <dt>{t('apps.facts.ageRating')}</dt>
            <dd>{t('apps.ageRating', { value: app.age_rating })}</dd>
          </div>
        )}
      </dl>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('apps.useTitle')}</h2>
        <p className={styles.muted}>
          {isService ? t('apps.serviceHint') : app.home_url ? t('apps.livesHere') : t('apps.notPlaced')}
        </p>
      </section>

      {app.readme_cooked && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('apps.readme')}</h2>
          <PostContent html={app.readme_cooked} size="reply" />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('apps.permissionsTitle')}</h2>
        {scopes.length > 0 ? (
          <ul className={styles.permissions}>
            {scopes.map((scope) => (
              <li key={scope} className={styles.permission}>
                <ShieldCheck />
                <span>{t(`apps.permissions.${scope.replace(/\./g, '_')}`, { defaultValue: scope })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>{t('apps.noPermissions')}</p>
        )}
        <p className={styles.muted}>{t('apps.sandbox')}</p>
      </section>

      {descriptors.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('apps.contentDescriptors')}</h2>
          <div className={styles.chips}>
            {descriptors.map((descriptor) => (
              <span key={descriptor} className={styles.descriptor}>
                {t(`apps.descriptors.${descriptor}`, { defaultValue: descriptor })}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
