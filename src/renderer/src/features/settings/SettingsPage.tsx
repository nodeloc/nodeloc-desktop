import { NOTIFICATION_CATEGORIES, type AppPreferences, type NotificationSettings, type UpdateState } from '@shared/bridge'
import { ExternalLink, LogIn, RefreshCw } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { Switch } from '../../components/Switch'
import { ThemeSwitcher } from '../../layout/ThemeSwitcher'
import { useSignInDialog } from '../account/sign-in-store'
import { useAuthState, useCurrentUser } from '../account/use-session'
import { ReadingModeSwitch } from '../feed/ReadingModeSwitch'
import { LanguageSwitcher } from './LanguageSwitcher'
import { APP_PREFERENCES_KEY } from './preferences'
import styles from './SettingsPage.module.css'

const NOTIFICATIONS_KEY = ['desktop-notification-settings'] as const

/** Device-level settings. Account preferences live on the website for now. */
export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.heading}>{t('settings.title')}</h1>
        <AppearanceSection />
        <NotificationSection />
        <WindowSection />
        <AccountSection />
        <AboutSection />
      </div>
    </div>
  )
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {intro && <p className={styles.intro}>{intro}</p>}
      <div className={styles.card}>{children}</div>
    </section>
  )
}

function AppearanceSection(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Section title={t('settings.appearance.title')}>
      <div className={styles.field}>
        <span>{t('settings.appearance.language')}</span>
        <div className={styles.control}>
          <LanguageSwitcher />
        </div>
      </div>
      <div className={styles.field}>
        <span>{t('settings.appearance.theme')}</span>
        <div className={styles.control}>
          <ThemeSwitcher />
        </div>
      </div>
      <div className={styles.field}>
        <span>{t('settings.appearance.readingMode')}</span>
        <ReadingModeSwitch />
      </div>
    </Section>
  )
}

function NotificationSection(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => window.nodeloc.notifications.getSettings(), staleTime: Infinity })
  const update = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => window.nodeloc.notifications.updateSettings(patch),
    onSuccess: (next) => queryClient.setQueryData(NOTIFICATIONS_KEY, next)
  })

  const value = settings.data
  return (
    <Section title={t('settings.notifications.title')} intro={t('settings.notifications.intro')}>
      {value && (
        <>
          <Switch checked={value.enabled} onChange={(enabled) => update.mutate({ enabled })} label={t('settings.notifications.enabled')} />
          <Switch
            checked={value.sound}
            disabled={!value.enabled}
            onChange={(sound) => update.mutate({ sound })}
            label={t('settings.notifications.sound')}
          />
          {NOTIFICATION_CATEGORIES.map((category) => (
            <Switch
              key={category}
              checked={value.categories[category]}
              disabled={!value.enabled}
              onChange={(checked) => update.mutate({ categories: { ...value.categories, [category]: checked } })}
              label={t(`settings.notifications.categories.${category}`)}
            />
          ))}
        </>
      )}
    </Section>
  )
}

function WindowSection(): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const info = useQuery({ queryKey: ['app-info'], queryFn: () => window.nodeloc.app.getInfo(), staleTime: Infinity })
  const preferences = useQuery({ queryKey: APP_PREFERENCES_KEY, queryFn: () => window.nodeloc.app.getPreferences(), staleTime: Infinity })
  const update = useMutation({
    mutationFn: (patch: Partial<AppPreferences>) => window.nodeloc.app.updatePreferences(patch),
    onSuccess: (next) => queryClient.setQueryData(APP_PREFERENCES_KEY, next)
  })

  const value = preferences.data
  const packaged = info.data?.isPackaged ?? false
  return (
    <Section title={t('settings.window.title')}>
      {value && (
        <>
          <Switch
            checked={value.closeToTray}
            onChange={(closeToTray) => update.mutate({ closeToTray })}
            label={t('settings.window.closeToTray')}
            description={t('settings.window.closeToTrayHint')}
          />
          <Switch
            checked={value.launchAtLogin}
            disabled={!packaged}
            onChange={(launchAtLogin) => update.mutate({ launchAtLogin })}
            label={t('settings.window.launchAtLogin')}
            description={packaged ? t('settings.window.launchAtLoginHint') : t('settings.window.devOnly')}
          />
        </>
      )}
    </Section>
  )
}

function AccountSection(): React.JSX.Element {
  const { t } = useTranslation()
  const auth = useAuthState()
  const user = useCurrentUser()
  const showSignIn = useSignInDialog((state) => state.show)
  const username = user?.username ?? auth.username

  return (
    <Section title={t('settings.account.title')}>
      {auth.status === 'signedIn' && username ? (
        <div className={styles.account}>
          <Avatar template={user?.avatar_template} username={username} size={40} />
          <span className={styles.accountName}>{t('settings.account.signedInAs', { username })}</span>
          <Button
            size="sm"
            icon={<ExternalLink />}
            onClick={() => void window.nodeloc.browser.open(`${SITE_ORIGIN}/u/${encodeURIComponent(username)}/preferences`)}
          >
            {t('settings.account.sitePreferences')}
          </Button>
        </div>
      ) : (
        <div className={styles.account}>
          <span className={styles.accountName}>{t('settings.account.signedOut')}</span>
          <Button size="sm" variant="primary" icon={<LogIn strokeWidth={2.5} />} onClick={showSignIn}>
            {t('settings.account.signIn')}
          </Button>
        </div>
      )}
    </Section>
  )
}

function AboutSection(): React.JSX.Element {
  const { t } = useTranslation()
  const info = useQuery({ queryKey: ['app-info'], queryFn: () => window.nodeloc.app.getInfo(), staleTime: Infinity })
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })

  useEffect(() => {
    let active = true
    void window.nodeloc.updates.getState().then((state) => {
      if (active) setUpdate(state)
    })
    const unsubscribe = window.nodeloc.events.onUpdateState(setUpdate)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const busy = update.status === 'checking' || update.status === 'downloading' || update.status === 'installing'
  const statusKey = update.status === 'error' ? `settings.about.updateErrors.${update.error ?? 'network'}` : `settings.about.updateStatus.${update.status}`
  return (
    <Section title={t('settings.about.title')}>
      <div className={styles.account}>
        <span className={styles.accountName}>NodeLoc Desktop · {t('settings.about.version', { version: info.data?.version ?? '' })}</span>
        <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={() => void window.nodeloc.shell.openExternal(SITE_ORIGIN)}>
          {t('settings.about.website')}
        </Button>
      </div>
      <div className={styles.updateRow}>
        <div className={styles.updateCopy}>
          <span>{t(statusKey, { version: update.version, progress: update.progress ?? 0 })}</span>
          {update.status === 'downloading' && (
            <div className={styles.updateTrack} aria-label={t('settings.about.downloadProgress', { progress: update.progress ?? 0 })}>
              <span style={{ width: `${update.progress ?? 0}%` }} />
            </div>
          )}
        </div>
        <Button
          size="sm"
          disabled={busy || update.status === 'unavailable'}
          icon={<RefreshCw className={busy ? styles.spinning : undefined} />}
          onClick={() => void window.nodeloc.updates.check().then(setUpdate)}
        >
          {t('settings.about.checkForUpdates')}
        </Button>
      </div>
    </Section>
  )
}
