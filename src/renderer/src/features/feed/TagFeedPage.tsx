import { Hash } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { tagSource } from './topic-list-source'
import { TopicList } from './TopicList'

export function TagFeedPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const source = useMemo(() => tagSource(slug), [slug])

  return (
    <TopicList
      key={slug}
      source={source}
      title={
        <>
          <Hash />
          {slug}
        </>
      }
      emptyTitle={t('feed.emptyTag')}
    />
  )
}
