import { Rss } from 'lucide-react'
import { useMemo } from 'react'
import { useParams } from 'react-router'
import { CustomFeedActions } from '../custom-feeds/CustomFeedActions'
import { customFeedSource } from './topic-list-source'
import { TopicList } from './TopicList'

export function CustomFeedPage(): React.JSX.Element {
  const { username = '', slug = '' } = useParams()
  const source = useMemo(() => customFeedSource(username, slug), [username, slug])

  return (
    <TopicList
      key={`${username}/${slug}`}
      source={source}
      actions={<CustomFeedActions username={username} slug={slug} />}
      title={
        <>
          <Rss />
          {username} / {slug}
        </>
      }
    />
  )
}
