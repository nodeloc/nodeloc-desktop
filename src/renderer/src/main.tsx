import { QueryClientProvider } from '@tanstack/react-query'
import { LucideProvider } from 'lucide-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { queryClient } from './api/query-client'
import { App } from './App'
import { APP_PREFERENCES_KEY } from './features/settings/preferences'
import { popoutRoute } from './features/windows/window-mode'
import { i18nReady } from './i18n'
import { applyLanguage } from './i18n/language'
import { LanguageSync } from './i18n/LanguageSync'
import './styles/tokens.css'
import './styles/base.css'

async function start(): Promise<void> {
  await i18nReady
  const preferences = await window.nodeloc.app.getPreferences().catch(() => undefined)
  if (preferences) queryClient.setQueryData(APP_PREFERENCES_KEY, preferences)
  await applyLanguage(preferences?.language ?? 'system')

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LanguageSync />
        {/* Icons follow the surrounding font size unless given an explicit size. The context
            value goes straight into the SVG width/height attributes, so "1em" works even though
            the type only allows numbers. */}
        <LucideProvider size={'1em' as unknown as number}>
          {/* Pop-out windows start on the route they were opened with (`?route=`). */}
          <MemoryRouter initialEntries={[popoutRoute ?? '/']}>
            <Routes>
              <Route path="/*" element={<App />} />
            </Routes>
          </MemoryRouter>
        </LucideProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}

void start()
