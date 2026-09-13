import { useTranslation } from 'react-i18next'
import styles from './DraftStatus.module.css'
import type { ServerDraft } from './use-server-draft'

/** Where the draft is kept, and the choice to make when another device changed it. */
export function DraftStatus({ sync }: { sync: ServerDraft }): React.JSX.Element | null {
  const { t } = useTranslation()

  if (sync.status === 'conflict') {
    return (
      <span className={styles.conflict} role="alert">
        {t('composer.draft.conflict')}
        <button type="button" className={styles.link} onClick={sync.keepMine}>
          {t('composer.draft.keepMine')}
        </button>
        <button type="button" className={styles.link} onClick={() => void sync.loadTheirs()}>
          {t('composer.draft.loadTheirs')}
        </button>
      </span>
    )
  }
  if (sync.status === 'idle') return null
  return <span className={styles.status}>{t(`composer.draft.${sync.status}`)}</span>
}
