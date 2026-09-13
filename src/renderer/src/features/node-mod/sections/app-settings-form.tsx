import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '../../../components/Switch'
import { SECRET_SET, type AppSettingField } from '../extra-api'
import { extraStyles as styles, Field } from './extra-ui'

type Values = Record<string, unknown>

function initialValues(schema: AppSettingField[], settings: Values | null | undefined): Values {
  const existing = settings ?? {}
  const values: Values = {}
  for (const field of schema) {
    if (Object.hasOwn(existing, field.key)) values[field.key] = existing[field.key]
    else if (Object.hasOwn(field, 'default')) values[field.key] = field.default
    else values[field.key] = field.type === 'boolean' ? false : ''
  }
  return values
}

/** The form an app declared for its settings (discourse-apps AppSettingsForm). */
export function AppSettingsForm({
  schema,
  settings,
  onChange
}: {
  schema: AppSettingField[]
  settings?: Values | null
  onChange: (values: Values) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [values, setValues] = useState<Values>(() => initialValues(schema, settings))

  const set = (key: string, value: unknown): void => {
    const next = { ...values, [key]: value }
    setValues(next)
    onChange(next)
  }

  return (
    <div className={styles.field} style={{ gap: 'var(--space-4)' }}>
      {schema.map((field) => {
        const id = `app-setting-${field.key}`
        const label = field.label || field.key
        const value = values[field.key]

        if (field.type === 'boolean') {
          return <Switch key={field.key} checked={Boolean(value)} onChange={(checked) => set(field.key, checked)} label={label} description={field.description} />
        }

        const required = field.required ? t('nodeModExtra.apps.requiredMarker') : undefined
        let control: React.JSX.Element
        if (field.type === 'enum') {
          control = (
            <select id={id} className={styles.select} value={String(value ?? '')} onChange={(event) => set(field.key, event.target.value)}>
              {(field.options ?? []).map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          )
        } else if (field.type === 'text' || field.type === 'markdown') {
          control = (
            <textarea
              id={id}
              className={styles.textarea}
              rows={field.type === 'markdown' ? 6 : 4}
              value={String(value ?? '')}
              onChange={(event) => set(field.key, event.target.value)}
            />
          )
        } else {
          // A stored secret shows as a placeholder, so leaving it alone is the obvious choice.
          const alreadySet = field.type === 'secret' && value === SECRET_SET
          control = (
            <input
              id={id}
              className={styles.input}
              type={field.type === 'secret' ? 'password' : field.type === 'integer' ? 'number' : 'text'}
              autoComplete="off"
              value={alreadySet ? '' : String(value ?? '')}
              placeholder={alreadySet ? t('nodeModExtra.apps.secretSet') : undefined}
              onChange={(event) => set(field.key, event.target.value)}
            />
          )
        }

        return (
          <Field key={field.key} label={label} htmlFor={id} hint={field.description} required={required}>
            {control}
          </Field>
        )
      })}
    </div>
  )
}
