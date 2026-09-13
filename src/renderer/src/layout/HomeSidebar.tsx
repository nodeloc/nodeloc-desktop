import { Bookmark, Circle, Flame, Sparkles, Star, Trophy, Users, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsSignedIn } from '../features/account/use-session'
import { NewTopicButton } from '../features/social/NewTopicButton'
import { CustomFeedsSection, RecentNodesSection } from '../features/social/PersonalSections'
import { paths, type FeedFilter } from '../lib/routes'
import { SidebarHeader, SidebarLink, SidebarSection } from './SidebarNav'

const FEEDS: Array<{ filter: FeedFilter; icon: ReactNode }> = [
  { filter: 'latest', icon: <Zap fill="currentColor" /> },
  { filter: 'joined', icon: <Users /> },
  { filter: 'hot', icon: <Flame fill="currentColor" /> },
  { filter: 'new', icon: <Sparkles /> },
  { filter: 'featured', icon: <Star fill="currentColor" /> },
  { filter: 'top', icon: <Trophy /> }
]

const PERSONAL: Array<{ filter: FeedFilter; icon: ReactNode }> = [
  { filter: 'unread', icon: <Circle fill="currentColor" /> },
  { filter: 'bookmarks', icon: <Bookmark fill="currentColor" /> }
]

export function HomeSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()

  return (
    <>
      <SidebarHeader>{t('nav.home')}</SidebarHeader>
      <NewTopicButton label={t('social.newTopic')} />
      <SidebarSection title={t('feed.feeds')}>
        {FEEDS.map(({ filter, icon }) => (
          <SidebarLink key={filter} to={paths.feed(filter)} icon={icon}>
            {t(`feed.filters.${filter}`)}
          </SidebarLink>
        ))}
      </SidebarSection>
      <SidebarSection title={t('feed.personal')}>
        {PERSONAL.map(({ filter, icon }) => (
          <SidebarLink key={filter} to={paths.feed(filter)} icon={icon}>
            {t(`feed.filters.${filter}`)}
          </SidebarLink>
        ))}
      </SidebarSection>
      {signedIn && (
        <>
          <RecentNodesSection />
          <CustomFeedsSection />
        </>
      )}
    </>
  )
}
