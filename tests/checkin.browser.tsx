import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { CheckInButton } from '../src/renderer/src/features/account/CheckInButton'
import { useToastStore } from '../src/renderer/src/components/toast-store'

export async function runTests(): Promise<string[]> {
  await i18next.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: {} } } })
  const passed: string[] = []
  const check = (name: string, condition: unknown): void => {
    if (!condition) throw new Error(name)
    passed.push(name)
  }
  const until = async (condition: () => boolean): Promise<void> => {
    const deadline = Date.now() + 3000
    while (!condition()) {
      if (Date.now() > deadline) throw new Error(`Timed out: ${document.body.innerHTML}`)
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  for (const [name, response, completed] of [
    ['success', { ok: true, data: { success: true, points: 5 } }, true],
    ['already checked in (Chinese)', { ok: true, data: { success: false, message: '您今天已经签到过了' } }, true],
    ['already checked in (English)', { ok: true, data: { success: false, message: "You've already checked in today" } }, true],
    ['HTTP 200 save failure', { ok: true, data: { success: false, message: '保存失败' } }, false],
    ['HTTP 200 empty failure', { ok: true, data: { success: false } }, false],
    ['invalid request', { ok: false, error: { kind: 'forbidden', status: 403, serverMessage: '无效的请求' } }, false]
  ] as const) {
    localStorage.removeItem('nodeloc.checkin.1')
    useToastStore.getState().dismiss()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    client.setQueryData(['mobile-meta'], { features: { checkin: true } })
    let requests = 0
    window.nodeloc = { api: { request: async (request: { path: string; headers: Record<string, string>; form: [string, string | number][] }) => {
      check(`${name}: request goes to check-in`, request.path === '/checkin')
      const nonce = request.headers['X-Checkin-Nonce']
      check(`${name}: matching unique nonce`, nonce.length >= 10 && new Map(request.form).get('nonce') === nonce)
      requests++
      return response
    } } } as unknown as typeof window.nodeloc
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      root.render(<QueryClientProvider client={client}><CheckInButton userId={1} /></QueryClientProvider>)
      await until(() => Boolean(container.querySelector('button')))
      const button = container.querySelector('button')!
      check(`${name}: calendar-heart icon`, Boolean(container.querySelector('.lucide-calendar-heart')))
      button.click()
      await until(() => requests === 1 && Boolean(useToastStore.getState().toast))
      await until(() => Boolean(container.querySelector('.lucide-calendar-heart')) && (completed ? button.disabled : !button.disabled))
      check(`${name}: completion state`, button.disabled === completed)
      check(`${name}: persisted only when completed`, Boolean(localStorage.getItem('nodeloc.checkin.1')) === completed)
    } finally {
      root.unmount()
      container.remove()
      client.clear()
    }
  }
  return passed
}
