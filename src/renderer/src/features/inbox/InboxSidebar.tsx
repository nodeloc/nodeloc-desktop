import { Bell, Mail, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SidebarHeader, SidebarLink, SidebarSection } from '../../layout/SidebarNav'
import { useCurrentUser } from '../account/use-session'
import { useNotificationCounts } from './use-notifications'

export function InboxSidebar(): React.JSX.Element {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const counts = useNotificationCounts()
  const groupInboxes = (user?.groups ?? []).filter((group) => group.has_messages)

  return (
    <>
      <SidebarHeader>{t('inbox.title')}</SidebarHeader>
      <SidebarSection>
        <SidebarLink to="/inbox" icon={<Bell fill="currentColor" />} trailing={counts?.allUnread ? counts.allUnread : undefined}>
          {t('inbox.notifications')}
        </SidebarLink>
        <SidebarLink
          to="/inbox/messages"
          icon={<Mail />}
          trailing={counts?.newPersonalMessages ? counts.newPersonalMessages : undefined}
        >
          {t('inbox.messages')}
        </SidebarLink>
      </SidebarSection>
      {groupInboxes.length > 0 && (
        <SidebarSection title={t('inbox.messages')}>
          {groupInboxes.map((group) => (
            <SidebarLink key={group.id} to={`/inbox/messages/group/${encodeURIComponent(group.name)}`} icon={<Users />}>
              {group.name}
            </SidebarLink>
          ))}
        </SidebarSection>
      )}
    </>
  )
}
