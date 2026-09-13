import { useQuery } from '@tanstack/react-query'
import { Blocks, ChevronUp, ExternalLink, List } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { isApiErrorKind } from '../../../api/client'
import { useFeatures } from '../../../api/site'
import { Button } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { absoluteUrl } from '../../../lib/discourse'
import { useOpenLink } from '../../../lib/open-link'
import { paths } from '../../../lib/routes'
import { extraKeys, modRequest, type AppRun, type AppInstallActivity, type NodeAppInstall, type NodeAppsResponse } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { AppSettingsForm } from './app-settings-form'
import { extraStyles as styles, formatShortTime, SectionHeader, useConfirm, useErrorToast } from './extra-ui'

/** The apps (service bots) at work in the node, their settings, and the ones that could be added. */
export function AppsSection({ category }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const features = useFeatures()
  const toastError = useErrorToast()
  const [confirm, confirmElement] = useConfirm()
  const endpoint = `/apps/nodes/${category.id}/installs`

  const query = useQuery({
    queryKey: extraKeys.apps(category.id),
    queryFn: () => modRequest<NodeAppsResponse>({ path: `${endpoint}.json` }),
    enabled: features?.apps !== false,
    staleTime: 30_000,
    retry: (count, error) => !isApiErrorKind(error, 'notFound', 'forbidden') && count < 2
  })

  const [chosenId, setChosenId] = useState<number | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const [installDraft, setInstallDraft] = useState<Record<string, unknown>>({})
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [showingActivity, setShowingActivity] = useState<number | null>(null)

  const unavailable = features?.apps === false || (query.isError && isApiErrorKind(query.error, 'notFound'))

  const header = (
    <SectionHeader
      title={t('nodeModExtra.apps.title')}
      lede={t('nodeModExtra.apps.lede')}
      actions={
        !unavailable && (
          <Button icon={<ExternalLink />} onClick={() => navigate(paths.apps())}>
            {t('nodeModExtra.apps.browse')}
          </Button>
        )
      }
    />
  )

  if (unavailable) {
    return (
      <div className={styles.section}>
        {header}
        <EmptyState icon={<Blocks />} title={t('nodeModExtra.apps.unavailable')} />
      </div>
    )
  }

  const installs = query.data?.installs ?? []
  const running = new Set(installs.map((install) => install.app_id))
  const installable = (query.data?.available ?? []).filter((app) => !running.has(app.id))
  const chosen = installable.find((app) => app.id === chosenId) ?? installable[0]
  const chosenSchema = chosen?.settings_schema ?? []
  const needsSettings = chosenSchema.length > 0

  const install = async (): Promise<void> => {
    if (!chosen) return
    if (needsSettings && !configuring) {
      setConfiguring(true)
      return
    }
    setBusy(true)
    try {
      await modRequest({
        method: 'POST',
        path: `${endpoint}.json`,
        json: { install: needsSettings ? { app_id: chosen.id, config: installDraft } : { app_id: chosen.id } }
      })
      showToast(t('nodeModExtra.apps.installed', { name: chosen.name }), 'success')
      setConfiguring(false)
      setInstallDraft({})
      setChosenId(null)
      await query.refetch()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = async (target: NodeAppInstall): Promise<void> => {
    setBusy(true)
    try {
      await modRequest({ method: 'PUT', path: `${endpoint}/${target.id}.json`, json: { install: { config: draft } } })
      showToast(t('nodeModExtra.apps.settingsSaved'), 'success')
      setEditing(null)
      setDraft({})
      await query.refetch()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const stop = async (target: NodeAppInstall): Promise<void> => {
    const ok = await confirm({ message: t('nodeModExtra.apps.confirmStop', { name: target.app_name }), confirmLabel: t('nodeModExtra.apps.stop') })
    if (!ok) return
    setBusy(true)
    try {
      await modRequest({ method: 'DELETE', path: `${endpoint}/${target.id}.json` })
      await query.refetch()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.section}>
      {header}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.apps.atWork')}</h2>
        {query.isPending ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : query.isError ? (
          <EmptyState
            title={t('nodeModExtra.common.loadFailed')}
            action={<Button onClick={() => void query.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
          />
        ) : installs.length === 0 ? (
          <p className={styles.hint}>{t('nodeModExtra.apps.nothingRunning')}</p>
        ) : (
          <ul className={styles.list} style={{ background: 'var(--bg)' }}>
            {installs.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>
                    {item.app_name}
                    {item.author_username && <span className={styles.itemMeta}>{t('nodeModExtra.apps.byAuthor', { username: item.author_username })}</span>}
                    {!item.active && <span className={styles.badge}>{t('nodeModExtra.apps.stopped')}</span>}
                  </div>

                  {item.activity && <ActivitySummary activity={item.activity} />}

                  {item.activity && (
                    <div className={styles.row}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={showingActivity === item.id ? <ChevronUp /> : <List />}
                        onClick={() => setShowingActivity(showingActivity === item.id ? null : item.id)}
                      >
                        {showingActivity === item.id ? t('nodeModExtra.apps.activity.hide') : t('nodeModExtra.apps.activity.show')}
                      </Button>
                    </div>
                  )}
                  {showingActivity === item.id && <ActivityLog categoryId={category.id} installId={item.id} />}

                  <div className={styles.row}>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(item.id)
                        setDraft({ ...(item.settings ?? {}) })
                      }}
                    >
                      {t('nodeModExtra.apps.settings')}
                    </Button>
                    <Button size="sm" variant="ghost" className={styles.dangerIcon} disabled={busy} onClick={() => void stop(item)}>
                      {t('nodeModExtra.apps.stop')}
                    </Button>
                  </div>

                  {editing === item.id && (
                    <div className={styles.subBlock} style={{ gap: 'var(--space-4)', background: 'var(--surface)' }}>
                      {item.settings_schema?.length ? (
                        <AppSettingsForm schema={item.settings_schema} settings={item.settings} onChange={setDraft} />
                      ) : (
                        <p className={styles.hint}>{t('nodeModExtra.apps.noSettings')}</p>
                      )}
                      <div className={styles.row}>
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => void saveSettings(item)}>
                          {t('nodeModExtra.apps.saveSettings')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {t('nodeModExtra.common.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {query.isSuccess && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('nodeModExtra.apps.add')}</h2>
          {installable.length > 0 && chosen ? (
            <>
              <p className={styles.hint}>{t('nodeModExtra.apps.addHint')}</p>
              <div className={styles.row}>
                <select
                  className={`${styles.select} ${styles.grow}`}
                  aria-label={t('nodeModExtra.apps.chooseApp')}
                  value={chosen.id}
                  onChange={(event) => {
                    setChosenId(Number(event.target.value))
                    setConfiguring(false)
                    setInstallDraft({})
                  }}
                >
                  {installable.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
                <Button variant="primary" disabled={busy || configuring} onClick={() => void install()}>
                  {needsSettings ? t('nodeModExtra.apps.configure') : t('nodeModExtra.apps.install')}
                </Button>
              </div>
              {configuring && (
                <div className={styles.subBlock} style={{ gap: 'var(--space-4)' }}>
                  <p className={styles.hint}>{t('nodeModExtra.apps.configureFirst', { name: chosen.name })}</p>
                  <AppSettingsForm key={chosen.id} schema={chosenSchema} settings={installDraft} onChange={setInstallDraft} />
                  <div className={styles.row}>
                    <Button variant="primary" disabled={busy} onClick={() => void install()}>
                      {t('nodeModExtra.apps.install')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setConfiguring(false)
                        setInstallDraft({})
                      }}
                    >
                      {t('nodeModExtra.common.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className={styles.hint}>{t('nodeModExtra.apps.nothingToAdd')}</p>
          )}
        </section>
      )}
      {confirmElement}
    </div>
  )
}

function ActivitySummary({ activity }: { activity: AppInstallActivity }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const outcome =
    activity.last_outcome === 'ok'
      ? t('nodeModExtra.apps.activity.ok')
      : t('nodeModExtra.apps.activity.failed', { code: activity.last_error_code || activity.last_outcome || '?' })
  return (
    <>
      <span className={styles.itemMeta}>
        {activity.last_run_at
          ? `${t('nodeModExtra.apps.activity.lastRun', { time: formatShortTime(activity.last_run_at, i18n.language), outcome })} · ${t('nodeModExtra.apps.activity.today', { runs: activity.runs_24h, effects: activity.effects_24h })}`
          : t('nodeModExtra.apps.activity.never')}
      </span>
      {activity.last_fetch_error && (
        <span className={styles.errorText}>
          {t('nodeModExtra.apps.activity.fetchError', {
            host: activity.last_fetch_error.host,
            code: activity.last_fetch_error.code,
            time: formatShortTime(activity.last_fetch_error.at, i18n.language)
          })}
        </span>
      )}
    </>
  )
}

/** What a bot has been doing, most recent first. */
function ActivityLog({ categoryId, installId }: { categoryId: number; installId: number }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const openLink = useOpenLink()
  const query = useQuery({
    queryKey: extraKeys.appActivity(categoryId, installId),
    queryFn: () => modRequest<{ runs: AppRun[] }>({ path: `/apps/nodes/${categoryId}/installs/${installId}/activity.json` }),
    staleTime: 15_000
  })

  if (query.isPending) return <Spinner size={18} />
  if (query.isError) return <span className={styles.errorText}>{t('nodeModExtra.common.loadFailed')}</span>
  const runs = query.data.runs ?? []
  if (runs.length === 0) return <p className={styles.hint}>{t('nodeModExtra.apps.activity.never')}</p>

  const label = (run: AppRun): string => {
    if (run.handler === 'onTrigger' && run.event) {
      return t(`nodeModExtra.apps.activity.events.${run.event}`, { defaultValue: run.event })
    }
    return t(`nodeModExtra.apps.activity.handlers.${String(run.handler).replace(/\./g, '_')}`, { defaultValue: run.handler })
  }

  const outcome = (run: AppRun): string | null => {
    if (run.handler === 'http.fetch') {
      return run.outcome === 'ok'
        ? t('nodeModExtra.apps.activity.fetchOk', { host: run.host ?? '', status: run.status ?? '' })
        : t('nodeModExtra.apps.activity.fetchFailed', { host: run.host ?? '', code: run.error_code ?? '' })
    }
    if (run.outcome !== 'ok') return t('nodeModExtra.apps.activity.failed', { code: run.error_code || run.outcome })
    if (run.rejected) return t('nodeModExtra.apps.activity.rejected', { code: run.rejected.code })
    if (!run.effects?.length) return t('nodeModExtra.apps.activity.nothing')
    return null
  }

  return (
    <ol className={styles.runs}>
      {runs.map((run) => (
        <li key={run.id} className={cx(styles.run, run.outcome !== 'ok' && styles.runFailed)}>
          <span className={styles.time}>{formatShortTime(run.at, i18n.language)}</span>
          <strong>{label(run)}</strong>
          {outcome(run) && <span>{outcome(run)}</span>}
          {(run.effects ?? []).map((effect, index) => {
            const text = t(`nodeModExtra.apps.activity.effects.${effect.type.replace(/\./g, '_')}`, {
              defaultValue: effect.type,
              key: effect.key ?? '',
              host: effect.url ?? '',
              amount: effect.amount ?? '',
              title: effect.title ?? '',
              label: effect.label ?? '',
              tags: effect.tags ?? '',
              job: effect.job_key ?? '',
              room: effect.room ?? '',
              days: effect.days ?? ''
            })
            const href = effect.post_id ? `/p/${effect.post_id}` : effect.topic_id ? `/t/${effect.topic_id}` : null
            return (
              <span key={index}>
                {text}
                {href && (
                  <>
                    {' '}
                    <button type="button" className={styles.linkButton} onClick={() => openLink(absoluteUrl(href))}>
                      {effect.post_id
                        ? t('nodeModExtra.apps.activity.postRef', { id: effect.post_id })
                        : t('nodeModExtra.apps.activity.topicRef', { id: effect.topic_id })}
                    </button>
                  </>
                )}
              </span>
            )
          })}
          {run.error && <span className={styles.errorText}>{run.error}</span>}
        </li>
      ))}
    </ol>
  )
}
