import { AppWindow, Archive, ExternalLink, LinkIcon, Lock, PanelRightClose, PanelRightOpen, Pin, Trophy } from 'lucide-react'
import { SITE_ORIGIN } from '@shared/site'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TopicView } from '../../api/types'
import { IconButton } from '../../components/Button'
import { SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { showToast } from '../../components/toast-store'
import { paths } from '../../lib/routes'
import { useReadingMode } from '../feed/reading-mode-store'
import { openInNewWindow } from '../windows/open-window'
import styles from './ReaderFrame.module.css'
import { useReaderLayout } from './reader-store'
import { TopicDetailPanel } from './TopicDetailPanel'

interface ReaderFrameProps {
  /** Missing while the topic loads. */
  topic?: TopicView
  /** Controls before the standard buttons (reply sort). */
  controls?: ReactNode
  children: ReactNode
}

/**
 * The reader's column: a toolbar with the title on the left and topic
 * actions on the right, the thread, and the topic info pane beside it.
 */
export function ReaderFrame({ topic, controls, children }: ReaderFrameProps): React.JSX.Element {
  const { t } = useTranslation()
  const showInfo = useReaderLayout((state) => state.showInfo)
  const toggleInfo = useReaderLayout((state) => state.toggleInfo)
  const mode = useReadingMode((state) => state.mode)
  const url = topic ? `${SITE_ORIGIN}/t/${topic.slug}/${topic.id}` : null
  // Match the topic lists: compact and expanded fill the column, cards keep their centred width.
  const threadStyle = { '--reader-max-width': mode === 'card' ? '920px' : 'none' } as CSSProperties

  const copyLink = async (link: string): Promise<void> => {
    await window.nodeloc.shell.copyText(link)
    showToast(t('reader.linkCopied'), 'success')
  }

  return (
    <section className={styles.frame}>
      <header className={styles.toolbar}>
        {topic ? (
          <h1 className={styles.title} title={topic.title}>
            {topic.pinned && <Pin className={styles.titleIcon} fill="currentColor" aria-label={t('reader.pinned')} />}
            {topic.closed && <Lock className={styles.titleIcon} aria-label={t('reader.closed')} />}
            {topic.archived && <Archive className={styles.titleIcon} aria-label={t('reader.archived')} />}
            <span className={styles.titleText}>{topic.title}</span>
            {topic.is_featured && (
              <span className={styles.featured}>
                <Trophy />
                {t('reader.featured')}
              </span>
            )}
          </h1>
        ) : (
          <SkeletonGroup className={styles.titleSkeleton}>
            <SkeletonLine width={1} height={16} />
          </SkeletonGroup>
        )}
        <div className={styles.actions}>
          {controls}
          {controls && <span className={styles.separator} aria-hidden="true" />}
          {topic && url && (
            <>
              <IconButton label={t('reader.copyLink')} onClick={() => void copyLink(url)}>
                <LinkIcon />
              </IconButton>
              <IconButton label={t('reader.openInBrowser')} onClick={() => void window.nodeloc.shell.openExternal(url)}>
                <ExternalLink />
              </IconButton>
              <IconButton label={t('windows.openInNewWindow')} onClick={() => void openInNewWindow(paths.topic(topic.id))}>
                <AppWindow />
              </IconButton>
            </>
          )}
          <IconButton
            label={showInfo ? t('reader.hideInfo') : t('reader.showInfo')}
            aria-pressed={showInfo}
            className={showInfo ? styles.toggleOn : undefined}
            onClick={toggleInfo}
          >
            {showInfo ? <PanelRightClose /> : <PanelRightOpen />}
          </IconButton>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.thread} style={threadStyle}>
          {children}
        </div>
        {showInfo && topic && (
          <aside className={styles.info} aria-label={t('reader.panel.info')}>
            <TopicDetailPanel topicId={topic.id} />
          </aside>
        )}
      </div>
    </section>
  )
}
