import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Search, Send, UserX, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../../api/client'
import type { BasicUser } from '../../../api/types'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button, IconButton } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { useCurrentUser } from '../../account/use-session'
import { InlineRetry } from '../../nodes/NodeLoadError'
import { ConfirmDialog, ModEmpty, ModIntro, ModPanel, ModUserRow, modStyles, UserPicker } from '../ModUi'
import type { ModSectionProps } from '../sections'
import type { ModGroupSummary } from '../types'
import { nodeModKey, useRefreshNodeMod } from '../use-mod-tools'

const PAGE = 50
const MAX_NEW_MODERATORS = 10
const MAX_INVITES = 20

/** GroupUserWithCustomFieldsSerializer, as far as the list reads it. */
interface GroupMember extends BasicUser {
  added_at?: string
}

interface GroupMembersResponse {
  members: GroupMember[]
  meta: { total: number; limit: number; offset: number }
}

/** GroupRequesterSerializer. */
interface Requester extends BasicUser {
  reason?: string | null
  requested_at?: string
}

interface InviteResult {
  invited: string[]
  skipped: Array<{ username: string; reason: 'not_found' | 'self' | 'already_member' | 'banned' | string }>
}

type Tab = 'moderators' | 'members'

interface PendingRemoval {
  user: BasicUser
  group: ModGroupSummary
  moderator: boolean
}

/**
 * Moderators and members (components/mod-tools/members.gjs). Both are core
 * groups (`{slug}-mods`, `{slug}-members`) owned by the node's owner, so
 * changes go through core's group endpoints, which need a group owner or an
 * admin: `PUT|DELETE /groups/:id/members`, `GET /groups/:name/members`
 * (`requesters=true` for join requests), `PUT /groups/:id/handle_membership_request`.
 * Invites use `POST /node/:id/invite-members` (owner or admin).
 */
export function MembersSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const refresh = useRefreshNodeMod(category)
  const me = useCurrentUser()
  const [tab, setTab] = useState<Tab>('moderators')
  const [newModerators, setNewModerators] = useState<string[]>([])
  const [newMembers, setNewMembers] = useState<string[]>([])
  const [skipped, setSkipped] = useState<InviteResult['skipped']>([])
  const [filterDraft, setFilterDraft] = useState('')
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<PendingRemoval | null>(null)

  const ownerId = mod.community.user_id ?? category.user_id
  // As on the web: staff or the owner. The server's own check is group ownership.
  const canManage = Boolean(me && (me.admin || me.moderator || me.staff || me.id === ownerId))
  const moderatorGroup = mod.groups.moderators
  const memberGroup = mod.groups.members
  const baseKey = nodeModKey(category.id)

  const requests = useQuery({
    queryKey: [...baseKey, 'requests'],
    queryFn: () =>
      apiRequest<{ members: Requester[] }>({
        path: `/groups/${encodeURIComponent(memberGroup!.name)}/members.json`,
        query: { requesters: true, limit: PAGE }
      }),
    enabled: canManage && memberGroup !== null
  })

  const members = useInfiniteQuery({
    queryKey: [...baseKey, 'members', filter],
    queryFn: ({ pageParam }) =>
      apiRequest<GroupMembersResponse>({
        path: `/groups/${encodeURIComponent(memberGroup!.name)}/members.json`,
        query: { limit: PAGE, offset: pageParam, filter: filter || undefined }
      }),
    initialPageParam: 0,
    // `meta.total` counts the whole group, before the filter; a short page ends a filtered list.
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.members.length, 0)
      return last.members.length >= PAGE && loaded < last.meta.total ? loaded : undefined
    },
    enabled: memberGroup !== null
  })

  const requesters = requests.data?.members ?? []
  const memberList = members.data?.pages.flatMap((page) => page.members) ?? []
  const membersTotal = members.data?.pages[0]?.meta.total ?? 0

  const addModerators = async (): Promise<void> => {
    if (!moderatorGroup || newModerators.length === 0) return
    setBusy(true)
    try {
      await apiRequest({
        method: 'PUT',
        path: `/groups/${moderatorGroup.id}/members.json`,
        form: [['usernames', newModerators.join(',')]],
        priority: 'user'
      })
      setNewModerators([])
      showToast(t('nodeMod.members.moderatorsAdded'), 'success')
      await refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const inviteMembers = async (): Promise<void> => {
    if (!memberGroup || newMembers.length === 0) return
    setBusy(true)
    try {
      const result = await apiRequest<InviteResult>({
        method: 'POST',
        path: `/node/${category.id}/invite-members.json`,
        form: [['usernames', newMembers.join(',')]],
        priority: 'user'
      })
      setNewMembers([])
      if (result.invited.length > 0) showToast(t('nodeMod.members.invited', { count: result.invited.length }), 'success')
      if (result.skipped.length > 0) setSkipped(result.skipped)
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setBusy(false)
    }
  }

  const handleRequest = async (user: Requester, accept: boolean): Promise<void> => {
    if (!memberGroup) return
    try {
      await apiRequest({
        method: 'PUT',
        path: `/groups/${memberGroup.id}/handle_membership_request.json`,
        // Core tests `params[:accept]` for presence, so a denial leaves it out (as core's web UI does).
        form: accept ? [['user_id', user.id], ['accept', 'true']] : [['user_id', user.id]],
        priority: 'user'
      })
      queryClient.setQueryData<{ members: Requester[] }>([...baseKey, 'requests'], (data) =>
        data ? { members: data.members.filter((entry) => entry.id !== user.id) } : data
      )
      showToast(t(accept ? 'nodeMod.members.approved' : 'nodeMod.members.denied', { username: user.username }), 'success')
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    }
  }

  const remove = async ({ user, group }: PendingRemoval): Promise<void> => {
    try {
      await apiRequest({
        method: 'DELETE',
        path: `/groups/${group.id}/members.json`,
        query: { user_id: user.id },
        priority: 'user'
      })
      showToast(t('nodeMod.members.removed', { username: user.username }), 'success')
      await refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    }
  }

  const search = (event: FormEvent): void => {
    event.preventDefault()
    setFilter(filterDraft.trim())
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'moderators', label: t('nodeMod.members.tabModerators'), count: mod.moderators.length },
    { key: 'members', label: t('nodeMod.members.tabMembers'), count: membersTotal + requesters.length }
  ]

  const ownerBadge = (user: BasicUser): string | undefined => (user.id === ownerId ? t('nodeMod.members.owner') : undefined)

  const removeButton = (user: BasicUser, group: ModGroupSummary | null, moderator: boolean): React.JSX.Element | undefined =>
    canManage && group && user.id !== ownerId ? (
      <IconButton
        label={t('nodeMod.members.remove')}
        size="sm"
        className={modStyles.dangerIcon}
        onClick={() => setRemoving({ user, group, moderator })}
      >
        <UserX />
      </IconButton>
    ) : undefined

  return (
    <>
      <ModIntro>{t('nodeMod.members.lede')}</ModIntro>

      <div className={modStyles.tabs} role="tablist">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            className={cx(modStyles.tab, tab === entry.key && modStyles.tabActive)}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
            {entry.count > 0 && <span className={modStyles.count}>{entry.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'moderators' && (
        <ModPanel>
          {!moderatorGroup ? (
            <ModEmpty>{t('nodeMod.members.noGroup')}</ModEmpty>
          ) : (
            <>
              {canManage && (
                <div className={modStyles.formRow}>
                  <UserPicker
                    value={newModerators}
                    onChange={setNewModerators}
                    max={MAX_NEW_MODERATORS}
                    placeholder={t('nodeMod.members.addModeratorPlaceholder')}
                    disabled={busy}
                  />
                  <Button
                    variant="primary"
                    icon={<Plus />}
                    disabled={busy || newModerators.length === 0}
                    onClick={() => void addModerators()}
                  >
                    {t('nodeMod.members.addModerator')}
                  </Button>
                </div>
              )}
              <ul className={modStyles.list}>
                {mod.moderators.map((user) => (
                  <ModUserRow
                    key={user.id}
                    user={user}
                    badge={ownerBadge(user)}
                    meta={user.name || undefined}
                    actions={removeButton(user, moderatorGroup, true)}
                  />
                ))}
              </ul>
            </>
          )}
        </ModPanel>
      )}

      {tab === 'members' && !memberGroup && (
        <ModPanel>
          <ModEmpty>{t('nodeMod.members.noGroup')}</ModEmpty>
        </ModPanel>
      )}

      {tab === 'members' && memberGroup && (
        <>
          {requesters.length > 0 && (
            <ModPanel title={t('nodeMod.members.requestsCount', { count: requesters.length })}>
              <ul className={modStyles.list}>
                {requesters.map((user) => (
                  <ModUserRow
                    key={user.id}
                    user={user}
                    meta={user.reason || undefined}
                    actions={
                      <>
                        <Button size="sm" variant="primary" icon={<Check />} onClick={() => void handleRequest(user, true)}>
                          {t('nodeMod.members.approve')}
                        </Button>
                        <Button size="sm" icon={<X />} onClick={() => void handleRequest(user, false)}>
                          {t('nodeMod.members.deny')}
                        </Button>
                      </>
                    }
                  />
                ))}
              </ul>
            </ModPanel>
          )}
          {requests.isError && <InlineRetry error={requests.error} onRetry={() => void requests.refetch()} />}

          <ModPanel>
            {canManage && (
              <div className={modStyles.formRow}>
                <UserPicker
                  value={newMembers}
                  onChange={setNewMembers}
                  max={MAX_INVITES}
                  placeholder={t('nodeMod.members.inviteMemberPlaceholder')}
                  disabled={busy}
                />
                <Button
                  variant="primary"
                  icon={<Send />}
                  disabled={busy || newMembers.length === 0}
                  onClick={() => void inviteMembers()}
                >
                  {t('nodeMod.members.inviteMember')}
                </Button>
              </div>
            )}

            <form className={modStyles.formRow} onSubmit={search}>
              <input
                type="search"
                className={cx(modStyles.input, modStyles.grow)}
                value={filterDraft}
                placeholder={t('nodeMod.members.search')}
                onChange={(event) => setFilterDraft(event.target.value)}
              />
              {filter && (
                <IconButton
                  label={t('nodeMod.members.clearSearch')}
                  onClick={() => {
                    setFilterDraft('')
                    setFilter('')
                  }}
                >
                  <X />
                </IconButton>
              )}
              <IconButton label={t('nodeMod.members.search')} type="submit" disabled={members.isFetching}>
                <Search />
              </IconButton>
            </form>

            {!filter && membersTotal > 0 && (
              <p className={modStyles.hint}>{t('nodeMod.members.total', { count: membersTotal })}</p>
            )}

            {members.isPending ? (
              <ModEmpty>
                <Spinner size={20} />
              </ModEmpty>
            ) : members.isError ? (
              <InlineRetry error={members.error} onRetry={() => void members.refetch()} />
            ) : memberList.length > 0 ? (
              <>
                <ul className={modStyles.list}>
                  {memberList.map((user) => (
                    <ModUserRow
                      key={user.id}
                      user={user}
                      badge={ownerBadge(user)}
                      meta={user.name || undefined}
                      actions={removeButton(user, memberGroup, false)}
                    />
                  ))}
                </ul>
                {members.hasNextPage && (
                  <Button
                    className={modStyles.loadMore}
                    disabled={members.isFetchingNextPage}
                    onClick={() => void members.fetchNextPage()}
                  >
                    {t('nodeMod.members.loadMore')}
                  </Button>
                )}
              </>
            ) : (
              <ModEmpty icon={<Users />}>{filter ? t('nodeMod.members.noMatches') : t('nodeMod.members.empty')}</ModEmpty>
            )}
          </ModPanel>
        </>
      )}

      <ConfirmDialog
        open={removing !== null}
        message={
          removing
            ? t(removing.moderator ? 'nodeMod.members.confirmRemoveModerator' : 'nodeMod.members.confirmRemove', {
                username: removing.user.username
              })
            : ''
        }
        confirmLabel={t('nodeMod.members.remove')}
        onConfirm={() => (removing ? remove(removing) : Promise.resolve())}
        onClose={() => setRemoving(null)}
      />

      <Dialog
        open={skipped.length > 0}
        onClose={() => setSkipped([])}
        title={t('nodeMod.members.inviteSkippedTitle')}
        width={400}
        footer={
          <Button variant="primary" onClick={() => setSkipped([])}>
            {t('common.confirm')}
          </Button>
        }
      >
        <ul className={modStyles.list}>
          {skipped.map((entry) => (
            <li key={entry.username} className={modStyles.rowMeta}>
              {entry.username}：
              {t(`nodeMod.members.skipReasons.${entry.reason}`, { defaultValue: entry.reason })}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  )
}
