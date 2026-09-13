import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { PanelCard } from '../../components/PanelCard'
import { formatCount, formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { TopicMiniList, toTopicMiniItem } from '../feed/TopicMiniList'
import { useActiveTopic } from './reader-store'
import styles from './TopicDetailPanel.module.css'

/** The topic info pane beside the thread: stats, participants and related topics. */
export function TopicDetailPanel({ topicId }: { topicId: number }): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  // Select stored references only: a selector returning a fresh array re-renders forever.
  const activeTopic = useActiveTopic((state) => state.topic)
  const activeRelated = useActiveTopic((state) => state.related)
  const topic = activeTopic?.id === topicId ? activeTopic : null
  if (!topic) return null
  const related = activeRelated
  const participants = topic.details.participants ?? []

  return (
    <>
      <PanelCard title={t('reader.panel.info')}>
        <dl className={styles.stats}>
          <div>
            <dt>{t('reader.panel.posts')}</dt>
            <dd>{formatCount(topic.posts_count, i18n.language)}</dd>
          </div>
          <div>
            <dt>{t('reader.panel.views')}</dt>
            <dd>{formatCount(topic.views, i18n.language)}</dd>
          </div>
          <div>
            <dt>{t('reader.panel.likes')}</dt>
            <dd>{formatCount(topic.like_count, i18n.language)}</dd>
          </div>
          <div>
            <dt>{t('reader.panel.participants')}</dt>
            <dd>{formatCount(topic.participant_count || participants.length, i18n.language)}</dd>
          </div>
        </dl>
        <dl className={styles.dates}>
          <div>
            <dt>{t('reader.panel.created')}</dt>
            <dd title={new Date(topic.created_at).toLocaleString(i18n.language)}>
              {formatRelativeTime(topic.created_at, i18n.language)}
            </dd>
          </div>
          {topic.last_posted_at && (
            <div>
              <dt>{t('reader.panel.lastReply')}</dt>
              <dd title={new Date(topic.last_posted_at).toLocaleString(i18n.language)}>
                {formatRelativeTime(topic.last_posted_at, i18n.language)}
              </dd>
            </div>
          )}
        </dl>
      </PanelCard>

      {participants.length > 0 && (
        <PanelCard title={t('reader.panel.participants')}>
          <div className={styles.participants}>
            {participants.slice(0, 30).map((user) => (
              <Link key={user.id} to={paths.user(user.username)} className={styles.participant} title={`${user.username} · ${user.post_count}`}>
                <Avatar template={user.avatar_template} username={user.username} size={32} />
                {user.post_count > 1 && <span className={styles.count}>{user.post_count}</span>}
              </Link>
            ))}
          </div>
        </PanelCard>
      )}

      {related.length > 0 && (
        <PanelCard title={t('reader.panel.related')}>
          <TopicMiniList items={related.slice(0, 8).map(toTopicMiniItem)} />
        </PanelCard>
      )}
    </>
  )
}
