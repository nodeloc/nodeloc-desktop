import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isApiErrorKind } from '../../../api/client'
import { Button, IconButton } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { Spinner } from '../../../components/Spinner'
import { showToast } from '../../../components/toast-store'
import { extraKeys, modRequest, saveNodeSettings, type EditableCategory, type NodeTagGroup, type TagGroupsResponse } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, SectionHeader, useConfirm, useErrorToast } from './extra-ui'
import { cleanTagName, TagGroupCard } from './tags-group-card'
import { TagStyleDialog } from './tag-style-dialog'
import { useInvalidateNodeMod } from './use-invalidate'

interface Requirement {
  name: string
  min_count: number
}

function splitTagNames(raw: string): string[] {
  return [...new Set(raw.split(/[,，\s]+/).map(cleanTagName).filter(Boolean))]
}

function byName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The node's tag groups and its tagging rules. Groups save as they change;
 * the rules save together through the node edit endpoint.
 */
export function TagsSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const [confirm, confirmElement] = useConfirm()
  const endpoint = `/node/${category.id}/tag-groups`
  const queryKey = extraKeys.tagGroups(category.id)
  const editable = mod.category as unknown as EditableCategory

  const query = useQuery({
    queryKey,
    queryFn: () => modRequest<TagGroupsResponse>({ path: `${endpoint}.json` }),
    staleTime: 30_000,
    retry: (count, error) => !isApiErrorKind(error, 'notFound', 'forbidden') && count < 2
  })
  // The whole door answers 404 while tagging is off site-wide.
  const taggingDisabled = query.isError && isApiErrorKind(query.error, 'notFound')
  const groups = byName(query.data?.tag_groups ?? [])
  const choices = query.data?.choices ?? []

  const [newName, setNewName] = useState('')
  const [newTags, setNewTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [minimum, setMinimum] = useState<number>(editable.minimum_required_tags ?? 0)
  const [required, setRequired] = useState<Requirement[]>(() =>
    (editable.required_tag_groups ?? []).map((rule) => ({ name: rule.name, min_count: rule.min_count ?? 1 }))
  )
  const [styling, setStyling] = useState<string | null>(null)

  const update = (fn: (data: TagGroupsResponse) => TagGroupsResponse): void => {
    queryClient.setQueryData<TagGroupsResponse>(queryKey, (data) => (data ? fn(data) : data))
  }

  const createGroup = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (saving || !newName.trim()) return
    setSaving(true)
    try {
      const result = await modRequest<{ tag_group: NodeTagGroup }>({
        method: 'POST',
        path: `${endpoint}.json`,
        json: { name: newName.trim(), tags: splitTagNames(newTags) }
      })
      update((data) => ({
        tag_groups: [...data.tag_groups, result.tag_group],
        choices: byName([...data.choices, { id: result.tag_group.id, name: result.tag_group.name }])
      }))
      setNewName('')
      setNewTags('')
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  // Renames travel into the rules too: a requirement names its group.
  const saveGroup = async (group: NodeTagGroup, fields: { name?: string; tags?: string[] }): Promise<boolean> => {
    setSaving(true)
    try {
      const result = await modRequest<{ tag_group: NodeTagGroup }>({
        method: 'PUT',
        path: `${endpoint}/${group.id}.json`,
        json: fields
      })
      const saved = result.tag_group
      update((data) => ({
        tag_groups: data.tag_groups.map((other) => (other.id === group.id ? saved : other)),
        choices: byName(data.choices.map((choice) => (choice.id === group.id ? { id: choice.id, name: saved.name } : choice)))
      }))
      if (saved.name !== group.name) {
        setRequired((rules) => rules.map((rule) => (rule.name === group.name ? { ...rule, name: saved.name } : rule)))
      }
      return true
    } catch (error) {
      toastError(error)
      return false
    } finally {
      setSaving(false)
    }
  }

  const removeGroup = async (group: NodeTagGroup): Promise<void> => {
    const ok = await confirm({
      message: t('nodeModExtra.tags.confirmDeleteGroup', { name: group.name }),
      confirmLabel: t('nodeModExtra.common.delete')
    })
    if (!ok) return
    try {
      await modRequest({ method: 'DELETE', path: `${endpoint}/${group.id}.json` })
      update((data) => ({
        tag_groups: data.tag_groups.filter((other) => other.id !== group.id),
        choices: data.choices.filter((choice) => choice.id !== group.id)
      }))
      setRequired((rules) => rules.filter((rule) => rule.name !== group.name))
      invalidate()
    } catch (error) {
      toastError(error)
    }
  }

  const addRequirement = (): void => {
    const used = new Set(required.map((rule) => rule.name))
    const next = choices.find((choice) => !used.has(choice.name))
    if (next) setRequired([...required, { name: next.name, min_count: 1 }])
  }

  const saveRules = async (): Promise<void> => {
    setSaving(true)
    try {
      // JSON so an empty requirement list reaches the server as an empty list.
      await saveNodeSettings(category.id, { minimum_required_tags: minimum, required_tag_groups: required })
      showToast(t('nodeModExtra.tags.saved'), 'success')
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  if (taggingDisabled) {
    return (
      <div className={styles.section}>
        <SectionHeader title={t('nodeModExtra.tags.title')} lede={t('nodeModExtra.tags.lede')} />
        <EmptyState title={t('nodeModExtra.tags.disabled')} />
      </div>
    )
  }

  return (
    <div className={styles.section}>
      <SectionHeader title={t('nodeModExtra.tags.title')} lede={t('nodeModExtra.tags.lede')} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.tags.groups')}</h2>
        <p className={styles.hint}>{t('nodeModExtra.tags.groupsHint')}</p>

        {query.isPending ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : query.isError ? (
          <EmptyState
            title={t('nodeModExtra.common.loadFailed')}
            action={<Button onClick={() => void query.refetch()}>{t('nodeModExtra.common.retry')}</Button>}
          />
        ) : groups.length > 0 ? (
          <div className={styles.cards}>
            {groups.map((group) => (
              <TagGroupCard
                key={group.id}
                group={group}
                busy={saving}
                onSave={saveGroup}
                onRemove={(target) => void removeGroup(target)}
                onStyle={setStyling}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Layers />} title={t('nodeModExtra.tags.empty')} />
        )}

        <div className={styles.divider} />

        <form className={styles.field} onSubmit={(event) => void createGroup(event)}>
          <h3 className={styles.subTitle}>{t('nodeModExtra.tags.newGroup')}</h3>
          <Field label={t('nodeModExtra.tags.newGroupName')} htmlFor="mod-tags-group-name">
            <input
              id="mod-tags-group-name"
              className={styles.input}
              maxLength={100}
              placeholder={t('nodeModExtra.tags.newGroupNamePlaceholder')}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </Field>
          <Field label={t('nodeModExtra.tags.newGroupTags')} htmlFor="mod-tags-group-tags">
            <input id="mod-tags-group-tags" className={styles.input} value={newTags} onChange={(event) => setNewTags(event.target.value)} />
          </Field>
          <div className={styles.row}>
            <Button type="submit" variant="primary" icon={<Plus />} disabled={saving || !newName.trim()}>
              {t('nodeModExtra.tags.createGroup')}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.tags.rules')}</h2>

        <Field label={t('nodeModExtra.tags.minTags')} hint={t('nodeModExtra.tags.minTagsHint')} htmlFor="mod-tags-minimum">
          <input
            id="mod-tags-minimum"
            type="number"
            min={0}
            max={10}
            className={`${styles.input} ${styles.number}`}
            value={minimum}
            onChange={(event) => setMinimum(Math.max(0, parseInt(event.target.value, 10) || 0))}
          />
        </Field>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('nodeModExtra.tags.required')}</span>
          <span className={styles.hint}>{t('nodeModExtra.tags.requiredHint')}</span>
          {required.map((rule, index) => (
            <div key={index} className={styles.row}>
              <select
                className={`${styles.select} ${styles.grow}`}
                value={rule.name}
                onChange={(event) =>
                  setRequired(required.map((other, i) => (i === index ? { ...other, name: event.target.value } : other)))
                }
              >
                {!choices.some((choice) => choice.name === rule.name) && <option value={rule.name}>{rule.name}</option>}
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.name}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <span className={styles.hint}>{t('nodeModExtra.tags.requiredCount')}</span>
              <input
                type="number"
                min={1}
                max={10}
                className={`${styles.input} ${styles.number}`}
                value={rule.min_count}
                onChange={(event) =>
                  setRequired(
                    required.map((other, i) => (i === index ? { ...other, min_count: Math.max(1, parseInt(event.target.value, 10) || 1) } : other))
                  )
                }
              />
              <IconButton size="sm" label={t('nodeModExtra.tags.removeRequirement')} onClick={() => setRequired(required.filter((_, i) => i !== index))}>
                <X />
              </IconButton>
            </div>
          ))}
          <div className={styles.row}>
            <Button size="sm" icon={<Plus />} disabled={choices.length <= required.length} onClick={addRequirement}>
              {t('nodeModExtra.tags.addRequirement')}
            </Button>
            {query.isSuccess && choices.length === 0 && <span className={styles.hint}>{t('nodeModExtra.tags.noChoices')}</span>}
          </div>
        </div>

        <div className={styles.row}>
          <Button variant="primary" disabled={saving} onClick={() => void saveRules()}>
            {t('nodeModExtra.tags.save')}
          </Button>
        </div>
      </section>

      <TagStyleDialog categoryId={category.id} tag={styling} onClose={() => setStyling(null)} />
      {confirmElement}
    </div>
  )
}
