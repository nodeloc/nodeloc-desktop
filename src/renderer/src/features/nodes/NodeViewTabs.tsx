import { Flame, Sparkles, Star, Trophy, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { cx } from '../../lib/cx'
import { NODE_VIEWS, paths, type NodeView } from '../../lib/routes'
import styles from './NodeViewTabs.module.css'

const VIEW_ICONS: Record<NodeView, ReactNode> = {
  latest: <Zap fill="currentColor" />,
  new: <Sparkles />,
  hot: <Flame fill="currentColor" />,
  featured: <Star fill="currentColor" />,
  top: <Trophy />
}

/** A node's topic views (最新, 新话题, 热门…) as tabs at the start of the list toolbar. */
export function NodeViewTabs({ slug }: { slug: string }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <nav className={styles.tabs} aria-label={t('nodes.sidebar.views')}>
      {NODE_VIEWS.map((view) => (
        // `end` keeps 最新 (the base route) from matching every view.
        <NavLink key={view} to={paths.node(slug, view)} end className={({ isActive }) => cx(styles.tab, isActive && styles.active)}>
          {VIEW_ICONS[view]}
          {t(`feed.filters.${view}`)}
        </NavLink>
      ))}
    </nav>
  )
}
