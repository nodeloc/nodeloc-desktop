import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PROFILE_TABS, paths, type ProfileTab } from '../../lib/routes'
import styles from './ProfileTabs.module.css'

/** Each tab is its own route, so back/forward and deep links land on the right tab. */
export function ProfileTabs({ username, active }: { username: string; active: ProfileTab }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <nav className={styles.tabs} aria-label={t('profile.title')}>
      {PROFILE_TABS.map((tab) => (
        <Link
          key={tab}
          to={paths.user(username, tab)}
          className={styles.tab}
          aria-current={tab === active ? 'page' : undefined}
        >
          {t(`profile.tabs.${tab}`)}
        </Link>
      ))}
    </nav>
  )
}
