import { useQueryClient } from '@tanstack/react-query'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { apiRequest } from '../../../api/client'
import { useErrorMessage } from '../../../api/use-error-message'
import { Button, IconButton } from '../../../components/Button'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { ConfirmDialog, ModEmpty, ModIntro, ModPanel, modStyles } from '../ModUi'
import type { ModSectionProps } from '../sections'
import type { ModRule, ModToolsData } from '../types'
import { nodeModKey, useRefreshNodeMod } from '../use-mod-tools'
import styles from './rules.module.css'

const NEW = 'new'

/**
 * The node's rules, one open editor at a time (components/mod-tools/rules.gjs).
 * RulesController: `POST /node/:id/rules`, `PUT|DELETE /node/:id/rules/:rule_id`,
 * each with `title` and `description`; owner or admin only. There is no
 * endpoint for reordering, so rules keep the order they were added in.
 */
export function RulesSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const refresh = useRefreshNodeMod(category)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<ModRule | null>(null)

  const endpoint = `/node/${category.id}/rules`
  const canSave = !saving && draftTitle.trim().length > 0

  const patchRules = (update: (rules: ModToolsData['rules']) => ModToolsData['rules']): void => {
    queryClient.setQueryData<ModToolsData>(nodeModKey(category.id), (data) => (data ? { ...data, rules: update(data.rules) } : data))
  }

  const startNew = (): void => {
    setEditing(NEW)
    setDraftTitle('')
    setDraftDescription('')
  }

  const startEdit = (rule: ModRule): void => {
    setEditing(rule.id)
    setDraftTitle(rule.title ?? '')
    setDraftDescription(rule.description ?? '')
  }

  const save = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!canSave || !editing) return
    const form: Array<[string, string]> = [
      ['title', draftTitle.trim()],
      ['description', draftDescription.trim()]
    ]
    setSaving(true)
    try {
      if (editing === NEW) {
        const { rule } = await apiRequest<{ rule: ModRule }>({ method: 'POST', path: `${endpoint}.json`, form, priority: 'user' })
        patchRules((rules) => [...rules, rule])
      } else {
        const id = editing
        const { rule } = await apiRequest<{ rule: ModRule }>({
          method: 'PUT',
          path: `${endpoint}/${encodeURIComponent(id)}.json`,
          form,
          priority: 'user'
        })
        patchRules((rules) => rules.map((entry) => (typeof entry !== 'string' && entry.id === id ? rule : entry)))
      }
      setEditing(null)
      showToast(t('nodeMod.rules.saved'), 'success')
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (rule: ModRule): Promise<void> => {
    try {
      await apiRequest<null>({ method: 'DELETE', path: `${endpoint}/${encodeURIComponent(rule.id)}.json`, priority: 'user' })
      patchRules((rules) => rules.filter((entry) => typeof entry === 'string' || entry.id !== rule.id))
      if (editing === rule.id) setEditing(null)
      showToast(t('nodeMod.rules.deleted'), 'success')
      void refresh()
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    }
  }

  const editor = (compact: boolean): React.JSX.Element => (
    <form className={styles.editor} onSubmit={(event) => void save(event)}>
      <label className={modStyles.field}>
        {t('nodeMod.rules.ruleTitle')}
        <input
          className={modStyles.input}
          value={draftTitle}
          maxLength={200}
          autoFocus
          onChange={(event) => setDraftTitle(event.target.value)}
        />
      </label>
      <label className={modStyles.field}>
        {t('nodeMod.rules.ruleDescription')}
        <textarea
          className={modStyles.textarea}
          rows={3}
          value={draftDescription}
          onChange={(event) => setDraftDescription(event.target.value)}
        />
      </label>
      <div className={modStyles.formRow}>
        <Button type="submit" variant="primary" size={compact ? 'sm' : 'md'} disabled={!canSave}>
          {t('nodeMod.rules.save')}
        </Button>
        <Button variant="ghost" size={compact ? 'sm' : 'md'} onClick={() => setEditing(null)} disabled={saving}>
          {t('nodeMod.rules.cancel')}
        </Button>
      </div>
    </form>
  )

  const rules = mod.rules

  return (
    <>
      <ModIntro
        actions={
          <Button variant="primary" icon={<Plus />} onClick={startNew} disabled={editing === NEW}>
            {t('nodeMod.rules.add')}
          </Button>
        }
      >
        {t('nodeMod.rules.lede')}
      </ModIntro>

      {editing === NEW && <ModPanel>{editor(false)}</ModPanel>}

      {rules.length > 0 ? (
        <ModPanel>
          <ol className={modStyles.list}>
            {rules.map((rule, index) => {
              if (typeof rule === 'string') {
                return (
                  <li key={`legacy-${index}`} className={modStyles.row} title={t('nodeMod.rules.legacy')}>
                    <span className={styles.number}>{index + 1}</span>
                    <div className={modStyles.rowBody}>
                      <div className={cx(modStyles.rowTitle, styles.ruleTitle)}>{rule}</div>
                    </div>
                  </li>
                )
              }
              return (
                <li key={rule.id} className={modStyles.row}>
                  {editing === rule.id ? (
                    <div className={modStyles.rowBody}>{editor(true)}</div>
                  ) : (
                    <>
                      <span className={styles.number}>{index + 1}</span>
                      <div className={modStyles.rowBody}>
                        <div className={cx(modStyles.rowTitle, styles.ruleTitle)}>{rule.title}</div>
                        {rule.description && <div className={cx(modStyles.rowMeta, styles.description)}>{rule.description}</div>}
                      </div>
                      <div className={modStyles.rowActions}>
                        <IconButton label={t('nodeMod.rules.edit')} size="sm" onClick={() => startEdit(rule)}>
                          <Pencil />
                        </IconButton>
                        <IconButton
                          label={t('nodeMod.rules.delete')}
                          size="sm"
                          className={modStyles.dangerIcon}
                          onClick={() => setDeleting(rule)}
                        >
                          <Trash2 />
                        </IconButton>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ol>
        </ModPanel>
      ) : (
        editing !== NEW && (
          <ModPanel>
            <ModEmpty icon={<BookOpen />}>{t('nodeMod.rules.empty')}</ModEmpty>
          </ModPanel>
        )
      )}

      <ConfirmDialog
        open={deleting !== null}
        message={t('nodeMod.rules.confirmDelete', { title: deleting?.title ?? '' })}
        confirmLabel={t('nodeMod.rules.delete')}
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve())}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
