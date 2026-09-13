import { Compass, House, LayoutGrid, MessagesSquare, Palette } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'
import { apiRequest } from '../api/client'
import { useFeatures } from '../api/site'
import type { NodeSummary, NodesResponse } from '../api/types'
import { NodeIcon } from '../components/NodeIcon'
import { SkeletonCircle, SkeletonGroup } from '../components/Skeleton'
import { useIsSignedIn } from '../features/account/use-session'
import { useChatUnreadTotals } from '../features/chat/use-channels'
import { useJoinedNodes } from '../features/social/use-joined-nodes'
import { cx } from '../lib/cx'
import { paths } from '../lib/routes'
import styles from './NodeRail.module.css'

const RAIL_NODE_COUNT = 12

/**
 * Leftmost column, Discord-server style. Signed-in users see the nodes they
 * joined; guests, and members who haven't joined any yet, see recommended nodes.
 */
export function NodeRail(): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const features = useFeatures()
  const joined = useJoinedNodes()
  const joinedNodes = signedIn ? (joined.data?.communities ?? []) : []
  const joinedLoading = signedIn && joined.isPending
  // A failed joined list falls back to recommendations rather than an empty rail.
  const showRecommended = !signedIn || (!joinedLoading && joinedNodes.length === 0)

  const recommended = useQuery({
    queryKey: ['nodes', 'overview'],
    queryFn: () => apiRequest<NodesResponse>({ path: '/nodes.json' }),
    staleTime: 10 * 60_000,
    enabled: showRecommended
  })
  const recommendedNodes = showRecommended ? (recommended.data?.recommended.slice(0, RAIL_NODE_COUNT) ?? []) : []

  return (
    <nav className={styles.rail} aria-label={t('nav.nodes')}>
      <RailLink to={paths.home()} label={t('nav.home')} matchPrefixes={['/feed', '/tag', '/f']}>
        <House />
      </RailLink>
      {signedIn && <ChatRailLink />}
      <div className={styles.divider} />
      <div className={styles.nodes}>
        {joinedLoading && (
          <SkeletonGroup className={styles.skeleton}>
            {[0, 1, 2].map((index) => (
              <SkeletonCircle key={index} size={46} />
            ))}
          </SkeletonGroup>
        )}
        {joinedNodes.map((node) => (
          <RailNode key={node.id} node={node} />
        ))}
        {signedIn && recommendedNodes.length > 0 && <span className={styles.label}>{t('social.recommended')}</span>}
        {recommendedNodes.map((node) => (
          <RailNode key={node.id} node={node} />
        ))}
      </div>
      <div className={styles.divider} />
      <RailLink to={paths.nodes()} label={t('nav.browseNodes')}>
        <Compass />
      </RailLink>
      {features?.apps !== false && (
        <RailLink to={paths.apps()} label={t('apps.title')} matchPrefixes={['/apps']}>
          <LayoutGrid />
        </RailLink>
      )}
      {import.meta.env.DEV && (
        <RailLink to={paths.gallery()} label={t('nav.gallery')}>
          <Palette />
        </RailLink>
      )}
    </nav>
  )
}

function ChatRailLink(): React.JSX.Element {
  const { t } = useTranslation()
  const { unread, mentions } = useChatUnreadTotals()
  const badge =
    mentions > 0 ? (
      <span className={styles.badge}>{mentions > 99 ? '99+' : mentions}</span>
    ) : unread > 0 ? (
      <span className={styles.dot} />
    ) : undefined
  return (
    <RailLink to={paths.chat()} label={t('nav.chat')} matchPrefixes={['/chat']} badge={badge}>
      <MessagesSquare />
    </RailLink>
  )
}

function RailNode({ node }: { node: NodeSummary }): React.JSX.Element {
  return (
    <RailLink to={paths.node(node.slug)} label={node.name} end={false} plain>
      <NodeIcon
        name={node.name}
        color={node.color}
        logo={node.uploaded_logo}
        logoDark={node.uploaded_logo_dark}
        size={46}
        shape="circle"
        className={styles.nodeIcon}
      />
    </RailLink>
  )
}

interface RailLinkProps {
  to: string
  label: string
  children: ReactNode
  end?: boolean
  /** Node logos fill the whole circle instead of sitting on a tinted chip. */
  plain?: boolean
  /** Extra path prefixes that also count as this item being active. */
  matchPrefixes?: string[]
  /** Unread indicator on the icon's corner. */
  badge?: ReactNode
}

function RailLink({ to, label, children, end = true, plain = false, matchPrefixes = [], badge }: RailLinkProps): React.JSX.Element {
  const { pathname } = useLocation()
  const prefixActive = matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) => cx(styles.item, (isActive || prefixActive) && styles.active, plain && styles.plain)}
    >
      <span className={styles.pill} aria-hidden="true" />
      <span className={styles.icon}>{children}</span>
      {badge}
    </NavLink>
  )
}
