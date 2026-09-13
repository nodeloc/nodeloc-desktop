import { ArrowRightLeft, Palette, User, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { UploadRef } from '../../../api/types'
import { Button } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { Switch } from '../../../components/Switch'
import { showToast } from '../../../components/toast-store'
import { cx } from '../../../lib/cx'
import { paths } from '../../../lib/routes'
import { modRequest, saveNodeSettings, type EditableCategory, type PendingTransfer } from '../extra-api'
import type { ModSectionProps } from '../sections'
import { extraStyles as styles, Field, formatShortTime, ImageField, SectionHeader, Tabs, UserPicker, useConfirm, useErrorToast } from './extra-ui'
import { useInvalidateNodeMod } from './use-invalidate'
import { VerificationSection } from './verification'

const WATCHING_FIRST_POST = 4
const REGULAR = 1

const FULL = 1
const CREATE_POST = 2
const READONLY = 3
const SLOW_MODE_CHOICES = [0, 60, 300, 900, 3600, 14400, 86400]

type Access = 'hidden' | 'read' | 'reply' | 'post'
type MemberAccess = Exclude<Access, 'hidden'>

/** A door setting in core's category-group terms; "hidden" is no grant at all. */
const ACCESS_TO_PERMISSION: Record<Access, number | null> = { hidden: null, read: READONLY, reply: CREATE_POST, post: FULL }
const PERMISSION_TO_ACCESS: Record<number, MemberAccess> = { [READONLY]: 'read', [CREATE_POST]: 'reply', [FULL]: 'post' }
const OUTSIDER_CHOICES: Access[] = ['hidden', 'read', 'reply', 'post']
const MEMBER_CHOICES: MemberAccess[] = ['read', 'reply', 'post']
const RANK: Record<Access, number> = { hidden: 0, read: 1, reply: 2, post: 3 }

/** Discourse's default `category_colors`; the site's own list isn't sent to the app. */
const SWATCHES = ['0088CC', '808281', 'B3B5B4', 'E45735', 'BF1E2E', 'F7941D', 'FCDC23', '9EB83B', '3AB54A', '12A89D', '25AAE2', '0E76BD', '652D90', '92278F', 'ED207B', '8C6238', '231F20']

interface FormState {
  color: string
  uploaded_logo: UploadRef | null
  uploaded_logo_dark: UploadRef | null
  uploaded_background: UploadRef | null
  uploaded_background_dark: UploadRef | null
  outsiders: Access
  members: MemberAccess
  topic_template: string
  topic_title_placeholder: string
  default_slow_mode_seconds: number
  auto_close_hours: string
  allow_badges: boolean
}

type SettingsTab = 'general' | 'verification' | 'ownership'

/** The node's own settings, saved through the node edit endpoint. */
export function SettingsSection(props: ModSectionProps): React.JSX.Element {
  const { mod } = props
  const { t } = useTranslation()
  const [tab, setTab] = useState<SettingsTab>('general')
  // The owner also sees the official mark and ownership, each on its own tab.
  const tabs = mod.can_transfer_ownership

  return (
    <div className={styles.section}>
      <SettingsHeader {...props} />
      {tabs && (
        <Tabs<SettingsTab>
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'general', label: t('nodeModExtra.settings.tabs.general') },
            { key: 'verification', label: t('nodeModExtra.settings.tabs.verification') },
            { key: 'ownership', label: t('nodeModExtra.settings.tabs.ownership') }
          ]}
        />
      )}
      {(!tabs || tab === 'general') && <GeneralSettings {...props} />}
      {tabs && tab === 'verification' && <VerificationSection {...props} />}
      {tabs && tab === 'ownership' && <OwnershipPanel {...props} />}
    </div>
  )
}

function SettingsHeader({ category }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <SectionHeader
      title={t('nodeModExtra.settings.title')}
      lede={t('nodeModExtra.settings.lede')}
      actions={
        <Button icon={<Palette />} onClick={() => navigate(paths.node(category.slug))}>
          {t('nodeModExtra.settings.liveAppearance')}
        </Button>
      }
    />
  )
}

function initialForm(mod: ModSectionProps['mod'], membersGroupName: string): FormState {
  const category = mod.category as unknown as EditableCategory
  const grants = category.group_permissions ?? []
  const everyone = grants.find((grant) => grant.group_name === 'everyone')
  const members = grants.find((grant) => grant.group_name === membersGroupName)
  const autoClose = category.auto_close_hours
  return {
    color: (category.color ?? mod.community.color ?? '0088CC').replace('#', ''),
    uploaded_logo: category.uploaded_logo ?? null,
    uploaded_logo_dark: category.uploaded_logo_dark ?? null,
    uploaded_background: category.uploaded_background ?? null,
    uploaded_background_dark: category.uploaded_background_dark ?? null,
    outsiders: everyone ? (PERMISSION_TO_ACCESS[everyone.permission_type] ?? 'hidden') : 'hidden',
    members: members ? (PERMISSION_TO_ACCESS[members.permission_type] ?? 'post') : 'post',
    topic_template: category.topic_template ?? '',
    topic_title_placeholder: category.topic_title_placeholder ?? '',
    default_slow_mode_seconds: category.default_slow_mode_seconds ?? 0,
    auto_close_hours: autoClose === null || autoClose === undefined ? '' : String(autoClose),
    allow_badges: category.allow_badges ?? true
  }
}

function GeneralSettings({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const membersGroupName = mod.groups.members?.name ?? `${category.slug}-members`
  const moderatorsGroupName = mod.groups.moderators?.name ?? `${category.slug}-mods`

  const [form, setForm] = useState<FormState>(() => initialForm(mod, membersGroupName))
  const [saving, setSaving] = useState(false)
  const [alerts, setAlerts] = useState(mod.new_topic_alerts)
  const [alertsBusy, setAlertsBusy] = useState(false)

  const patch = (next: Partial<FormState>): void => setForm((current) => ({ ...current, ...next }))

  const colorValid = /^[0-9a-f]{6}$/i.test(form.color)
  const autoCloseNumber = form.auto_close_hours.trim() === '' ? null : Number(form.auto_close_hours)
  const autoCloseInvalid = autoCloseNumber !== null && (!Number.isFinite(autoCloseNumber) || autoCloseNumber < 0)
  const slowModeChoices = SLOW_MODE_CHOICES.includes(form.default_slow_mode_seconds)
    ? SLOW_MODE_CHOICES
    : [...SLOW_MODE_CHOICES, form.default_slow_mode_seconds].sort((a, b) => a - b)

  // The two doors move together so a stranger never gets more than a member.
  const setOutsiders = (value: Access): void => {
    if (RANK[value] > RANK[form.members]) {
      patch({ outsiders: value, members: value as MemberAccess })
      showToast(t('nodeModExtra.settings.accessAdjusted'))
    } else {
      patch({ outsiders: value })
    }
  }

  const setMembers = (value: MemberAccess): void => {
    if (RANK[form.outsiders] > RANK[value]) {
      patch({ members: value, outsiders: value })
      showToast(t('nodeModExtra.settings.accessAdjusted'))
    } else {
      patch({ members: value })
    }
  }

  const toggleAlerts = async (enabled: boolean): Promise<void> => {
    setAlertsBusy(true)
    try {
      await modRequest({
        method: 'POST',
        path: `/category/${category.id}/notifications`,
        form: [['notification_level', enabled ? WATCHING_FIRST_POST : REGULAR]]
      })
      setAlerts(enabled)
      showToast(t('nodeModExtra.settings.newTopicAlertsSaved'), 'success')
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setAlertsBusy(false)
    }
  }

  const save = async (): Promise<void> => {
    if (saving || !colorValid || autoCloseInvalid) return
    const permissions: Record<string, number> = {
      [moderatorsGroupName]: FULL,
      [membersGroupName]: ACCESS_TO_PERMISSION[form.members] ?? FULL
    }
    const everyone = ACCESS_TO_PERMISSION[form.outsiders]
    if (everyone) permissions.everyone = everyone

    setSaving(true)
    try {
      await saveNodeSettings(category.id, {
        color: form.color.toUpperCase(),
        uploaded_logo_id: form.uploaded_logo?.id ?? null,
        uploaded_logo_dark_id: form.uploaded_logo_dark?.id ?? null,
        uploaded_background_id: form.uploaded_background?.id ?? null,
        uploaded_background_dark_id: form.uploaded_background_dark?.id ?? null,
        permissions,
        topic_template: form.topic_template,
        topic_title_placeholder: form.topic_title_placeholder,
        // Off is stored as nothing at all; the model rejects a zero.
        default_slow_mode_seconds: form.default_slow_mode_seconds || null,
        auto_close_hours: autoCloseNumber || null,
        allow_badges: form.allow_badges
      })
      showToast(t('nodeModExtra.settings.saved'), 'success')
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className={styles.panel}>
        <Switch
          checked={alerts}
          disabled={alertsBusy}
          onChange={(enabled) => void toggleAlerts(enabled)}
          label={t('nodeModExtra.settings.newTopicAlerts')}
          description={t('nodeModExtra.settings.newTopicAlertsHint')}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.settings.appearance')}</h2>
        <Field label={t('nodeModExtra.settings.color')} htmlFor="mod-settings-color">
          <div className={styles.colorRow}>
            <input
              type="color"
              className={styles.colorInput}
              aria-label={t('nodeModExtra.settings.color')}
              value={colorValid ? `#${form.color.toLowerCase()}` : '#000000'}
              onChange={(event) => patch({ color: event.target.value.replace('#', '').toUpperCase() })}
            />
            <input
              id="mod-settings-color"
              className={cx(styles.input, styles.hexInput, styles.mono)}
              maxLength={7}
              value={form.color}
              aria-invalid={!colorValid}
              onChange={(event) => patch({ color: event.target.value.replace('#', '').trim() })}
            />
          </div>
          <div className={styles.swatches} role="group" aria-label={t('nodeModExtra.settings.colorPresets')}>
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={cx(styles.swatch, form.color.toUpperCase() === swatch && styles.swatchActive)}
                style={{ backgroundColor: `#${swatch}` }}
                title={`#${swatch}`}
                aria-label={`#${swatch}`}
                onClick={() => patch({ color: swatch })}
              />
            ))}
          </div>
        </Field>
        <div className={styles.grid2}>
          {/* Same upload types as the web mod tools, light and dark alike. */}
          <ImageField
            label={t('nodeModExtra.settings.logo')}
            image={form.uploaded_logo}
            uploadType="category_logo"
            onChange={(image) => patch({ uploaded_logo: image })}
          />
          <ImageField
            label={t('nodeModExtra.settings.logoDark')}
            image={form.uploaded_logo_dark}
            uploadType="category_logo"
            onChange={(image) => patch({ uploaded_logo_dark: image })}
          />
          <ImageField
            label={t('nodeModExtra.settings.background')}
            image={form.uploaded_background}
            uploadType="category_background"
            wide
            onChange={(image) => patch({ uploaded_background: image })}
          />
          <ImageField
            label={t('nodeModExtra.settings.backgroundDark')}
            image={form.uploaded_background_dark}
            uploadType="category_background"
            wide
            onChange={(image) => patch({ uploaded_background_dark: image })}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.settings.access')}</h2>
        <p className={styles.hint}>{t('nodeModExtra.settings.accessLede')}</p>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <h3 className={styles.doorTitle}>
              <User />
              {t('nodeModExtra.settings.outsiders')}
            </h3>
            <p className={styles.hint}>{t('nodeModExtra.settings.outsidersHint')}</p>
            <div className={styles.radioGroup} role="radiogroup" aria-label={t('nodeModExtra.settings.outsiders')}>
              {OUTSIDER_CHOICES.map((choice) => (
                <label key={choice} className={cx(styles.radio, form.outsiders === choice && styles.radioChecked)}>
                  <input type="radio" name="mod-outsiders" checked={form.outsiders === choice} onChange={() => setOutsiders(choice)} />
                  <span className={styles.radioText}>
                    <span className={styles.radioTitle}>{t(`nodeModExtra.settings.accessChoice.${choice}`)}</span>
                    <span className={styles.hint}>{t(`nodeModExtra.settings.accessHint.${choice}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <h3 className={styles.doorTitle}>
              <Users />
              {t('nodeModExtra.settings.members')}
            </h3>
            <p className={styles.hint}>{t('nodeModExtra.settings.membersHint')}</p>
            <div className={styles.radioGroup} role="radiogroup" aria-label={t('nodeModExtra.settings.members')}>
              {MEMBER_CHOICES.map((choice) => (
                <label key={choice} className={cx(styles.radio, form.members === choice && styles.radioChecked)}>
                  <input type="radio" name="mod-members" checked={form.members === choice} onChange={() => setMembers(choice)} />
                  <span className={styles.radioText}>
                    <span className={styles.radioTitle}>{t(`nodeModExtra.settings.accessChoice.${choice}`)}</span>
                    <span className={styles.hint}>{t(`nodeModExtra.settings.membersAccessHint.${choice}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('nodeModExtra.settings.posting')}</h2>
        <Field label={t('nodeModExtra.settings.topicTitlePlaceholder')} htmlFor="mod-settings-placeholder">
          <input
            id="mod-settings-placeholder"
            className={styles.input}
            value={form.topic_title_placeholder}
            onChange={(event) => patch({ topic_title_placeholder: event.target.value })}
          />
        </Field>
        <Field label={t('nodeModExtra.settings.topicTemplate')} hint={t('nodeModExtra.settings.topicTemplateHint')} htmlFor="mod-settings-template">
          <textarea
            id="mod-settings-template"
            className={styles.textarea}
            rows={6}
            value={form.topic_template}
            onChange={(event) => patch({ topic_template: event.target.value })}
          />
        </Field>
        <div className={styles.grid2}>
          <Field label={t('nodeModExtra.settings.slowMode')} htmlFor="mod-settings-slow-mode">
            <select
              id="mod-settings-slow-mode"
              className={styles.select}
              value={form.default_slow_mode_seconds}
              onChange={(event) => patch({ default_slow_mode_seconds: Number(event.target.value) })}
            >
              {slowModeChoices.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds ? t('nodeModExtra.settings.slowModeChoice', { minutes: Math.round(seconds / 60) }) : t('nodeModExtra.settings.slowModeOff')}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t('nodeModExtra.settings.autoClose')}
            htmlFor="mod-settings-auto-close"
            hint={autoCloseInvalid ? <span className={styles.errorText}>{t('nodeModExtra.settings.autoCloseInvalid')}</span> : undefined}
          >
            <input
              id="mod-settings-auto-close"
              type="number"
              min={0}
              className={styles.input}
              value={form.auto_close_hours}
              aria-invalid={autoCloseInvalid}
              onChange={(event) => patch({ auto_close_hours: event.target.value })}
            />
          </Field>
        </div>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.allow_badges} onChange={(event) => patch({ allow_badges: event.target.checked })} />
          {t('nodeModExtra.settings.allowBadges')}
        </label>
      </section>

      <div className={cx(styles.row, styles.rowEnd)}>
        <Button variant="primary" disabled={saving || !colorValid || autoCloseInvalid} onClick={() => void save()}>
          {t('nodeModExtra.settings.save')}
        </Button>
      </div>
    </>
  )
}

function OwnershipPanel({ category, mod }: ModSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const toastError = useErrorToast()
  const invalidate = useInvalidateNodeMod(category)
  const [confirm, confirmElement] = useConfirm()
  const [pending, setPending] = useState<PendingTransfer | null>(mod.pending_transfer ?? null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [usernames, setUsernames] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const endpoint = `/node/edit/${category.id}/transfer-ownership.json`

  const transfer = async (): Promise<void> => {
    const username = usernames[0]
    if (!username || busy) return
    setBusy(true)
    try {
      const result = await modRequest<{ pending_transfer: PendingTransfer | null }>({ method: 'PUT', path: endpoint, json: { username } })
      setPending(result.pending_transfer)
      setDialogOpen(false)
      setUsernames([])
      showToast(t('nodeModExtra.settings.transfer.requested', { username }), 'success')
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (): Promise<void> => {
    if (!pending) return
    const ok = await confirm({
      message: t('nodeModExtra.settings.transfer.confirmWithdraw', { username: pending.user.username }),
      confirmLabel: t('nodeModExtra.settings.transfer.withdraw')
    })
    if (!ok) return
    setBusy(true)
    try {
      await modRequest({ method: 'DELETE', path: endpoint })
      setPending(null)
      showToast(t('nodeModExtra.settings.transfer.withdrawn'), 'success')
      invalidate()
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel}>
      <p className={styles.hint}>{t('nodeModExtra.settings.ownershipHint')}</p>
      {pending ? (
        <>
          <p className={styles.lede}>
            {t('nodeModExtra.settings.transfer.pending', {
              username: pending.user.username,
              date: formatShortTime(pending.requested_at, i18n.language)
            })}
          </p>
          <div className={styles.row}>
            <Button icon={<X />} disabled={busy} onClick={() => void withdraw()}>
              {t('nodeModExtra.settings.transfer.withdraw')}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.row}>
          <Button className={styles.dangerButton} icon={<ArrowRightLeft />} onClick={() => setDialogOpen(true)}>
            {t('nodeModExtra.settings.transfer.button')}
          </Button>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('nodeModExtra.settings.transfer.title')}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('nodeModExtra.common.cancel')}
            </Button>
            <Button variant="primary" className={styles.dangerButton} disabled={busy || usernames.length === 0} onClick={() => void transfer()}>
              {t('nodeModExtra.settings.transfer.confirm')}
            </Button>
          </>
        }
      >
        <div className={styles.field} style={{ gap: 'var(--space-4)' }}>
          <p className={styles.lede}>{t('nodeModExtra.settings.transfer.warning')}</p>
          <UserPicker value={usernames} onChange={setUsernames} max={1} />
        </div>
      </Dialog>
      {confirmElement}
    </section>
  )
}
