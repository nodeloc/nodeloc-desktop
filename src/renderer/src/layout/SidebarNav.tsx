import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cx } from '../lib/cx'
import styles from './SidebarNav.module.css'

/** Building blocks shared by every sidebar variant (home, node, inbox…). */
export function SidebarHeader({ children }: { children: ReactNode }): React.JSX.Element {
  return <header className={styles.header}>{children}</header>
}

export function SidebarSection({ title, children }: { title?: string; children: ReactNode }): React.JSX.Element {
  return (
    <nav className={styles.section} aria-label={title}>
      {title && <h2 className={styles.sectionTitle}>{title}</h2>}
      {children}
    </nav>
  )
}

interface SidebarLinkProps {
  to: string
  icon?: ReactNode
  children: ReactNode
  end?: boolean
  trailing?: ReactNode
}

export function SidebarLink({ to, icon, children, end = true, trailing }: SidebarLinkProps): React.JSX.Element {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx(styles.link, isActive && styles.linkActive)}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </NavLink>
  )
}
