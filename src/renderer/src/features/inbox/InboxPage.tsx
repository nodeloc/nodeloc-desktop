import { BellOff, CheckCheck, CircleAlert, LockKeyhole, LogIn } from 'lucide-react'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { apiRequest } from '../../api/client'
import { useSite } from '../../api/site'
import { useErrorMessage } from '../../api/use-error-message'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Spinner } from '../../components/Spinner'
import { SkeletonCircle, SkeletonGroup, SkeletonLine } from '../../components/Skeleton'
import { showToast } from '../../components/toast-store'
import { cx } from '../../lib/cx'
import { useSignInDialog } from '../account/sign-in-store'
import { useIsSignedIn } from '../account/use-session'
import styles from './InboxPage.module.css'
import { notificationTarget, notificationTypeNames } from './notification-display'
import { NotificationRow } from './NotificationRow'
import type { NotificationItem, NotificationsResponse } from './types'
import { COUNTS_KEY, NOTIFICATIONS_KEY, useNotifications, type NotificationFilter } from './use-notifications'

export function InboxPage(): React.JSX.Element {
  const { t } = useTranslation()
  const signedIn = useIsSignedIn()
  const showSignIn = useSignInDialog((state) => state.show)

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
  return <Notifications />
}

function Notifications(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const filter: NotificationFilter = params.get('filter') === 'unread' ? 'unread' : 'all'
  const list = useNotifications(filter)
  const typeNames = useMemo(() => notificationTypeNames(useSiteTypes()), [])
  const siteTypes = useSite().data?.notification_types
  const names = useMemo(() => (siteTypes ? notificationTypeNames(siteTypes) : typeNames), [siteTypes, typeNames])
  const [markingAll, setMarkingAll] = useState(false)

  const setRead = (predicate: (item: NotificationItem) => boolean): void => {
    queryClient.setQueriesData<InfiniteData<NotificationsResponse>>({ queryKey: NOTIFICATIONS_KEY }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((item) => (predicate(item) ? { ...item, read: true } : item))
            }))
          }
        : data
    )
  }

  const open = (item: NotificationItem): void => {
    if (!item.read) {
      setRead((candidate) => candidate.id === item.id)
      void apiRequest({ method: 'PUT', path: '/notifications/mark-read', form: [['id', item.id]], priority: 'user' }).catch(() => undefined)
    }
    const target = notificationTarget(item, names.get(item.notification_type))
    if (target.route) navigate(target.route)
    else if (target.url) void window.nodeloc.browser.open(target.url)
  }

  const markAll = async (): Promise<void> => {
    setMarkingAll(true)
    try {
      await apiRequest({ method: 'PUT', path: '/notifications/mark-read', priority: 'user' })
      setRead(() => true)
      void queryClient.invalidateQueries({ queryKey: COUNTS_KEY })
      showToast(t('inbox.markedAllRead'), 'success')
    } catch (error) {
      showToast(errorMessage(error), 'danger')
    } finally {
      setMarkingAll(false)
    }
  }

  const setFilter = (next: NotificationFilter): void => {
    setParams(next === 'unread' ? { filter: 'unread' } : {}, { replace: true })
  }

  return (
    <section className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.title}>{t('inbox.notifications')}</h1>
        <div className={styles.actions}>
          <div className={styles.segments} role="radiogroup">
            {(['all', 'unread'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={filter === option}
                className={cx(styles.segment, filter === option && styles.segmentSelected)}
                onClick={() => setFilter(option)}
              >
                {t(`inbox.filters.${option}`)}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon={<CheckCheck />} disabled={markingAll} onClick={() => void markAll()}>
            {t('inbox.markAllRead')}
          </Button>
        </div>
      </header>

      <div className={styles.scroller}>
        <div className={styles.list}>
          {list.isPending && (
            <SkeletonGroup className={styles.skeleton}>
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className={styles.skeletonRow}>
                  <SkeletonCircle size={36} />
                  <div className={styles.skeletonText}>
                    <SkeletonLine width={0.7} />
                    <SkeletonLine width={0.2} height={11} />
                  </div>
                </div>
              ))}
            </SkeletonGroup>
          )}
          {list.isError && list.items.length === 0 && (
            <EmptyState
              icon={<CircleAlert />}
              title={errorMessage(list.error)}
              action={<Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>}
            />
          )}
          {list.isSuccess && list.items.length === 0 && (
            <EmptyState icon={<BellOff />} title={filter === 'unread' ? t('inbox.emptyUnread') : t('inbox.empty')} />
          )}
          {list.items.map((item) => (
            <NotificationRow key={item.id} item={item} typeName={names.get(item.notification_type)} onOpen={open} />
          ))}
          {list.items.length > 0 && (
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

/** Fallback names before site.json has loaded (ids are stable across Discourse versions). */
function useSiteTypes(): Record<string, number> {
  return {
    mentioned: 1,
    replied: 2,
    quoted: 3,
    edited: 4,
    liked: 5,
    private_message: 6,
    invited_to_private_message: 7,
    posted: 9,
    granted_badge: 12,
    group_mentioned: 15,
    group_message_summary: 16,
    watching_first_post: 17,
    liked_consolidated: 19,
    reaction: 25,
    chat_mention: 29,
    chat_message: 30,
    boost: 43,
    following: 800,
    reward_received: 5000,
    topic_featured: 6001,
    lottery_result: 6002
  }
}
