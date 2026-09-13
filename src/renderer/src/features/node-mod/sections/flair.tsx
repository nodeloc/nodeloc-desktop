import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Search, Tags, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../../../components/Avatar'
import { Button, IconButton } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Spinner } from '../../../components/Spinner'
import { Switch } from '../../../components/Switch'
import { showToast } from '../../../components/toast-store'
import {
  extraKeys,
  FLAIR_PAGE,
  modRequest,
  type FlairIndexResponse,
  type FlairTemplate,
  type FlairUsersResponse,
  type FlairWearer
} from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, FlairPill, SectionHeader, Tabs, UserPicker, useConfirm, useErrorToast } from './extra-ui'

interface FormState {
  id: number | null
  text: string
  emoji: string
  background_color: string
  text_color: 'dark' | 'light'
  mod_only: boolean
}

const EMPTY_FORM: FormState = { id: null, text: '', emoji: '', background_color: 'e5ebee', text_color: 'dark', mod_only: false }
/** FlairTemplate emoji validation. */
const EMOJI_PATTERN = /^[a-z0-9_+-]*$/

type FlairTab = 'templates' | 'wearers'

/** The labels a node offers its members, and who wears them. */
export function FlairSection({ category }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  const [confirm, confirmElement] = useConfirm()
  const base = `/node/${category.id}/flair`
  const indexKey = extraKeys.flair(category.id)

  const [tab, setTab] = useState<FlairTab>('templates')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filterDraft, setFilterDraft] = useState('')
  const [filter, setFilter] = useState('')
  const [assignUsernames, setAssignUsernames] = useState<string[]>([])
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const index = useQuery({
    queryKey: indexKey,
    queryFn: () => modRequest<FlairIndexResponse>({ path: `${base}.json` }),
    staleTime: 30_000
  })

  const wearers = useInfiniteQuery({
    queryKey: extraKeys.flairUsers(category.id, filter),
    queryFn: ({ pageParam }) =>
      modRequest<FlairUsersResponse>({ path: `${base}/users.json`, query: { offset: pageParam, filter: filter || undefined } }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.users.length, 0)
      return last.users.length >= FLAIR_PAGE && loaded < last.total ? loaded : undefined
    },
    staleTime: 30_000
  })

  const templates = index.data?.templates ?? []
  const wearerRows = wearers.data?.pages.flatMap((page) => page.users) ?? []
  const wearersTotal = wearers.data?.pages[0]?.total ?? 0

  const setTemplates = (next: (templates: FlairTemplate[]) => FlairTemplate[]): void => {
    queryClient.setQueryData<FlairIndexResponse>(indexKey, (data) => (data ? { ...data, templates: next(data.templates) } : data))
  }
  const refreshWearers = (): void => {
    void queryClient.invalidateQueries({ queryKey: extraKeys.flairUsersAll(category.id) })
  }

  const toggleSelfServe = async (wanted: boolean): Promise<void> => {
    try {
      const result = await modRequest<{ self_serve: boolean }>({ method: 'PUT', path: `${base}/settings.json`, json: { self_serve: wanted } })
      queryClient.setQueryData<FlairIndexResponse>(indexKey, (data) => (data ? { ...data, self_serve: result.self_serve } : data))
    } catch (error) {
      toastError(error)
    }
  }

  const emojiInvalid = !EMOJI_PATTERN.test(form.emoji)
  const canSave = !saving && form.text.trim() !== '' && !emojiInvalid

  const saveTemplate = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!canSave) return
    const body = {
      text: form.text.trim(),
      emoji: form.emoji,
      background_color: form.background_color,
      text_color: form.text_color,
      mod_only: form.mod_only
    }
    setSaving(true)
    try {
      if (form.id) {
        const saved = await modRequest<FlairTemplate>({ method: 'PUT', path: `${base}/templates/${form.id}.json`, json: body })
        setTemplates((list) => list.map((template) => (template.template_id === saved.template_id ? saved : template)))
        refreshWearers()
      } else {
        const saved = await modRequest<FlairTemplate>({ method: 'POST', path: `${base}/templates.json`, json: body })
        setTemplates((list) => [...list, saved])
      }
      setForm(EMPTY_FORM)
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async (template: FlairTemplate): Promise<void> => {
    const ok = await confirm({ message: t('nodeModExtra.flair.confirmDelete', { text: template.text }), confirmLabel: t('nodeModExtra.common.delete') })
    if (!ok) return
    try {
      await modRequest({ method: 'DELETE', path: `${base}/templates/${template.template_id}.json` })
      setTemplates((list) => list.filter((other) => other.template_id !== template.template_id))
      if (form.id === template.template_id) setForm(EMPTY_FORM)
      refreshWearers()
    } catch (error) {
      toastError(error)
    }
  }

  const assign = async (): Promise<void> => {
    if (assignUsernames.length === 0 || !assignTemplateId || assigning) return
    setAssigning(true)
    try {
      for (const username of assignUsernames) {
        await modRequest({ method: 'PUT', path: `${base}/users.json`, json: { username, template_id: Number(assignTemplateId) } })
      }
      setAssignUsernames([])
      showToast(t('nodeModExtra.flair.assigned'), 'success')
    } catch (error) {
      toastError(error)
    } finally {
      setAssigning(false)
      refreshWearers()
    }
  }

  // One label off somebody, or all of them when no template is named.
  const unassign = async (row: FlairWearer, template: FlairTemplate | null): Promise<void> => {
    const ok = await confirm({
      message: template
        ? t('nodeModExtra.flair.confirmRemoveOne', { username: row.user.username, text: template.text })
        : t('nodeModExtra.flair.confirmRemoveAll', { username: row.user.username }),
      confirmLabel: t('nodeModExtra.common.remove')
    })
    if (!ok) return
    try {
      await modRequest({
        method: 'DELETE',
        path: `${base}/users.json`,
        query: { username: row.user.username, template_id: template ? template.template_id : undefined }
      })
      refreshWearers()
    } catch (error) {
      toastError(error)
    }
  }

  const search = (event?: FormEvent): void => {
    event?.preventDefault()
    setFilter(filterDraft.trim())
  }

  return (
    <div className={styles.section}>
      <SectionHeader title={t('nodeModExtra.flair.title')} lede={t('nodeModExtra.flair.lede')} />

      <Tabs<FlairTab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'templates', label: t('nodeModExtra.flair.tabs.templates'), count: templates.length },
          { key: 'wearers', label: t('nodeModExtra.flair.tabs.wearers'), count: wearersTotal }
        ]}
      />

      {index.isPending ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : index.isError ? (
        <EmptyState
          title={t('nodeModExtra.common.loadFailed')}
          action={<Button onClick={() => void index.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
        />
      ) : tab === 'templates' ? (
        <>
          <section className={styles.panel}>
            <Switch
              checked={index.data.self_serve}
              onChange={(checked) => void toggleSelfServe(checked)}
              label={t('nodeModExtra.flair.selfServe')}
              description={t('nodeModExtra.flair.selfServeHint')}
            />
          </section>

          <section className={styles.panel}>
            <form className={styles.field} style={{ gap: 'var(--space-4)' }} onSubmit={(event) => void saveTemplate(event)}>
              <div className={styles.row}>
                <span className={styles.fieldLabel}>{t('nodeModExtra.flair.preview')}</span>
                <FlairPill flair={{ ...form, text: form.text || t('nodeModExtra.flair.preview') }} />
              </div>
              <div className={styles.grid2}>
                <Field label={t('nodeModExtra.flair.text')} htmlFor="mod-flair-text">
                  <input
                    id="mod-flair-text"
                    className={styles.input}
                    maxLength={64}
                    placeholder={t('nodeModExtra.flair.textPlaceholder')}
                    value={form.text}
                    onChange={(event) => setForm({ ...form, text: event.target.value })}
                  />
                </Field>
                <Field
                  label={t('nodeModExtra.flair.emoji')}
                  htmlFor="mod-flair-emoji"
                  hint={emojiInvalid ? <span className={styles.errorText}>{t('nodeModExtra.flair.emojiInvalid')}</span> : undefined}
                >
                  <input
                    id="mod-flair-emoji"
                    className={styles.input}
                    maxLength={64}
                    placeholder="fire"
                    value={form.emoji}
                    aria-invalid={emojiInvalid}
                    onChange={(event) => setForm({ ...form, emoji: event.target.value.replace(/:/g, '').trim() })}
                  />
                </Field>
                <Field label={t('nodeModExtra.flair.background')} htmlFor="mod-flair-background">
                  <div className={styles.colorRow}>
                    <input
                      id="mod-flair-background"
                      type="color"
                      className={styles.colorInput}
                      value={`#${form.background_color}`}
                      onChange={(event) => setForm({ ...form, background_color: event.target.value.replace('#', '').toLowerCase() })}
                    />
                    <span className={`${styles.hint} ${styles.mono}`}>#{form.background_color}</span>
                  </div>
                </Field>
                <Field label={t('nodeModExtra.flair.textColor')} htmlFor="mod-flair-text-color">
                  <select
                    id="mod-flair-text-color"
                    className={styles.select}
                    value={form.text_color}
                    onChange={(event) => setForm({ ...form, text_color: event.target.value === 'light' ? 'light' : 'dark' })}
                  >
                    <option value="dark">{t('nodeModExtra.flair.dark')}</option>
                    <option value="light">{t('nodeModExtra.flair.light')}</option>
                  </select>
                </Field>
              </div>
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.mod_only} onChange={(event) => setForm({ ...form, mod_only: event.target.checked })} />
                {t('nodeModExtra.flair.modOnly')}
              </label>
              <div className={styles.row}>
                <Button type="submit" variant="primary" icon={form.id ? <Check /> : <Plus />} disabled={!canSave}>
                  {form.id ? t('nodeModExtra.flair.save') : t('nodeModExtra.flair.add')}
                </Button>
                {form.id && (
                  <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>
                    {t('nodeModExtra.common.cancel')}
                  </Button>
                )}
              </div>
            </form>
          </section>

          {templates.length > 0 ? (
            <ul className={styles.list}>
              {templates.map((template) => (
                <li key={template.template_id} className={styles.item}>
                  <div className={styles.itemBody} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <FlairPill flair={template} />
                    {template.mod_only && <span className={styles.badge}>{t('nodeModExtra.flair.modOnlyBadge')}</span>}
                  </div>
                  <div className={styles.itemActions}>
                    <IconButton
                      size="sm"
                      label={t('nodeModExtra.flair.edit')}
                      onClick={() =>
                        setForm({
                          id: template.template_id,
                          text: template.text,
                          emoji: template.emoji ?? '',
                          background_color: template.background_color,
                          text_color: template.text_color === 'light' ? 'light' : 'dark',
                          mod_only: Boolean(template.mod_only)
                        })
                      }
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton size="sm" label={t('nodeModExtra.flair.delete')} className={styles.dangerIcon} onClick={() => void deleteTemplate(template)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Tags />} title={t('nodeModExtra.flair.none')} />
          )}
        </>
      ) : (
        <>
          {templates.length > 0 && (
            <section className={styles.panel}>
              <UserPicker value={assignUsernames} onChange={setAssignUsernames} max={20} />
              <div className={styles.row}>
                <select className={`${styles.select} ${styles.grow}`} value={assignTemplateId} onChange={(event) => setAssignTemplateId(event.target.value)}>
                  <option value="">{t('nodeModExtra.flair.choose')}</option>
                  {templates.map((template) => (
                    <option key={template.template_id} value={String(template.template_id)}>
                      {template.text}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  icon={<Plus />}
                  disabled={assigning || assignUsernames.length === 0 || !assignTemplateId}
                  onClick={() => void assign()}
                >
                  {t('nodeModExtra.flair.assign')}
                </Button>
              </div>
            </section>
          )}

          <form className={styles.row} onSubmit={search}>
            <input
              type="search"
              className={`${styles.input} ${styles.grow}`}
              placeholder={t('nodeModExtra.common.search')}
              value={filterDraft}
              onChange={(event) => setFilterDraft(event.target.value)}
            />
            {filter && (
              <IconButton
                label={t('nodeModExtra.common.clearSearch')}
                onClick={() => {
                  setFilterDraft('')
                  setFilter('')
                }}
              >
                <X />
              </IconButton>
            )}
            <IconButton label={t('nodeModExtra.common.search')} onClick={() => search()}>
              <Search />
            </IconButton>
          </form>

          {wearers.isPending ? (
            <div className={styles.center}>
              <Spinner />
            </div>
          ) : wearers.isError ? (
            <EmptyState
              title={t('nodeModExtra.common.loadFailed')}
              action={<Button onClick={() => void wearers.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
            />
          ) : wearerRows.length > 0 ? (
            <>
              <ul className={styles.list}>
                {wearerRows.map((row) => (
                  <li key={row.user.id} className={styles.item}>
                    <Avatar template={row.user.avatar_template} username={row.user.username} size={32} />
                    <div className={styles.itemBody}>
                      <span className={styles.itemTitle}>u/{row.user.username}</span>
                      <div className={styles.chips}>
                        {row.flairs.map((flair) => (
                          <span key={flair.template_id} className={styles.row} style={{ gap: 2 }}>
                            <FlairPill flair={flair} />
                            <button
                              type="button"
                              className={styles.chipButton}
                              title={t('nodeModExtra.flair.removeOne')}
                              aria-label={t('nodeModExtra.flair.removeOne')}
                              onClick={() => void unassign(row, flair)}
                            >
                              <X />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.itemActions}>
                      <IconButton size="sm" label={t('nodeModExtra.flair.removeAll')} className={styles.dangerIcon} onClick={() => void unassign(row, null)}>
                        <Trash2 />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
              {wearers.hasNextPage && (
                <Button className={styles.loadMore} disabled={wearers.isFetchingNextPage} onClick={() => void wearers.fetchNextPage()}>
                  {t('nodeModExtra.common.loadMore')}
                </Button>
              )}
            </>
          ) : (
            <EmptyState title={t('nodeModExtra.flair.nobody')} />
          )}
        </>
      )}
      {confirmElement}
    </div>
  )
}
