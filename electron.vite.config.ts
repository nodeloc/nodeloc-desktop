import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { MEDIA_FRAME_SOURCES } from './src/shared/media-embed'

const sharedDir = resolve('src/shared')

/**
 * Fills the CSP placeholder in index.html. Development needs inline scripts
 * (React Refresh preamble) and the dev server's websocket; production allows
 * neither. API calls go through the main process; the renderer only fetches
 * media (HLS video) directly.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'nodeloc-csp',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, context) => html.replace('__NODELOC_CSP__', buildCsp(Boolean(context.server)))
    }
  }
}

function buildCsp(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': isDev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    // https: is for hls.js fetching video playlists and segments (often on a CDN).
    // API calls still go through the main process; no credentials live here.
    'connect-src': isDev
      ? ["'self'", 'https:', 'ws://localhost:*', 'http://localhost:*', 'ws://127.0.0.1:*', 'http://127.0.0.1:*']
      : ["'self'", 'https:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'frame-src': MEDIA_FRAME_SOURCES
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': sharedDir } }
  },
  preload: {
    resolve: { alias: { '@shared': sharedDir } }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': sharedDir
      }
    },
    plugins: [react(), contentSecurityPolicy()]
  }
})
