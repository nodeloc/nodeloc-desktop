import { useTranslation } from 'react-i18next'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { SidebarLink, SidebarSection } from '../../layout/SidebarNav'
import { paths } from '../../lib/routes'
import { NodeHeader } from '../nodes/NodeHeader'
import { NodeSidebar } from '../nodes/NodeSidebar'
import styles from './NodeModPage.module.css'
import { isModSectionVisible, MOD_SECTIONS } from './sections'
import { useModTools } from './use-mod-tools'

/** Second column on a mod tools route: the node's header, then the sections this account may open. */
export function NodeModSidebar({ slug }: { slug: string }): React.JSX.Element {
  const { t } = useTranslation()
  const { node, mod } = useModTools(slug)
  const category = node.data?.category

  // Loading and missing nodes look exactly like the node's own sidebar.
  if (!category) return <NodeSidebar slug={slug} />

  return (
    <>
      <NodeHeader category={category} />
      <SidebarSection title={t('nodeMod.title')}>
        {mod.data ? (
          MOD_SECTIONS.filter((section) => isModSectionVisible(section, mod.data, category)).map((section) => (
            <SidebarLink key={section.key} to={paths.nodeMod(slug, section.key)} icon={section.icon}>
              {t(section.label)}
            </SidebarLink>
          ))
        ) : mod.isPending ? (
          <SkeletonGroup className={styles.navSkeleton}>
            <SkeletonLine width={0.6} height={16} />
            <SkeletonLine width={0.5} height={16} />
            <SkeletonLine width={0.7} height={16} />
          </SkeletonGroup>
        ) : null}
      </SidebarSection>
    </>
  )
}
