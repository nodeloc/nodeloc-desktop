import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UploadRef } from '../../../api/types'
import { Button, IconButton } from '../../../components/Button'
import { EmptyState } from '../../../components/EmptyState'
import { absoluteUrl } from '../../../lib/discourse'
import { useOpenLink } from '../../../lib/open-link'
import { extraKeys, modRequest, type AdsResponse, type NodeAd } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, ImageField, SectionHeader, useConfirm, useErrorToast } from './extra-ui'
import { useInvalidateNodeMod } from './use-invalidate'

const NEW = 'new'

interface Draft {
  title: string
  url: string
  description: string
  image: UploadRef | null
  /** An image given by URL rather than uploaded (older links). */
  imageUrl: string
}

const EMPTY: Draft = { title: '', url: '', description: '', image: null, imageUrl: '' }

/** The node's links: small banners beside its topics (the ads endpoints). */
export function LinksSection({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const openLink = useOpenLink()
  const [confirm, confirmElement] = useConfirm()
  const endpoint = `/node/${category.id}/ads`

  const query = useQuery({
    queryKey: extraKeys.ads(category.id),
    queryFn: () => modRequest<AdsResponse>({ path: `${endpoint}.json` }),
    // The mod tools payload carries the same list; start from it.
    initialData: { ads: (mod.ads ?? []) as unknown as NodeAd[], max_ads: mod.max_ads ?? 0 } satisfies AdsResponse,
    staleTime: 30_000
  })
  const ads = query.data.ads ?? []
  const maxAds = query.data.max_ads ?? 0
  const canAddMore = maxAds <= 0 || ads.length < maxAds

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const canSave = !saving && draft.title.trim() !== '' && draft.url.trim() !== ''

  const setAds = (next: (ads: NodeAd[]) => NodeAd[]): void => {
    queryClient.setQueryData<AdsResponse>(extraKeys.ads(category.id), (data) => (data ? { ...data, ads: next(data.ads ?? []) } : data))
  }

  const startEdit = (ad: NodeAd): void => {
    setEditing(ad.id)
    setDraft({
      title: ad.title ?? '',
      url: ad.url ?? '',
      description: ad.description ?? '',
      image: ad.upload_id && ad.image_url ? { id: ad.upload_id, url: ad.image_url } : null,
      imageUrl: ad.upload_id ? '' : (ad.image_url ?? '')
    })
  }

  const save = async (): Promise<void> => {
    if (!canSave || !editing) return
    const body: Record<string, unknown> = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      url: draft.url.trim()
    }
    // An uploaded picture wins; otherwise whatever URL is left (or none).
    if (draft.image) body.upload_id = draft.image.id
    else body.image_url = draft.imageUrl
    setSaving(true)
    try {
      if (editing === NEW) {
        const result = await modRequest<{ ad: NodeAd }>({ method: 'POST', path: `${endpoint}.json`, json: body })
        setAds((list) => [...list, result.ad])
      } else {
        const id = editing
        const result = await modRequest<{ ad: NodeAd }>({ method: 'PUT', path: `${endpoint}/${encodeURIComponent(id)}.json`, json: body })
        setAds((list) => list.map((ad) => (ad.id === id ? result.ad : ad)))
      }
      setEditing(null)
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (ad: NodeAd): Promise<void> => {
    const ok = await confirm({ message: t('nodeModExtra.links.confirmDelete', { title: ad.title }), confirmLabel: t('nodeModExtra.common.delete') })
    if (!ok) return
    try {
      await modRequest({ method: 'DELETE', path: `${endpoint}/${encodeURIComponent(ad.id)}.json` })
      setAds((list) => list.filter((other) => other.id !== ad.id))
      if (editing === ad.id) setEditing(null)
      invalidate()
    } catch (error) {
      toastError(error)
    }
  }

  const previewImage = draft.image ?? (draft.imageUrl ? { id: 0, url: draft.imageUrl } : null)

  return (
    <div className={styles.section}>
      <SectionHeader
        title={t('nodeModExtra.links.title')}
        lede={t('nodeModExtra.links.lede')}
        actions={
          <>
            {maxAds > 0 && <span className={styles.count}>{t('nodeModExtra.links.limit', { current: ads.length, max: maxAds })}</span>}
            <Button
              variant="primary"
              icon={<Plus />}
              disabled={!canAddMore || editing === NEW}
              onClick={() => {
                setEditing(NEW)
                setDraft(EMPTY)
              }}
            >
              {t('nodeModExtra.links.add')}
            </Button>
          </>
        }
      />

      {editing && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{editing === NEW ? t('nodeModExtra.links.newTitle') : t('nodeModExtra.links.editTitle')}</h2>
          <Field label={t('nodeModExtra.links.titleLabel')} htmlFor="mod-link-title">
            <input
              id="mod-link-title"
              className={styles.input}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </Field>
          <Field label={t('nodeModExtra.links.urlLabel')} htmlFor="mod-link-url">
            <input
              id="mod-link-url"
              type="url"
              className={styles.input}
              placeholder="https://"
              value={draft.url}
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            />
          </Field>
          <Field label={t('nodeModExtra.links.descriptionLabel')} htmlFor="mod-link-description">
            <textarea
              id="mod-link-description"
              className={styles.textarea}
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </Field>
          <ImageField
            label={t('nodeModExtra.links.imageLabel')}
            hint={t('nodeModExtra.links.imageHint')}
            image={previewImage}
            uploadType="avatar"
            wide
            onChange={(image) => setDraft({ ...draft, image, imageUrl: '' })}
          />
          <div className={styles.row}>
            <Button variant="primary" disabled={!canSave} onClick={() => void save()}>
              {t('nodeModExtra.links.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('nodeModExtra.common.cancel')}
            </Button>
          </div>
        </section>
      )}

      {ads.length > 0 ? (
        <ul className={styles.list}>
          {ads.map((ad) => (
            <li key={ad.id} className={styles.item}>
              {ad.image_url && <img className={styles.linkImage} src={absoluteUrl(ad.image_url)} alt="" />}
              <div className={styles.itemBody}>
                <span className={styles.itemTitle}>{ad.title}</span>
                <button type="button" className={`${styles.linkButton} ${styles.itemMeta}`} onClick={() => openLink(ad.url)}>
                  {ad.url}
                </button>
              </div>
              <div className={styles.itemActions}>
                <IconButton size="sm" label={t('nodeModExtra.links.edit')} onClick={() => startEdit(ad)}>
                  <Pencil />
                </IconButton>
                <IconButton size="sm" label={t('nodeModExtra.links.delete')} className={styles.dangerIcon} onClick={() => void remove(ad)}>
                  <Trash2 />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Link2 />} title={t('nodeModExtra.links.empty')} />
      )}
      {confirmElement}
    </div>
  )
}
