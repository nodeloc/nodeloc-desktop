import { useQueryClient } from '@tanstack/react-query'
import { Tag, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SITE_QUERY_KEY, useSite } from '../../../api/site'
import type { SiteResponse } from '../../../api/types'
import { Button, IconButton } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { showToast } from '../../../components/toast-store'
import { modRequest, type TagStyle, type TagStyleResponse } from '../extra-api'
import { extraStyles as styles, Field, useErrorToast } from './extra-ui'

const DEFAULT_COLOR = '3b82f6'
/** TagStyle::ICON */
const ICON_PATTERN = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/
const INK_THRESHOLD = 150

/** Near-black or white, whichever reads on the ground (the server's tag-ink rule). */
function inkFor(hex: string): string {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '1c1c1e'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < INK_THRESHOLD ? 'ffffff' : '1c1c1e'
}

interface TagStyleDialogProps {
  categoryId: number
  /** The tag being styled; null keeps the dialog closed. */
  tag: string | null
  onClose: () => void
}

/** How one of the node's tags is drawn: an icon and a ground. */
export function TagStyleDialog({ categoryId, tag, onClose }: TagStyleDialogProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!tag) return null
  return (
    <Dialog open onClose={onClose} title={t('nodeModExtra.tagStyle.titleFor', { tag })} width={460}>
      <TagStyleEditor key={tag} categoryId={categoryId} tag={tag} onDone={onClose} />
    </Dialog>
  )
}

function TagStyleEditor({ categoryId, tag, onDone }: { categoryId: number; tag: string; onDone: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  // The site's copy is what every tag on screen is drawn from.
  const current = useSite().data?.community_tag_styles?.[tag]
  const [icon, setIcon] = useState(current?.icon ?? '')
  const [color, setColor] = useState<string | null>(current?.color ?? null)
  const [saving, setSaving] = useState(false)

  const iconValue = icon.trim().toLowerCase()
  const iconInvalid = iconValue !== '' && !ICON_PATTERN.test(iconValue)
  const hasStyle = Boolean(iconValue || color)

  const save = async (nextIcon: string, nextColor: string | null): Promise<void> => {
    setSaving(true)
    try {
      const result = await modRequest<TagStyleResponse>({
        method: 'PUT',
        path: `/node/${categoryId}/tag-style.json`,
        form: [
          ['tag', tag],
          ['icon', nextIcon],
          ['color', nextColor ?? '']
        ]
      })
      queryClient.setQueryData<SiteResponse>(SITE_QUERY_KEY, (site) => {
        if (!site) return site
        const styles: Record<string, TagStyle> = { ...(site.community_tag_styles ?? {}) }
        if (result.removed || !result.style || Object.keys(result.style).length === 0) delete styles[tag]
        else styles[tag] = result.style
        return { ...site, community_tag_styles: styles }
      })
      showToast(t('nodeModExtra.tagStyle.saved'), 'success')
      onDone()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.section} style={{ gap: 'var(--space-4)' }}>
      <p className={styles.hint}>{t('nodeModExtra.tagStyle.lede')}</p>

      <Field
        label={t('nodeModExtra.tagStyle.icon')}
        htmlFor="mod-tag-style-icon"
        hint={iconInvalid ? <span className={styles.errorText}>{t('nodeModExtra.tagStyle.iconInvalid')}</span> : t('nodeModExtra.tagStyle.iconHint')}
      >
        <input
          id="mod-tag-style-icon"
          className={`${styles.input} ${styles.mono}`}
          maxLength={60}
          value={icon}
          aria-invalid={iconInvalid}
          onChange={(event) => setIcon(event.target.value)}
        />
      </Field>

      <Field label={t('nodeModExtra.tagStyle.color')} htmlFor="mod-tag-style-color">
        <div className={styles.colorRow}>
          <input
            id="mod-tag-style-color"
            type="color"
            className={styles.colorInput}
            value={`#${color ?? DEFAULT_COLOR}`}
            onChange={(event) => setColor(event.target.value.replace('#', '').toLowerCase())}
          />
          <span className={styles.hint}>{color ? `#${color}` : t('nodeModExtra.tagStyle.noColor')}</span>
          {color && (
            <IconButton size="sm" label={t('nodeModExtra.tagStyle.clearColor')} onClick={() => setColor(null)}>
              <X />
            </IconButton>
          )}
        </div>
      </Field>

      <div className={styles.row}>
        <span className={styles.fieldLabel}>{t('nodeModExtra.tagStyle.preview')}</span>
        <span
          className={styles.tagPreview}
          style={color ? { backgroundColor: `#${color}`, borderColor: `#${color}`, color: `#${inkFor(color)}` } : undefined}
        >
          {iconValue && <Tag />}
          {tag}
        </span>
      </div>

      <div className={styles.row}>
        <Button variant="primary" disabled={saving || iconInvalid} onClick={() => void save(iconValue, color)}>
          {t('nodeModExtra.tagStyle.save')}
        </Button>
        {hasStyle && (
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setIcon('')
              setColor(null)
              void save('', null)
            }}
          >
            {t('nodeModExtra.tagStyle.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
