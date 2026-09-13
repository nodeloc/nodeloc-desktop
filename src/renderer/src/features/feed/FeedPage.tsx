import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { NotFoundPage } from '../../layout/NotFoundPage'
import { FEED_FILTERS, type FeedFilter } from '../../lib/routes'
import { PeriodSelect } from './PeriodSelect'
import { feedSource, type TopPeriod } from './topic-list-source'
import { TopicList } from './TopicList'

export function FeedPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { filter = 'latest' } = useParams()
  const [period, setPeriod] = useState<TopPeriod>('weekly')

  const valid = (FEED_FILTERS as readonly string[]).includes(filter)
  const feed = filter as FeedFilter
  const source = useMemo(() => feedSource(feed, period), [feed, period])

  if (!valid) return <NotFoundPage />

  return (
    <TopicList
      key={feed}
      source={source}
      title={t(`feed.filters.${feed}`)}
      actions={feed === 'top' ? <PeriodSelect value={period} onChange={setPeriod} /> : undefined}
      emptyTitle={feed === 'unread' ? t('feed.emptyUnread') : undefined}
    />
  )
}
