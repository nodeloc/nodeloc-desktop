import { useTranslation } from 'react-i18next'
import form from './ComposerForm.module.css'

interface ReadPermissionSelectProps {
  id?: string
  /** Minimum trust level to read (0–4); null = everyone. */
  value: number | null
  onChange: (value: number | null) => void
}

const LEVELS = [1, 2, 3, 4] as const

/** discourse-read-permission's "need trust level N to read" (COMP-12). */
export function ReadPermissionSelect({ id, value, onChange }: ReadPermissionSelectProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <select
      id={id}
      className={form.select}
      value={value === null ? '' : String(value)}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
    >
      <option value="">{t('composer.readPermission.everyone')}</option>
      <option value="0">{t('composer.readPermission.level0')}</option>
      {LEVELS.map((level) => (
        <option key={level} value={level}>
          {t('composer.readPermission.level', { level })}
        </option>
      ))}
    </select>
  )
}
