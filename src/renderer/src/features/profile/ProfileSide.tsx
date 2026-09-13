import { Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import type { NodeSummary } from '../../api/types'
import { Avatar } from '../../components/Avatar'
import { NodeIcon } from '../../components/NodeIcon'
import { PanelCard } from '../../components/PanelCard'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './ProfileSide.module.css'
import { useNodesByUser, useProfileSummary } from './use-profile'

/**
 * Side content kept inside the page (the global detail panel stays free).
 * Every card is supporting information: on failure or no data it is left out.
 */
export function ProfileSide({ username }: { username: string }): React.JSX.Element {
  return (
    <aside className={styles.side}>
      <TopNodesCard username={username} />
      <UserNodesCard username={username} />
      <MostLikedByCard username={username} />
    </aside>
  )
}

function CardSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.list}>
      {[0.7, 0.55, 0.64].map((width, index) => (
        <SkeletonLine key={index} width={width} height={32} />
      ))}
    </SkeletonGroup>
  )
}

function TopNodesCard({ username }: { username: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const summary = useProfileSummary(username)
  const categories = useCategoryIndex()
  const nodes = summary.data?.user_summary.top_categories ?? []

  if (summary.isPending) {
    return (
      <PanelCard title={t('profile.side.topNodes')}>
        <CardSkeleton />
      </PanelCard>
    )
  }
  if (nodes.length === 0) return null

  return (
    <PanelCard title={t('profile.side.topNodes')}>
      <ul className={styles.list}>
        {nodes.map((node) => {
          const category = categories?.byId.get(node.id)
          return (
            <li key={node.id}>
              <Link to={paths.node(node.slug)} className={styles.nodeRow}>
                <NodeIcon
                  name={node.name}
                  color={node.color}
                  logo={category?.uploaded_logo}
                  logoDark={category?.uploaded_logo_dark}
                />
                <span className={styles.nodeText}>
                  <span className={styles.nodeName}>{node.name}</span>
                  <span className={styles.nodeMeta}>
                    {t('profile.side.topicsAndPosts', { topics: node.topic_count, posts: node.post_count })}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </PanelCard>
  )
}

function UserNodesCard({ username }: { username: string }): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const query = useNodesByUser(username)

  if (query.isPending) {
    return (
      <PanelCard title={t('profile.side.nodes')}>
        <CardSkeleton />
      </PanelCard>
    )
  }

  const owned = query.data?.owned ?? []
  const ownedIds = new Set(owned.map((node) => node.id))
  const rows: Array<{ node: NodeSummary; role: 'owner' | 'moderator' }> = [
    ...owned.map((node) => ({ node, role: 'owner' as const })),
    ...(query.data?.moderated ?? []).filter((node) => !ownedIds.has(node.id)).map((node) => ({ node, role: 'moderator' as const }))
  ]
  if (rows.length === 0) return null

  return (
    <PanelCard title={t('profile.side.nodes')}>
      <ul className={styles.list}>
        {rows.map(({ node, role }) => (
          <li key={node.id}>
            <Link to={paths.node(node.slug)} className={styles.nodeRow}>
              <NodeIcon name={node.name} color={node.color} logo={node.uploaded_logo} logoDark={node.uploaded_logo_dark} />
              <span className={styles.nodeText}>
                <span className={styles.nodeName}>{node.name}</span>
                <span className={styles.nodeMeta}>
                  {t('profile.side.members', { value: formatCount(node.member_count, i18n.language) })}
                </span>
              </span>
              <span className={styles.role} data-role={role}>
                {t(`profile.side.${role}`)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}

function MostLikedByCard({ username }: { username: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const summary = useProfileSummary(username)
  const users = summary.data?.user_summary.most_liked_by_users ?? []
  // The top nodes card already shows the summary's loading state.
  if (users.length === 0) return null

  return (
    <PanelCard title={t('profile.side.mostLikedBy')}>
      <ul className={styles.people}>
        {users.map((user) => (
          <li key={user.id}>
            <Link
              to={paths.user(user.username)}
              className={styles.person}
              title={t('profile.side.likesFrom', { username: user.username, value: user.count })}
            >
              <Avatar template={user.avatar_template} username={user.username} size={40} />
              <span className={styles.personName}>{user.username}</span>
              <span className={styles.personCount}>
                <Heart fill="currentColor" />
                {user.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  )
}
