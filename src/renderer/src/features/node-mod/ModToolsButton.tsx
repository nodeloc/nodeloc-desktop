import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMatch, useNavigate } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import type { Category, CurrentUser } from '../../api/types'
import { Button } from '../../components/Button'
import { paths } from '../../lib/routes'
import { useCurrentUser } from '../account/use-session'
import type { NodeCategory } from '../nodes/types'

/** Fields some category payloads carry that `Category` doesn't list. */
type ModFlags = {
  /** `/site.json` categories: the reader sits in `{slug}-mods` (plugin.rb `Site#categories`). */
  is_moderator?: boolean
  /** BasicCategorySerializer, when the category has moderation groups. */
  moderating_group_ids?: number[]
}

/**
 * Mirrors `guardian.can_moderate_community?`, which `GET /node/:id/mod` enforces:
 * an admin or the owner (`can_edit_community`), or a member of `{slug}-mods`
 * or of one of the category's moderation groups. Site moderators who aren't
 * admins are refused by the server, so they don't get the button.
 */
export function canModerateNode(category: NodeCategory, me: CurrentUser | undefined, siteCategory?: Category): boolean {
  if (!me || !category.parent_category_id) return false
  if (category.can_edit_community || me.admin) return true
  if (category.user_id !== undefined && category.user_id === me.id) return true
  if ((siteCategory as (Category & ModFlags) | undefined)?.is_moderator) return true
  // `moderators` is capped at five; the site flag above covers larger groups.
  if (category.moderators?.some((moderator) => moderator.id === me.id)) return true
  const groupIds = (category as NodeCategory & ModFlags).moderating_group_ids
  return Boolean(groupIds && me.groups?.some((group) => groupIds.includes(group.id)))
}

/** 节点管理 in the node header, for the people who run the node. */
export function ModToolsButton({ category }: { category: NodeCategory }): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const index = useCategoryIndex()
  const onModTools = useMatch('/n/:slug/mod/*')

  if (!canModerateNode(category, me, index?.byId.get(category.id))) return null

  // Sized like the notification menu beside it.
  return (
    <Button
      size="sm"
      icon={<Shield />}
      aria-label={t('nodeMod.entry')}
      title={t('nodeMod.entry')}
      aria-pressed={Boolean(onModTools)}
      onClick={() => navigate(paths.nodeMod(category.slug))}
    />
  )
}
