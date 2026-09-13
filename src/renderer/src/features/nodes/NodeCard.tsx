import { MessagesSquare, Users } from 'lucide-react'
import { useMemo, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import type { NodeSummary } from '../../api/types'
import { NodeIcon } from '../../components/NodeIcon'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { cx } from '../../lib/cx'
import { formatCount } from '../../lib/format'
import { paths } from '../../lib/routes'
import { JoinButton } from './JoinButton'
import { NodeBadges } from './NodeBadges'
import styles from './NodeCard.module.css'
import { htmlToText } from './node-text'

/** A node in the browse grids. The whole card opens the node. */
export function NodeCard({ node }: { node: NodeSummary }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const description = useMemo(() => htmlToText(node.description), [node.description])

  const open = (): void => {
    void navigate(paths.node(node.slug))
  }

  // Inner links and buttons keep their own behaviour.
  const onClick = (event: MouseEvent<HTMLElement>): void => {
    if ((event.target as Element).closest('a, button')) return
    open()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && event.target === event.currentTarget) open()
  }

  return (
    <article className={styles.card} tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} aria-label={node.name}>
      <div className={styles.top}>
        <NodeIcon
          name={node.name}
          color={node.color}
          logo={node.uploaded_logo}
          logoDark={node.uploaded_logo_dark}
          size={44}
        />
        <div className={styles.identity}>
          <h3 className={styles.name}>
            <Link to={paths.node(node.slug)} className={styles.nameLink} tabIndex={-1}>
              {node.name}
            </Link>
            <NodeBadges verified={node.community_verified} official={node.community_official} />
          </h3>
          <span className={styles.slug}>n/{node.slug}</span>
        </div>
        <JoinButton node={node} size="sm" />
      </div>
      <p className={cx(styles.description, !description && styles.placeholder)}>
        {description || t('nodes.noDescription')}
      </p>
      <div className={styles.stats}>
        <span>
          <Users />
          {t('nodes.members', { value: formatCount(node.member_count, i18n.language) })}
        </span>
        <span>
          <MessagesSquare />
          {t('nodes.topics', { value: formatCount(node.topic_count, i18n.language) })}
        </span>
      </div>
    </article>
  )
}

export function NodeGrid({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className={styles.grid}>{children}</div>
}

export function NodeCardSkeletons({ count }: { count: number }): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.grid}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.top}>
            <SkeletonCircle size={44} />
            <div className={styles.identity}>
              <SkeletonLine width={0.6} height={14} />
              <SkeletonLine width={0.35} height={11} />
            </div>
          </div>
          <div className={styles.description}>
            <SkeletonLine width={0.95} />
            <SkeletonLine width={0.7} />
          </div>
          <SkeletonLine width={0.45} height={11} />
        </div>
      ))}
    </SkeletonGroup>
  )
}
