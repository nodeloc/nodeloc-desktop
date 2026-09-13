import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { NodeIcon } from '../../components/NodeIcon'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { cx } from '../../lib/cx'
import { absoluteUrl } from '../../lib/discourse'
import { ModToolsButton } from '../node-mod/ModToolsButton'
import { JoinButton } from './JoinButton'
import { NodeBadges } from './NodeBadges'
import styles from './NodeHeader.module.css'
import { NotificationLevelMenu } from './NotificationLevelMenu'
import type { NodeCategory } from './types'

/** Banner, logo, identity and membership actions at the top of a node's sidebar. */
export function NodeHeader({ category }: { category: NodeCategory }): React.JSX.Element {
  return (
    <div className={styles.header}>
      <NodeBanner category={category} />
      <div className={styles.body}>
        <div className={styles.identityRow}>
          <NodeIcon
            name={category.name}
            color={category.color}
            logo={category.uploaded_logo}
            logoDark={category.uploaded_logo_dark}
            size={56}
            className={styles.logo}
          />
          <div className={styles.actions}>
            <ModToolsButton category={category} />
            <NotificationLevelMenu category={category} />
            <JoinButton node={category} size="sm" />
          </div>
        </div>
        <h2 className={styles.name}>
          <span className={styles.nameText}>{category.name}</span>
          <NodeBadges verified={category.community_verified} official={category.community_official} />
        </h2>
        <p className={styles.meta}>n/{category.slug}</p>
        {category.description_text && <Description text={category.description_text} />}
      </div>
    </div>
  )
}

/** The uploaded background (dark variant under a dark theme), else a wash of the node colour. */
function NodeBanner({ category }: { category: NodeCategory }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const light = category.uploaded_background ?? category.uploaded_background_dark
  const dark = category.uploaded_background_dark

  if (light && !failed) {
    return (
      <picture className={styles.banner}>
        {dark && dark.url !== light.url && (
          <source srcSet={absoluteUrl(dark.url)} media="(prefers-color-scheme: dark)" />
        )}
        <img src={absoluteUrl(light.url)} alt="" draggable={false} onError={() => setFailed(true)} />
      </picture>
    )
  }

  return (
    <div
      className={cx(styles.banner, styles.wash)}
      style={{ '--node-color': `#${category.color}` } as CSSProperties}
      aria-hidden="true"
    />
  )
}

/** Clamped to three lines, with 展开/收起 only when the text actually overflows. */
function Description({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation()
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || expanded) return
    const measure = (): void => setOverflows(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text, expanded])

  return (
    <div className={styles.descriptionBlock}>
      <p ref={ref} className={cx(styles.description, !expanded && styles.clamped)}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? t('nodes.collapse') : t('nodes.expand')}
        </button>
      )}
    </div>
  )
}

export function NodeHeaderSkeleton(): React.JSX.Element {
  return (
    <SkeletonGroup className={styles.header}>
      <div className={styles.banner} />
      <div className={styles.body}>
        <div className={styles.identityRow}>
          <span className={cx(styles.logo, styles.logoSkeleton)} />
        </div>
        <div className={styles.skeletonLines}>
          <SkeletonLine width={0.5} height={18} />
          <SkeletonLine width={0.35} />
          <SkeletonLine width={0.95} />
          <SkeletonLine width={0.8} />
        </div>
      </div>
    </SkeletonGroup>
  )
}
