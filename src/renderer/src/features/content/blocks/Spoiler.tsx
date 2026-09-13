import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '../../../lib/cx'
import styles from './Spoiler.module.css'

/** Blurred until clicked. Inline spoilers stay inline; block spoilers take their own row. */
export function Spoiler({ children, block = false }: { children: ReactNode; block?: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const Tag = block ? 'div' : 'span'

  const reveal = (): void => setRevealed(true)
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      reveal()
    }
  }

  if (revealed) return <Tag className={cx(styles.spoiler, styles.revealed, block && styles.block)}>{children}</Tag>

  return (
    <Tag
      className={cx(styles.spoiler, block && styles.block)}
      role="button"
      tabIndex={0}
      title={t('content.spoiler')}
      aria-label={t('content.spoiler')}
      onClickCapture={(event) => {
        // Hidden links must not fire before the reader chose to reveal.
        event.preventDefault()
        event.stopPropagation()
        reveal()
      }}
      onKeyDown={onKeyDown}
    >
      {children}
    </Tag>
  )
}
