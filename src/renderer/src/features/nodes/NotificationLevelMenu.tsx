import { Bell, BellOff, BellRing, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/Button'
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu'
import { useIsSignedIn, useRequireSignIn } from '../account/use-session'
import styles from './NotificationLevelMenu.module.css'
import type { NodeCategory } from './types'
import { normalizeLevel, useNodeNotificationLevel, type NotificationLevel } from './use-node-notifications'

/** Discourse's own menu order: most to least attention. */
const LEVEL_ORDER: NotificationLevel[] = [3, 2, 4, 1, 0]

const LEVEL_KEYS: Record<NotificationLevel, string> = {
  0: 'muted',
  1: 'regular',
  2: 'tracking',
  3: 'watching',
  4: 'watchingFirstPost'
}

const LEVEL_ICONS: Record<NotificationLevel, ReactNode> = {
  0: <BellOff />,
  1: <Bell />,
  2: <Bell />,
  3: <BellRing fill="currentColor" />,
  4: <BellRing />
}

/** 通知 on the node header: pick one of the five category notification levels. */
export function NotificationLevelMenu({ category }: { category: NodeCategory }): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const requireSignIn = useRequireSignIn()
  const setLevel = useNodeNotificationLevel()
  const current = normalizeLevel(category.notification_level)
  const levelLabel = (level: NotificationLevel): string => t(`nodes.notificationLevels.${LEVEL_KEYS[level]}.label`)

  const items: MenuItem[] = LEVEL_ORDER.map((level) => ({
    key: String(level),
    icon: LEVEL_ICONS[level],
    label: (
      <span className={styles.option}>
        <span className={styles.text}>
          <span className={styles.label}>{levelLabel(level)}</span>
          <span className={styles.description}>
            {t(`nodes.notificationLevels.${LEVEL_KEYS[level]}.description`)}
          </span>
        </span>
        <Check strokeWidth={2.5} className={styles.check} data-visible={level === current || undefined} />
      </span>
    ),
    onSelect: () => {
      if (level !== current) setLevel.mutate({ categoryId: category.id, level })
    }
  }))

  return (
    <DropdownMenu
      // The trigger sits near the sidebar's right edge; open towards the list, not off the window.
      align="start"
      portal
      items={items}
      trigger={({ open, toggle }) => (
        <Button
          size="sm"
          icon={signedIn ? LEVEL_ICONS[current] : <Bell />}
          aria-haspopup="menu"
          aria-expanded={open}
          title={signedIn ? t('nodes.notificationLevels.current', { level: levelLabel(current) }) : undefined}
          onClick={() => {
            if (requireSignIn()) toggle()
          }}
        >
          {t('nodes.notifications')}
        </Button>
      )}
    />
  )
}
