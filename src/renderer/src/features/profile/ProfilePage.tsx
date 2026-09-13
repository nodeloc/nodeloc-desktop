import { CircleAlert, CircleUser, EyeOff, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { isApiErrorKind } from '../../api/client'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { PROFILE_TABS, paths, type ProfileTab } from '../../lib/routes'
import { ActivityList } from './ActivityList'
import { BadgeGrid } from './BadgeGrid'
import { PointsHistory } from './PointsHistory'
import { ProfileHeader, ProfileHeaderSkeleton } from './ProfileHeader'
import styles from './ProfilePage.module.css'
import { ProfileSide } from './ProfileSide'
import { ProfileStats } from './ProfileStats'
import { ProfileTabs } from './ProfileTabs'
import { useProfile } from './use-profile'

const isProfileTab = (value: string): value is ProfileTab => (PROFILE_TABS as readonly string[]).includes(value)

export function ProfilePage(): React.JSX.Element {
  const { username, tab = 'activity' } = useParams()
  if (!username || !isProfileTab(tab)) return <NotFoundPage />
  // Keyed so opening another user starts at the top with fresh local state.
  return <ProfileView key={username} username={username} tab={tab} />
}

function ProfileView({ username, tab }: { username: string; tab: ProfileTab }): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const profile = useProfile(username)

  if (profile.isPending) {
    return (
      <div className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.main}>
            <ProfileHeaderSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (profile.isError) {
    const notFound = isApiErrorKind(profile.error, 'notFound')
    return (
      <div className={styles.page}>
        {notFound ? (
          <EmptyState
            icon={<CircleUser />}
            title={t('profile.notFound')}
            description={t('profile.notFoundDescription')}
            action={
              <Button variant="primary" onClick={() => navigate(paths.home())}>
                {t('profile.backHome')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={isApiErrorKind(profile.error, 'offline') ? <WifiOff /> : <CircleAlert />}
            title={errorMessage(profile.error)}
            action={
              <Button variant="primary" onClick={() => void profile.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        )}
      </div>
    )
  }

  const { user } = profile.data

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <ProfileHeader user={user} />
          {user.profile_hidden ? (
            <EmptyState icon={<EyeOff />} title={t('profile.hidden')} />
          ) : (
            <>
              <ProfileStats username={username} />
              <ProfileTabs username={username} active={tab} />
              <TabContent username={username} tab={tab} />
            </>
          )}
        </div>
        {!user.profile_hidden && <ProfileSide username={username} />}
      </div>
    </div>
  )
}

function TabContent({ username, tab }: { username: string; tab: ProfileTab }): React.JSX.Element {
  switch (tab) {
    case 'points':
      return <PointsHistory username={username} />
    case 'badges':
      return <BadgeGrid username={username} />
    default:
      return <ActivityList key={tab} username={username} tab={tab} />
  }
}
