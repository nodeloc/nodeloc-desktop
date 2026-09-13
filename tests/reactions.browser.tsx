import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { AUTH_STATE_KEY } from '../src/renderer/src/features/account/use-session'
import { VoteControl } from '../src/renderer/src/features/interactions/VoteControl'

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

  const requests: Array<{ path: string; query?: Record<string, unknown> }> = []
  window.nodeloc = {
    api: {
      request: async (request: { path: string; query?: Record<string, unknown> }) => {
        requests.push(request)
        if (request.path === '/emojis.json') {
          return { ok: true, status: 200, data: { 'smileys_&_emotion': [
            { name: 'heart', url: '/heart.png' },
            { name: 'laughing', url: '/laughing.png' },
            { name: 'tada', url: '/tada.png' },
            { name: 'thumbsdown', url: '/thumbsdown.png' }
          ] } }
        }
        if (request.path.includes('/reactions-users-list.json')) {
          const reaction = String(request.query?.reaction_value ?? 'heart')
          const page = Number(request.query?.page ?? 0)
          return {
            ok: true,
            status: 200,
            data: {
              users: page === 0
                ? [
                    { id: 1, username: 'alice', name: 'Alice', avatar_template: '', reaction },
                    { id: 2, username: 'bob', avatar_template: '', reaction }
                  ]
                : [{ id: 3, username: 'carol', avatar_template: '', reaction }],
              total_rows: 3
            }
          }
        }
        throw new Error(`Unexpected API request: ${request.path}`)
      }
    }
  } as unknown as typeof window.nodeloc

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(AUTH_STATE_KEY, { status: 'signedOut' })
  client.setQueryData(['site'], { categories: [], vote_upvote_reactions: [], vote_downvote_reactions: [] })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <VoteControl
            postId={77}
            orientation="horizontal"
            base={{ score: 42, count: 5, direction: 'none', canVoteUp: true, canVoteDown: true }}
            reactions={[
              { id: 'tada', type: 'emoji', count: 3 },
              { id: 'thumbsdown', type: 'emoji', count: 1 },
              { id: 'heart', type: 'emoji', count: 9 },
              { id: 'laughing', type: 'emoji', count: 5 }
            ]}
            reactionUsersCount={18}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await until(() => Boolean(container.querySelector('[data-reaction-summary]')))
    const summary = container.querySelector<HTMLButtonElement>('[data-reaction-summary]')!
    check('Shows the three most-used emoji', Array.from(summary.querySelectorAll('img')).map((img) => img.alt).join(',') === ':heart:,:laughing:,:tada:')
    check('Hides lower-ranked emoji', !summary.textContent?.includes('thumbsdown') && !summary.querySelector('[alt=":thumbsdown:"]'))
    const rail = summary.parentElement?.parentElement
    check('Summary appears after upvote and before the score', rail?.children[1].contains(summary) && rail.children[2].textContent === '42')

    summary.click()
    await until(() => document.body.textContent?.includes('Alice') ?? false)
    const allRequest = requests.find((request) => request.path.includes('/reactions-users-list.json'))
    check('Click opens details and requests the web endpoint', allRequest?.query?.page === 0 && allRequest.query.limit === 20 && allRequest.query.reaction_value === undefined)
    check('Details render users and their reaction', Boolean(document.body.querySelector('a[href="/u/alice"] img[alt=":heart:"]')))

    document.body.querySelector<HTMLButtonElement>('[data-reaction-filter="thumbsdown"]')!.click()
    await until(() => requests.some((request) => request.query?.reaction_value === 'thumbsdown'))
    check('Emoji filter is sent to the server', requests.some((request) => request.query?.reaction_value === 'thumbsdown'))

    const loadMore = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('interactions.reactions.loadMore'))
    check('More users can be paged', Boolean(loadMore))
    loadMore!.click()
    await until(() => requests.some((request) => request.query?.reaction_value === 'thumbsdown' && request.query.page === 1))
    await until(() => document.body.textContent?.includes('carol') ?? false)
    check('Next page is appended', document.body.textContent?.includes('carol'))
  } finally {
    root.unmount()
    client.clear()
    container.remove()
  }
  return passed
}
