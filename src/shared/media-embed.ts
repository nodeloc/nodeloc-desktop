export interface MediaEmbed {
  provider: 'youtube' | 'bilibili' | 'x'
  src: string
  url: string
}

/** Only these remote documents can be framed by the renderer. */
export const MEDIA_FRAME_SOURCES = [
  'https://www.youtube-nocookie.com/embed/',
  'https://player.bilibili.com/player.html',
  'https://platform.twitter.com/embed/Tweet.html'
]

/** Rebuild provider URLs from IDs; never pass arbitrary post URLs to an iframe. */
export function parseMediaEmbed(value: string | null | undefined): MediaEmbed | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value.startsWith('//') ? `https:${value}` : value)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
  const host = url.hostname
  const path = url.pathname

  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be'
      ? path.match(/^\/([\w-]{11})\/?$/)?.[1]
      : path === '/watch' ? url.searchParams.get('v') : path.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})\/?$/)?.[1]
    if (!id || !/^[\w-]{11}$/.test(id)) return null
    const src = new URL(`https://www.youtube-nocookie.com/embed/${id}`)
    const original = new URL(`https://www.youtube.com/watch?v=${id}`)
    const start = videoTime(url.searchParams.get('start') ?? url.searchParams.get('t'))
    if (start) {
      src.searchParams.set('start', String(start))
      original.searchParams.set('t', String(start))
    }
    return { provider: 'youtube', src: src.href, url: original.href }
  }

  if (['bilibili.com', 'www.bilibili.com', 'm.bilibili.com', 'player.bilibili.com'].includes(host)) {
    const player = host === 'player.bilibili.com' && path === '/player.html'
    const id = player
      ? url.searchParams.get('bvid') || (url.searchParams.get('aid') ? `av${url.searchParams.get('aid')}` : '')
      : path.match(/^\/video\/(BV[\da-zA-Z]{10}|av\d+)\/?$/)?.[1]
    if (!id || !/^(BV[\da-zA-Z]{10}|av[1-9]\d*)$/.test(id)) return null
    const src = new URL('https://player.bilibili.com/player.html')
    src.searchParams.set(id.startsWith('BV') ? 'bvid' : 'aid', id.startsWith('BV') ? id : id.slice(2))
    src.searchParams.set('autoplay', '0')
    const original = new URL(`https://www.bilibili.com/video/${id}`)
    const page = url.searchParams.get('p') ?? url.searchParams.get('page')
    if (page && /^[1-9]\d{0,5}$/.test(page)) {
      src.searchParams.set('p', page)
      original.searchParams.set('p', page)
    }
    const cid = player ? url.searchParams.get('cid') : null
    if (cid && /^[1-9]\d*$/.test(cid)) src.searchParams.set('cid', cid)
    const start = videoTime(url.searchParams.get('t'))
    if (start) src.searchParams.set('t', String(start))
    return { provider: 'bilibili', src: src.href, url: original.href }
  }

  const xHost = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)
  const id = xHost
    ? path.match(/^\/(?:[\w]+\/status(?:es)?|i\/web\/status)\/(\d+)(?:\/(?:video|photo)\/\d+)?\/?$/)?.[1]
    : ['platform.twitter.com', 'platform.x.com'].includes(host) && /^\/embed\/Tweet\.html$/.test(path)
      ? url.searchParams.get('id') : null
  if (id && /^[1-9]\d{0,24}$/.test(id)) {
    return {
      provider: 'x',
      src: `https://platform.twitter.com/embed/Tweet.html?id=${id}&dnt=true`,
      url: `https://x.com/i/web/status/${id}`
    }
  }
  return null
}

function videoTime(value: string | null): number | undefined {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Math.min(Number(value), 2147483647)
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  return match ? Math.min(Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0), 2147483647) : undefined
}
