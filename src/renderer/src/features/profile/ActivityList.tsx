import { Heart, MessageCircle, MessagesSquare, SquarePen } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useCategoryIndex } from '../../api/site'
import { USER_ACTION, type Category, type UserAction } from '../../api/types'
import { EmptyState } from '../../components/EmptyState'
import { formatRelativeTime } from '../../lib/format'
import { paths } from '../../lib/routes'
import styles from './ActivityList.module.css'
import { htmlToText } from './profile-text'
import { LoadMoreFooter, RowsSkeleton, TabError } from './TabStates'
import { actionKey, useUserActions, type ActivityTab } from './use-profile'

type ActionKind = 'topic' | 'reply' | 'like'

const ACTION_KINDS: Partial<Record<number, ActionKind>> = {
  [USER_ACTION.topic]: 'topic',
  [USER_ACTION.reply]: 'reply',
  [USER_ACTION.like]: 'like'
}

const ACTION_ICONS = { topic: SquarePen, reply: MessageCircle, like: Heart }

export function ActivityList({ username, tab }: { username: string; tab: ActivityTab }): React.JSX.Element {
  const { t } = useTranslation()
  const list = useUserActions(username, tab)
  const categories = useCategoryIndex()

  if (list.isPending) return <RowsSkeleton count={8} />
  if (list.isError && list.actions.length === 0) {
    return <TabError error={list.error} onRetry={() => void list.refetch()} />
  }
  if (list.actions.length === 0) return <EmptyState icon={<MessagesSquare />} title={t(`profile.empty.${tab}`)} />

  return (
    <div className={styles.list}>
      {list.actions.map((action) => (
        <ActivityRow key={actionKey(action)} action={action} category={categories?.byId.get(action.category_id)} />
      ))}
      <LoadMoreFooter
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        isFetchNextPageError={list.isFetchNextPageError}
        fetchNextPage={list.fetchNextPage}
      />
    </div>
  )
}

function ActivityRow({ action, category }: { action: UserAction; category?: Category }): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const excerpt = useMemo(() => (action.excerpt ? htmlToText(action.excerpt) : ''), [action.excerpt])
  const kind = ACTION_KINDS[action.action_type] ?? 'reply'
  const Icon = ACTION_ICONS[kind]

  return (
    <article className={styles.row}>
      <span className={styles.icon} data-kind={kind} aria-hidden="true">
        <Icon />
      </span>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>{kind === 'like' ? t('profile.actions.like', { username: action.username }) : t(`profile.actions.${kind}`)}</span>
          {category && (
            <Link to={paths.node(category.slug)} className={styles.node}>
              <span className={styles.nodeDot} style={{ background: `#${category.color}` }} />
              {category.name}
            </Link>
          )}
          <time dateTime={action.created_at} title={new Date(action.created_at).toLocaleString(i18n.language)}>
            {formatRelativeTime(action.created_at, i18n.language)}
          </time>
          {action.deleted && <span className={styles.deleted}>{t('profile.deleted')}</span>}
        </div>
        <Link to={paths.topic(action.topic_id, action.post_number)} className={styles.title}>
          {action.title}
        </Link>
        {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      </div>
    </article>
  )
}
