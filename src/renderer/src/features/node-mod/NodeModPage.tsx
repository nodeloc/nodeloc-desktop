import { ArrowLeft, CircleAlert, LockKeyhole, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { paths } from '../../lib/routes'
import { useSignInDialog } from '../account/sign-in-store'
import { NodeLoadError } from '../nodes/NodeLoadError'
import styles from './NodeModPage.module.css'
import { isModSectionVisible, MOD_SECTIONS } from './sections'
import { useModTools } from './use-mod-tools'

/** `/n/:slug/mod` and `/n/:slug/mod/:section`: one section of a node's mod tools. */
export function NodeModPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const showSignIn = useSignInDialog((state) => state.show)
  const { slug = '', section: sectionKey = 'overview' } = useParams()
  const { node, mod } = useModTools(slug)

  const section = MOD_SECTIONS.find((entry) => entry.key === sectionKey)
  const category = node.data?.category

  if (node.isError && isApiErrorKind(node.error, 'notFound')) return <NotFoundPage />

  let body: React.JSX.Element
  if (node.isError) {
    body = <NodeLoadError error={node.error} onRetry={() => void node.refetch()} />
  } else if (!category || (mod.isPending && !mod.isError)) {
    body = <ModPageSkeleton />
  } else if (mod.isError) {
    if (isApiErrorKind(mod.error, 'unauthorized')) {
      body = (
        <EmptyState
          icon={<LockKeyhole />}
          title={t('nodeMod.signIn')}
          action={
            <Button variant="primary" onClick={showSignIn}>
              {t('account.signIn')}
            </Button>
          }
        />
      )
    } else if (isApiErrorKind(mod.error, 'forbidden')) {
      body = (
        <EmptyState
          icon={<ShieldOff />}
          title={t('nodeMod.forbidden.title')}
          description={t('nodeMod.forbidden.description')}
          action={<Button onClick={() => navigate(paths.node(slug))}>{t('nodeMod.back')}</Button>}
        />
      )
    } else {
      body = (
        <EmptyState
          icon={<CircleAlert />}
          title={errorMessage(mod.error)}
          action={
            <Button variant="primary" onClick={() => void mod.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      )
    }
  } else {
    // Unknown sections, and owner-only ones for a moderator, land on the overview (as on the web).
    if (!section || !isModSectionVisible(section, mod.data, category)) {
      return <Navigate to={paths.nodeMod(slug)} replace />
    }
    const Section = section.component
    body = (
      <ErrorBoundary resetKey={`${slug}:${section.key}`}>
        <Section category={category} mod={mod.data} />
      </ErrorBoundary>
    )
  }

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>
          {section && <span className={styles.titleIcon}>{section.icon}</span>}
          <span className={styles.titleText}>{section ? t(section.label) : t('nodeMod.title')}</span>
        </h1>
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => navigate(paths.node(slug))}>
          {t('nodeMod.back')}
        </Button>
      </header>
      <div className={styles.scroller}>
        <div className={styles.content}>{body}</div>
      </div>
    </section>
  )
}

function ModPageSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.skeleton}>
      <SkeletonLine width={0.6} />
      <SkeletonLine width={1} height={88} />
      <SkeletonLine width={1} height={160} />
      <SkeletonLine width={0.8} />
    </SkeletonGroup>
  )
}
