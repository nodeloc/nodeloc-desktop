import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { ErrorBoundary } from '../src/renderer/src/components/ErrorBoundary'
import { TopicPage } from '../src/renderer/src/features/reader/TopicPage'
import { useActiveTopic } from '../src/renderer/src/features/reader/reader-store'
import { siteUrlToRoute } from '../src/renderer/src/lib/routes'
import type { Post, TopicResponse } from '../src/renderer/src/api/types'

const topicId = 108532
const post = (number: number): Post => ({
  id: 1000 + number, post_number: number, topic_id: topicId,
  username: 'reader', user_id: 1, avatar_template: '/avatar/{size}.png',
  cooked: `<p>Message body ${number}</p>`, created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z', actions_summary: [],
  post_url: `/t/topic/${topicId}/${number}`, version: 1
} as Post)
const flat: TopicResponse = {
  id: topicId, slug: 'topic', title: 'Private message fixture', archetype: 'private_message',
  posts_count: 3, reply_count: 2, like_count: 0, views: 1,
  created_at: '2026-09-01T00:00:00Z', details: { participants: [] },
  post_stream: { posts: [post(1), post(2)], stream: [1001, 1002, 1003] }
} as TopicResponse

export async function runTests(): Promise<string[]> {
  await i18next.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: {} } }, initImmediate: false })
  const passed: string[] = []
  const check = (name: string, condition: unknown): void => {
    if (!condition) throw new Error(name)
    passed.push(name)
  }
  const until = async (condition: () => boolean): Promise<void> => {
    const deadline = Date.now() + 4000
    while (!condition()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${document.body.textContent}`)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  check('Private message URL maps to the topic reader', siteUrlToRoute(new URL(`https://www.nodeloc.com/t/topic/${topicId}`)) === `/t/${topicId}`)

  for (const scenario of ['redirect', '404', 'focused redirect', 'nested', 'forbidden'] as const) {
    const requests: string[] = []
    const crashes: unknown[] = []
    const originalError = console.error
    console.error = (...args) => { crashes.push(args) }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    window.nodeloc = {
      auth: { getState: async () => ({ status: 'signedOut' }) },
      realtime: { subscribe: async () => {}, unsubscribe: async () => {} },
      events: { onRealtime: () => () => {} },
      api: {
        request: async ({ path, query }: { path: string; query?: Record<string, unknown> }) => {
          requests.push(path)
          if (path === '/site.json') return { ok: true, data: { categories: [], post_action_types: [] } }
          if (path === '/mobile/meta.json') return { ok: true, data: {} }
          if (path.startsWith('/n/topic/')) {
            if (scenario === '404' || scenario === 'forbidden') return { ok: false, error: { kind: scenario === '404' ? 'notFound' : 'forbidden', status: scenario === '404' ? 404 : 403 } }
            if (scenario === 'nested') return { ok: true, data: { topic: { ...flat, title: 'Public topic fixture', archetype: 'regular' }, op_post: post(1), roots: [post(2)], has_more_roots: false } }
            // A followed redirect is a successful /t response without roots or target_post.
            return { ok: true, data: scenario === 'focused redirect' ? { ...flat, post_stream: { ...flat.post_stream, posts: [post(2)] } } : flat }
          }
          if (path === `/t/${topicId}.json`) return { ok: true, data: flat }
          if (path === `/t/${topicId}/posts.json`) {
            check(`${scenario}: pagination requests only missing posts`, JSON.stringify(query?.['post_ids[]']) === '[1003]')
            return { ok: true, data: { post_stream: { posts: [post(3)] } } }
          }
          throw new Error(`Unexpected API request: ${path}`)
        }
      }
    } as unknown as typeof window.nodeloc
    try {
      const route = `/t/${topicId}${scenario === 'focused redirect' ? '/2' : ''}`
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[route]}>
            <ErrorBoundary><Routes>
              <Route path="/t/:topicId/:postNumber?" element={<TopicPage />} />
            </Routes></ErrorBoundary>
          </MemoryRouter>
        </QueryClientProvider>
      )
      if (scenario === 'forbidden') {
        await until(() => Boolean(container.textContent?.includes('reader.signInRequired')))
        check('Permission errors remain visible without flat fallback', !requests.some((path) => path.startsWith('/t/')))
      } else {
        await until(() => Boolean(container.querySelector('h1')) || Boolean(container.textContent?.includes('errors.viewCrashed')))
        check(`${scenario}: reader renders without crashing`, Boolean(container.querySelector('h1')) && !container.textContent?.includes('errors.viewCrashed'))
        await until(() => useActiveTopic.getState().topic?.id === topicId)
        check(`${scenario}: opening post is available`, useActiveTopic.getState().op?.post_number === 1)
        if (scenario === 'redirect') check('Redirect response reused without a duplicate topic request', !requests.includes(`/t/${topicId}.json`))
        if (scenario === '404' || scenario === 'focused redirect') check(`${scenario}: whole topic fetched`, requests.includes(`/t/${topicId}.json`))
        if (scenario !== 'nested') {
          await until(() => Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('reader.loadMoreReplies')))
          Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('reader.loadMoreReplies'))!.click()
          await until(() => requests.includes(`/t/${topicId}/posts.json`))
          await until(() => !container.textContent?.includes('reader.loadMoreReplies'))
        }
      }
      check(`${scenario}: no React render exceptions`, crashes.length === 0)
    } finally {
      root.unmount()
      client.clear()
      container.remove()
      useActiveTopic.getState().clear(topicId)
      console.error = originalError
    }
  }
  return passed
}
