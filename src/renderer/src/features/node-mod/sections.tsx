import { Blocks, BookOpen, Flag, House, Link2, RadioTower, Settings, Tag, Tags, UserPlus, UserX, Users } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import type { NodeCategory } from '../nodes/types'
import { AppsSection } from './sections/apps'
import { ChannelsSection } from './sections/channels'
import { FlairSection } from './sections/flair'
import { InvitesSection } from './sections/invites'
import { LinksSection } from './sections/links'
import { MembersSection } from './sections/members'
import { OverviewSection } from './sections/overview'
import { QueueSection } from './sections/queue'
import { RestrictedSection } from './sections/restricted'
import { RulesSection } from './sections/rules'
import { SettingsSection } from './sections/settings'
import { TagsSection } from './sections/tags'
import type { ModToolsData } from './types'

export interface ModSectionProps {
  category: NodeCategory
  mod: ModToolsData
}

export interface ModSection {
  /** URL segment: `/n/:slug/mod/:key` (`overview` is `/n/:slug/mod`). */
  key: string
  /** i18n key. */
  label: string
  icon: ReactNode
  component: ComponentType<ModSectionProps>
  /** Leave out for sections every node moderator may use. */
  visible?: (mod: ModToolsData, category: NodeCategory) => boolean
}

/**
 * Sections the web marks `moderating: false` belong to the node's owner (and
 * admins): `can_edit` (`guardian.can_edit_community?`). The rest are open to
 * the node's moderators too.
 */
export const ownerOnly = (mod: ModToolsData): boolean => mod.can_edit

/** In the web nav's order (templates/community-mod.gjs SECTIONS). */
export const MOD_SECTIONS: ModSection[] = [
  { key: 'overview', label: 'nodeMod.nav.overview', icon: <House />, component: OverviewSection },
  { key: 'queue', label: 'nodeMod.nav.queue', icon: <Flag />, component: QueueSection },
  { key: 'rules', label: 'nodeMod.nav.rules', icon: <BookOpen />, component: RulesSection, visible: ownerOnly },
  { key: 'members', label: 'nodeMod.nav.members', icon: <Users />, component: MembersSection, visible: ownerOnly },
  { key: 'invites', label: 'nodeModExtra.nav.invites', icon: <UserPlus />, component: InvitesSection, visible: ownerOnly },
  { key: 'restricted', label: 'nodeMod.nav.restricted', icon: <UserX />, component: RestrictedSection },
  { key: 'flair', label: 'nodeModExtra.nav.flair', icon: <Tags />, component: FlairSection },
  { key: 'links', label: 'nodeModExtra.nav.links', icon: <Link2 />, component: LinksSection, visible: ownerOnly },
  { key: 'tags', label: 'nodeModExtra.nav.tags', icon: <Tag />, component: TagsSection, visible: ownerOnly },
  { key: 'apps', label: 'nodeModExtra.nav.apps', icon: <Blocks />, component: AppsSection, visible: ownerOnly },
  { key: 'channels', label: 'nodeModExtra.nav.channels', icon: <RadioTower />, component: ChannelsSection, visible: ownerOnly },
  // Verification is a tab inside settings (owner or staff), as on the web.
  { key: 'settings', label: 'nodeModExtra.nav.settings', icon: <Settings />, component: SettingsSection, visible: ownerOnly }
]

export function isModSectionVisible(section: ModSection, mod: ModToolsData, category: NodeCategory): boolean {
  return section.visible ? section.visible(mod, category) : true
}
