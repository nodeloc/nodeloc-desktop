import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ImagePlus, X } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { UploadRef } from '../../../api/types'
import { apiRequest } from '../../../api/client'
import { useErrorMessage } from '../../../api/use-error-message'
import { Avatar } from '../../../components/Avatar'
import { Button, IconButton } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { absoluteUrl } from '../../../lib/discourse'
import { parseDate } from '../../../lib/format'
import { ChipInput, type ChipOption } from '../../composer/ChipInput'
import type { UserSearchResponse } from '../../composer/types'
import { useDebouncedValue } from '../../composer/use-debounced-value'
import { emojiUrl, useEmojiIndex } from '../../content/use-emoji'
import type { UploadType } from '@shared/api'
import { uploadImage } from '../extra-api'
import styles from './extra.module.css'

export { styles as extraStyles }

export function SectionHeader({ title, lede, actions }: { title: string; lede?: string; actions?: ReactNode }): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h1 className={styles.title}>{title}</h1>
        {lede && <p className={styles.lede}>{lede}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  )
}

export interface TabItem<K extends string> {
  key: K
  label: string
  count?: number
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: TabItem<K>[]; value: K; onChange: (key: K) => void }): React.JSX.Element {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === value}
          className={cx(styles.tab, tab.key === value && styles.tabActive)}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {!!tab.count && <span className={styles.tabCount}>{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, htmlFor, required, children }: { label: string; hint?: ReactNode; htmlFor?: string; required?: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>
        {label}
        {required && <span className={styles.required}>{required}</span>}
      </label>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

/** Shows the error of a failed request as a toast, with the server's message where it has one. */
export function useErrorToast(): (error: unknown) => void {
  const describe = useErrorMessage()
  return useCallback((error: unknown) => showToast(describe(error), 'danger'), [describe])
}

interface ConfirmRequest {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

/**
 * A confirmation dialog driven by a promise: `if (await confirm({...}))`.
 * Render the returned element once in the section.
 */
export function useConfirm(): [(request: ConfirmRequest) => Promise<boolean>, React.JSX.Element] {
  const { t } = useTranslation()
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setRequest(null)
  }, [])

  const confirm = useCallback((next: ConfirmRequest) => {
    resolver.current?.(false)
    setRequest(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const element = (
    <Dialog
      open={request !== null}
      onClose={() => settle(false)}
      title={request?.title}
      width={400}
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {t('nodeModExtra.common.cancel')}
          </Button>
          <Button variant="primary" className={cx(request?.danger !== false && styles.dangerButton)} onClick={() => settle(true)}>
            {request?.confirmLabel ?? t('nodeModExtra.common.confirm')}
          </Button>
        </>
      }
    >
      <p className={styles.lede}>{request?.message}</p>
    </Dialog>
  )

  return [confirm, element]
}

/** A picture field: preview, upload from disk, remove. */
export function ImageField({
  label,
  hint,
  image,
  onChange,
  uploadType,
  wide = false
}: {
  label: string
  hint?: string
  image: UploadRef | null
  onChange: (image: UploadRef | null) => void
  /** The upload type the web uses for this picture (see `uploadImage`). */
  uploadType: UploadType
  wide?: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const toastError = useErrorToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setBusy(true)
    try {
      const upload = await uploadImage(file, uploadType)
      onChange({ id: upload.id, url: upload.url, width: upload.width ?? undefined, height: upload.height ?? undefined })
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.imageField}>
        <div className={styles.imagePreview} style={wide ? { width: 200 } : undefined}>
          {image ? <img src={absoluteUrl(image.url)} alt="" /> : <ImagePlus />}
        </div>
        <div className={styles.row}>
          <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? t('nodeModExtra.common.uploading') : image ? t('nodeModExtra.common.replaceImage') : t('nodeModExtra.common.upload')}
          </Button>
          {image && !busy && (
            <IconButton size="sm" label={t('nodeModExtra.common.removeImage')} className={styles.dangerIcon} onClick={() => onChange(null)}>
              <X />
            </IconButton>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={(event) => void pick(event.target.files?.[0])}
        />
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

export interface FlairLook {
  text: string
  emoji?: string | null
  background_color?: string | null
  text_color?: string | null
}

/** A node flair: a few words on a colour, as CommunityFlair draws it. */
export function FlairPill({ flair }: { flair: FlairLook }): React.JSX.Element {
  const emoji = useEmojiIndex()
  const background = /^[0-9a-f]{6}$/i.test(flair.background_color ?? '') ? flair.background_color : 'e5ebee'
  return (
    <span
      className={cx(styles.pill, flair.text_color === 'light' ? styles.pillLight : styles.pillDark)}
      style={{ backgroundColor: `#${background}` }}
      title={flair.text}
    >
      {flair.emoji && <img src={emojiUrl(emoji, flair.emoji)} alt="" />}
      <span className={styles.pillText}>{flair.text}</span>
    </span>
  )
}

/** Usernames picked from the site's user search. */
export function UserPicker({ value, onChange, max, id }: { value: string[]; onChange: (usernames: string[]) => void; max?: number; id?: string }): React.JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const term = useDebouncedValue(query.trim().replace(/^@/, ''), 250)

  const search = useQuery({
    queryKey: ['node-mod-extra', 'user-search', term],
    queryFn: () => apiRequest<UserSearchResponse>({ path: '/u/search/users.json', query: { term, limit: 8 } }),
    enabled: term.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000
  })

  const options: ChipOption[] = term
    ? (search.data?.users ?? []).map((user) => ({
        key: user.username,
        value: user.username,
        label: user.username,
        detail: user.name ?? undefined,
        icon: <Avatar template={user.avatar_template} username={user.username} size={20} />
      }))
    : []

  return (
    <ChipInput
      id={id}
      values={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={options}
      loading={search.isFetching}
      placeholder={t('nodeModExtra.common.userPlaceholder')}
      max={max}
      removeLabel={(name) => t('nodeModExtra.common.removeUser', { name })}
    />
  )
}

/** A calendar date in the reader's language, empty for a missing value. */
export function formatDay(value: string | null | undefined, locale: string): string {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : ''
}

/** Month, day and time, as the web's "MM-DD HH:mm". */
export function formatShortTime(value: string | null | undefined, locale: string): string {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat(locale, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date) : ''
}
