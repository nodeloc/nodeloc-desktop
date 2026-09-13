import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import type { BasicUser, Category, TopicListItem } from '../src/renderer/src/api/types'
import { SITE_QUERY_KEY } from '../src/renderer/src/api/site'
import { AUTH_STATE_KEY, CURRENT_USER_KEY } from '../src/renderer/src/features/account/use-session'
import { TopicItem } from '../src/renderer/src/features/feed/TopicItem'

const pixel = (label: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Ctitle%3E${label}%3C/title%3E%3C/svg%3E`

export async function runTests(): Promise<string[]> {
  await i18next.use(initReactI18next).init({ lng: 'zh-CN', resources: { 'zh-CN': { translation: {} } }, initImmediate: false })
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
  const requests: string[] = []
  const calls: Array<{ path: string; method?: string; form?: Array<[string, string | number]> }> = []
  window.nodeloc = {
    api: {
      request: async (request: { path: string; method?: string; form?: Array<[string, string | number]> }) => {
        const { path } = request
        requests.push(path)
        calls.push(request)
        if (path === '/u/alice/card.json') {
          return {
            ok: true,
            status: 200,
            data: {
              user: {
                id: 1,
                username: 'alice',
                name: 'Alice Example',
                avatar_template: pixel('profile-avatar'),
                created_at: '2025-01-01T00:00:00Z',
                trust_level: 2,
                moderator: false,
                admin: false,
                can_mute_user: true,
                can_ignore_user: true,
                bio_excerpt: 'Profile card fixture'
              }
            }
          }
        }
        if (path === '/u/alice/notification_level.json') return { ok: true, status: 200, data: { success: true } }
        if (path === '/node/by-user/owner.json') {
          return {
            ok: true,
            status: 200,
            data: {
              user: { username: 'owner' },
              owned: [{
                id: 83,
                name: 'Owned Node',
                slug: 'owned',
                color: '948C6B',
                url: '/n/owned',
                topic_count: 1,
                post_count: 2,
                member_count: 3,
                is_joined: true,
                is_creator: true,
                parent_category_id: 1
              }],
              moderated: []
            }
          }
        }
        if (path === '/node/83/invite-members.json') {
          return { ok: true, status: 200, data: { invited: ['alice'], skipped: [] } }
        }
        if (path === '/post_actions.json') return { ok: true, status: 200, data: { success: true } }
        throw new Error(`Unexpected API request: ${path}`)
      }
    }
  } as unknown as typeof window.nodeloc
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  client.setQueryData(AUTH_STATE_KEY, { status: 'signedIn', username: 'owner' })
  client.setQueryData([...CURRENT_USER_KEY, 'owner'], {
    id: 9,
    username: 'owner',
    avatar_template: '',
    trust_level: 4,
    admin: false,
    moderator: false,
    unread_notifications: 0,
    unread_high_priority_notifications: 0
  })
  client.setQueryData(SITE_QUERY_KEY, {
    categories: [],
    notification_types: {},
    post_action_types: [],
    trust_levels: {},
    topic_flag_types: [{ id: 4, name: 'Report fixture', description: 'Report this topic', is_flag: true, enabled: true }]
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const topic = {
    id: 123,
    title: 'Compact row fixture',
    slug: 'topic',
    posts_count: 2,
    reply_count: 1,
    like_count: 0,
    views: 10,
    created_at: '2026-09-13T00:00:00Z',
    category_id: 83
  } satisfies TopicListItem
  const category = {
    id: 83,
    name: '杂谈',
    slug: 'chit-chat',
    color: '948C6B',
    topic_count: 1,
    post_count: 2,
    uploaded_logo: { id: 1, url: pixel('node-logo') }
  } satisfies Category
  const author = {
    id: 1,
    username: 'alice',
    avatar_template: pixel('large-avatar')
  } satisfies BasicUser

  try {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <TopicItem mode="compact" topic={topic} category={category} author={author} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    const avatarButton = container.querySelector<HTMLButtonElement>('article > button[data-user-avatar="alice"]')
    const largeAvatar = avatarButton?.querySelector<HTMLImageElement>('img')
    const authorLink = container.querySelector<HTMLAnchorElement>('a[href="/u/alice"]')
    check('Compact row renders the large author avatar', Boolean(largeAvatar))
    check('Compact row keeps the 32px author avatar', largeAvatar?.style.width === '32px')
    check('Compact avatar is a modal trigger instead of a profile link', avatarButton?.getAttribute('aria-haspopup') === 'dialog')
    check('Compact metadata keeps the author name', authorLink?.textContent?.trim() === 'alice')
    check('Compact metadata omits the small author avatar', !authorLink?.querySelector('img'))

    avatarButton!.click()
    await until(() => Boolean(document.body.querySelector('[data-user-card="alice"]')))
    await until(() => document.body.textContent?.includes('Alice Example') ?? false)
    await until(() => Boolean(document.body.querySelector('[data-dialog-position="anchored"][data-positioned]')))
    const profileDialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
    check('Avatar click opens the user profile modal', Boolean(profileDialog))
    check('Profile modal opens beside its avatar instead of in the centre', profileDialog?.dataset.dialogPosition === 'anchored' && Boolean(profileDialog.style.left))
    check('Profile modal requests and renders the web card payload', requests.includes('/u/alice/card.json') && document.body.textContent?.includes('Profile card fixture'))
    check('Profile modal removes the outer dialog frame', profileDialog?.dataset.dialogVariant === 'bare' && !profileDialog.querySelector('header, footer'))
    document.body.querySelector<HTMLButtonElement>('button[aria-label="profile.moreActions"]')!.click()
    await until(() => Boolean(document.body.querySelector('[role="menu"]')))
    const menu = document.body.querySelector('[role="menu"]')
    check('Profile card puts actions in the top-right menu', Boolean(menu))
    check('Profile menu contains block and report', menu?.textContent?.includes('profile.screen.action') && menu.textContent.includes('profile.report'))
    check('Profile menu contains full profile and node invite', menu?.textContent?.includes('profile.viewFullProfile') && menu.textContent.includes('profile.invite.action'))

    const menuItem = (label: string): HTMLButtonElement | undefined =>
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="menu"] button')).find((button) => button.textContent?.includes(label))
    menuItem('profile.screen.action')!.click()
    await until(() => document.body.textContent?.includes('profile.screen.title') ?? false)
    const muteOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((button) => button.textContent?.includes('profile.screen.levels.mute.label'))!
    muteOption.click()
    await until(() => muteOption.getAttribute('aria-checked') === 'true')
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('profile.screen.save'))!.click()
    await until(() => requests.includes('/u/alice/notification_level.json'))
    const screenCall = calls.find((call) => call.path === '/u/alice/notification_level.json')
    if (!screenCall?.form?.some(([key, value]) => key === 'notification_level' && value === 'mute')) {
      throw new Error(`Unexpected screen call: ${JSON.stringify(screenCall)}`)
    }
    check('Block level saves through the user notification endpoint', screenCall.method === 'PUT')

    document.body.querySelector<HTMLButtonElement>('button[aria-label="profile.moreActions"]')!.click()
    await until(() => Boolean(document.body.querySelector('[role="menu"]')))
    menuItem('profile.invite.action')!.click()
    await until(() => requests.includes('/node/by-user/owner.json'))
    const nodeOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((button) => button.textContent?.includes('Owned Node'))!
    nodeOption.click()
    await until(() => nodeOption.getAttribute('aria-checked') === 'true')
    const inviteDialog = Array.from(document.body.querySelectorAll<HTMLElement>('[role="dialog"]')).find((dialog) => dialog.textContent?.includes('profile.invite.title'))!
    Array.from(inviteDialog.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('profile.invite.action'))!.click()
    await until(() => requests.includes('/node/83/invite-members.json'))
    check('Node invite submits the selected node and username', calls.some((call) =>
      call.path === '/node/83/invite-members.json' && call.method === 'POST' && call.form?.some(([key, value]) => key === 'usernames' && value === 'alice')
    ))

    document.body.querySelector<HTMLButtonElement>('button[aria-label="profile.moreActions"]')!.click()
    await until(() => Boolean(document.body.querySelector('[role="menu"]')))
    menuItem('profile.report')!.click()
    await until(() => document.body.textContent?.includes('interactions.flag.topicTitle') ?? false)
    const reportOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((button) => button.textContent?.includes('Report fixture'))!
    reportOption.click()
    await until(() => reportOption.getAttribute('aria-checked') === 'true')
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('interactions.flag.submit'))!.click()
    await until(() => requests.includes('/post_actions.json'))
    check('Report uses the native flag endpoint for the avatar context', calls.some((call) => call.path === '/post_actions.json' && call.method === 'POST'))

    const node = container.querySelector<HTMLAnchorElement>('a[href="/n/chit-chat"]')
    check('Node metadata uses the node route', Boolean(node))
    check('Node metadata displays n/slug', node?.textContent?.trim() === 'n/chit-chat')
    check('Node metadata does not display the node name', !node?.textContent?.includes('杂谈'))
    check('Node metadata renders the uploaded logo', Boolean(node?.querySelector('picture img')))
  } finally {
    root.unmount()
    client.clear()
    container.remove()
  }
  return passed
}
