import { List, Rows3, SquareStack } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../lib/cx'
import { READING_MODES, useReadingMode, type ReadingMode } from './reading-mode-store'
import styles from './ReadingModeSwitch.module.css'

const ICONS: Record<ReadingMode, ReactNode> = {
  compact: <List />,
  expanded: <Rows3 />,
  card: <SquareStack />
}

export function ReadingModeSwitch(): React.JSX.Element {
  const { t } = useTranslation()
  const mode = useReadingMode((state) => state.mode)
  const setMode = useReadingMode((state) => state.setMode)

  return (
    <div className={styles.switch} role="radiogroup" aria-label={t('feed.readingMode.label')}>
      {READING_MODES.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          title={t(`feed.readingMode.${option}`)}
          className={cx(styles.option, mode === option && styles.selected)}
          onClick={() => setMode(option)}
        >
          {ICONS[option]}
        </button>
      ))}
    </div>
  )
}
