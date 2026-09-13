import { BadgeCheck, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import styles from './NodeBadges.module.css'

/** Official chip and verified seal, shown after a node's name. */
export function NodeBadges({ verified, official }: { verified?: boolean; official?: boolean }): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!verified && !official) return null
  return (
    <>
      {verified && (
        <span className={styles.verified} role="img" title={t('nodes.verified')} aria-label={t('nodes.verified')}>
          <BadgeCheck />
        </span>
      )}
      {official && (
        <span className={styles.official}>
          <ShieldCheck />
          {t('nodes.official')}
        </span>
      )}
    </>
  )
}
