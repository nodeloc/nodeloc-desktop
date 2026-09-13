import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { absoluteUrl } from '../../../lib/discourse'
import { paths } from '../../../lib/routes'
import styles from './QuoteBlock.module.css'

interface QuoteBlockProps {
  username?: string
  displayName?: string
  avatarSrc?: string
  topicId?: number
  postNumber?: number
  children: ReactNode
}

export function QuoteBlock({ username, displayName, avatarSrc, topicId, postNumber, children }: QuoteBlockProps): React.JSX.Element {
  const { t } = useTranslation()
  const name = displayName || username

  return (
    <aside className={styles.quote}>
      {name && (
        <header className={styles.header}>
          {avatarSrc && <img className={styles.avatar} src={absoluteUrl(avatarSrc)} alt="" loading="lazy" />}
          {username ? (
            <Link to={paths.user(username)} className={styles.name}>
              {t('content.quoteFrom', { name })}
            </Link>
          ) : (
            <span className={styles.name}>{t('content.quoteFrom', { name })}</span>
          )}
          {topicId && (
            <Link to={paths.topic(topicId, postNumber)} className={styles.jump} title={t('content.openQuote')}>
              <ExternalLink />
            </Link>
          )}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </aside>
  )
}
