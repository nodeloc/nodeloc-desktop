import { Check, Layers, Palette, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, IconButton } from '../../../components/Button'
import type { NodeTagGroup } from '../extra-api'
import { extraStyles as styles } from './extra-ui'

export function cleanTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, '-').toLowerCase()
}

interface TagGroupCardProps {
  group: NodeTagGroup
  busy: boolean
  /** Saves a rename or a new tag list; resolves true when it went through. */
  onSave: (group: NodeTagGroup, fields: { name?: string; tags?: string[] }) => Promise<boolean>
  onRemove: (group: NodeTagGroup) => void
  onStyle: (tagName: string) => void
}

/** One of the node's tag groups: its name, its tags, and the ways to change either. */
export function TagGroupCard({ group, busy, onSave, onRemove, onStyle }: TagGroupCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [newTag, setNewTag] = useState('')

  const tagNames = group.tags.map((tag) => tag.name)
  const cleanNew = cleanTagName(newTag)
  const canAddTag = !busy && cleanNew !== '' && !tagNames.includes(cleanNew)
  const canRename = !busy && draftName.trim() !== '' && draftName.trim() !== group.name

  const submitRename = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!canRename) return
    if (await onSave(group, { name: draftName.trim() })) setRenaming(false)
  }

  const addTag = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    if (!canAddTag) return
    if (await onSave(group, { tags: [...tagNames, cleanNew] })) setNewTag('')
  }

  return (
    <div className={styles.card}>
      {renaming ? (
        <form className={styles.row} onSubmit={(event) => void submitRename(event)}>
          <input
            className={`${styles.input} ${styles.grow}`}
            maxLength={100}
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
          />
          <Button type="submit" size="sm" variant="primary" icon={<Check />} disabled={!canRename}>
            {t('nodeModExtra.common.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
            {t('nodeModExtra.common.cancel')}
          </Button>
        </form>
      ) : (
        <div className={styles.cardHead}>
          <span className={styles.cardName}>
            <Layers />
            {group.name}
            <span className={styles.badge}>{t('nodeModExtra.tags.groupTags', { count: group.tags.length })}</span>
          </span>
          <IconButton
            size="sm"
            label={t('nodeModExtra.tags.rename')}
            disabled={busy}
            onClick={() => {
              setDraftName(group.name)
              setRenaming(true)
            }}
          >
            <Pencil />
          </IconButton>
          <IconButton size="sm" label={t('nodeModExtra.tags.deleteGroup')} className={styles.dangerIcon} disabled={busy} onClick={() => onRemove(group)}>
            <Trash2 />
          </IconButton>
        </div>
      )}

      {group.tags.length > 0 ? (
        <div className={styles.chips}>
          {group.tags.map((tag) => (
            <span key={tag.id} className={styles.chip}>
              <Tag />
              {tag.name}
              <button type="button" className={styles.chipButton} title={t('nodeModExtra.tags.styleTag', { name: tag.name })} aria-label={t('nodeModExtra.tags.styleTag', { name: tag.name })} onClick={() => onStyle(tag.name)}>
                <Palette />
              </button>
              <button
                type="button"
                className={styles.chipButton}
                title={t('nodeModExtra.tags.removeTag', { name: tag.name })}
                aria-label={t('nodeModExtra.tags.removeTag', { name: tag.name })}
                disabled={busy}
                onClick={() => void onSave(group, { tags: tagNames.filter((name) => name !== tag.name) })}
              >
                <X />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.hint}>{t('nodeModExtra.tags.noTags')}</p>
      )}

      <form className={styles.row} onSubmit={(event) => void addTag(event)}>
        <input
          className={`${styles.input} ${styles.grow}`}
          maxLength={30}
          placeholder={t('nodeModExtra.tags.addTagPlaceholder')}
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
        />
        <Button type="submit" size="sm" icon={<Plus />} disabled={!canAddTag}>
          {t('nodeModExtra.tags.addTag')}
        </Button>
      </form>
    </div>
  )
}
