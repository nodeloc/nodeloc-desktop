import { CircleAlert, LockKeyhole, LogIn, Mail, SquarePen } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import type { BasicUser, TopicListItem } from '../../api/types'
import { useErrorMessage } from '../../api/use-error-message'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { cx } from '../../lib/cx'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import { useSignInDialog } from '../account/sign-in-store'
import { useCurrentUser, useIsSignedIn } from '../account/use-session'
import { useComposer } from '../composer/composer-store'
import styles from './MessagesPage.module.css'
import { usePrivateMessages } from './use-notifications'

/** Private messages (personal or a group inbox). Each conversation opens in the reader. */
export function MessagesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const showSignIn = useSignInDialog((state) => state.show)
  const user = useCurrentUser()
  const { group } = useParams()

  if (!signedIn) {
    return (
      <EmptyState
        icon={<LockKeyhole />}
        title={t('inbox.signInRequired')}
        action={
          <Button variant="primary" icon={<LogIn strokeWidth={2.5} />} onClick={showSignIn}>
            {t('account.signIn')}
          </Button>
        }
      />
    )
  }

  return (
    <MessageList
      key={group ?? 'personal'}
      username={user?.username}
      group={group}
      canCompose={user?.can_send_private_messages !== false}
    />
  )
}

function MessageList({ username, group, canCompose }: { username: string | undefined; group?: string; canCompose: boolean }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const openMessage = useComposer((state) => state.openMessage)
  const list = usePrivateMessages(username, group)

  const { topics, users } = useMemo(() => {
    const seen = new Set<number>()
    const merged: TopicListItem[] = []
    const people = new Map<number, BasicUser>()
    for (const page of list.data?.pages ?? []) {
      for (const person of page.users ?? []) people.set(person.id, person)
      for (const topic of page.topic_list.topics) {
        if (seen.has(topic.id)) continue
        seen.add(topic.id)
        merged.push(topic)
      }
    }
    return { topics: merged, users: people }
  }, [list.data])

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>{group ? `${t('inbox.messages')} · ${group}` : t('inbox.messages')}</h1>
        {canCompose && (
          <Button
            variant="primary"
            size="sm"
            icon={<SquarePen />}
            onClick={() => openMessage(group ? { recipients: [group] } : {})}
          >
            {t('inbox.newMessage')}
          </Button>
        )}
      </header>
      <div className={styles.scroller}>
        <div className={styles.list}>
          {(list.isPending || !username) && (
            <SkeletonGroup className={styles.skeleton}>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={styles.skeletonRow}>
                  <SkeletonCircle size={40} />
                  <div className={styles.skeletonText}>
                    <SkeletonLine width={0.6} height={14} />
                    <SkeletonLine width={0.3} height={11} />
                  </div>
                </div>
              ))}
            </SkeletonGroup>
          )}
          {list.isError && topics.length === 0 && (
            <EmptyState
              icon={<CircleAlert />}
              title={errorMessage(list.error)}
              action={<Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>}
            />
          )}
          {list.isSuccess && topics.length === 0 && <EmptyState icon={<Mail />} title={t('inbox.emptyMessages')} />}

          {topics.map((topic) => {
            const unread =
              topic.unseen === true ||
              (topic.last_read_post_number != null &&
                topic.highest_post_number != null &&
                topic.last_read_post_number < topic.highest_post_number)
            const participants = (topic.posters ?? []).map((poster) => users.get(poster.user_id)).filter((person): person is BasicUser => Boolean(person))
            const lastActivity = topic.last_posted_at ?? topic.bumped_at ?? topic.created_at
            return (
              <Link key={topic.id} to={paths.topic(topic.id)} className={cx(styles.row, unread && styles.unread)}>
                <span className={styles.avatars}>
                  {participants.slice(0, 3).map((person) => (
                    <Avatar key={person.id} template={person.avatar_template} username={person.username} size={28} />
                  ))}
                </span>
                <span className={styles.text}>
                  <span className={styles.topicTitle}>{topic.title}</span>
                  <span className={styles.meta}>
                    {participants.map((person) => person.username).slice(0, 4).join('、')}
                    {participants.length > 0 && ' · '}
                    {formatRelativeTime(lastActivity, i18n.language)}
                  </span>
                </span>
                <span className={styles.count}>{Math.max(topic.posts_count, 1)}</span>
                {unread && <span className={styles.dot} aria-hidden="true" />}
              </Link>
            )
          })}

          {topics.length > 0 && (
            <div className={styles.footer}>
              {list.isFetchingNextPage ? (
                <Spinner size={24} />
              ) : list.hasNextPage ? (
                <Button size="sm" onClick={() => void list.fetchNextPage()}>
                  {t('inbox.loadMore')}
                </Button>
              ) : (
                <span className={styles.end}>{t('inbox.end')}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
