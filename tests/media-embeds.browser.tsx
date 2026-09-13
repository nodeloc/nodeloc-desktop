import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server.browser'
import { parseMediaEmbed } from '../src/shared/media-embed'
import { renderChildren } from '../src/renderer/src/features/content/render-dom'
import { sanitizeCooked } from '../src/renderer/src/features/content/sanitize'

export function runTests(): string[] {
  const passed: string[] = []
  const check = (name: string, condition: unknown): void => {
    if (!condition) throw new Error(name)
    passed.push(name)
  }
  const render = (html: string): Document => new DOMParser().parseFromString(
    renderToStaticMarkup(createElement('div', null, ...renderChildren(sanitizeCooked(html), { images: [] }, 'test'))), 'text/html'
  )

  const fixtures: [string, string, string][] = [
    ['YouTube current Discourse placeholder', '<div class="lazy-video-container" data-provider-name="youtube" data-video-id="dQw4w9WgXcQ"></div>', 'youtube-nocookie.com'],
    ['YouTube legacy provider attribute', '<div class="lazy-video-container" data-provider="youtube" data-video-id="dQw4w9WgXcQ"></div>', 'youtube-nocookie.com'],
    ['YouTube lazyYT', '<div class="lazyYT" data-youtube-id="dQw4w9WgXcQ"></div>', 'youtube-nocookie.com'],
    ['YouTube iframe', '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', 'youtube-nocookie.com'],
    ['Bilibili protocol-relative iframe', '<p><iframe class="bilibili-onebox" src="//player.bilibili.com/player.html?bvid=BV1B7411m7LV&amp;p=2"></iframe></p>', 'player.bilibili.com'],
    ['Bilibili AV iframe', '<iframe src="https://player.bilibili.com/player.html?aid=170001"></iframe>', 'player.bilibili.com'],
    ['Bilibili preview', '<aside class="onebox" data-onebox-src="https://www.bilibili.com/video/BV1B7411m7LV"><p>preview</p></aside>', 'player.bilibili.com'],
    ['X onebox', '<aside class="onebox twitterstatus" data-onebox-src="https://x.com/user/status/1234567890123456789"><h4>Post</h4></aside>', 'platform.twitter.com'],
    ['X onebox source link', '<aside class="onebox twitterstatus"><header class="source"><a href="https://twitter.com/user/status/1234567890123456789">X</a></header></aside>', 'platform.twitter.com'],
    ['X blockquote', '<blockquote class="twitter-tweet"><p>A video</p><a href="https://x.com/user/status/1234567890123456789">Date</a></blockquote><script src="https://platform.twitter.com/widgets.js"></script>', 'platform.twitter.com'],
    ['X iframe', '<iframe src="https://platform.twitter.com/embed/Tweet.html?id=1234567890123456789"></iframe>', 'platform.twitter.com'],
    ['Standalone YouTube link', '<p> <a href="https://youtu.be/dQw4w9WgXcQ?t=1m30s">video</a> </p>', 'youtube-nocookie.com'],
    ['Standalone Bilibili link', '<p><a href="https://www.bilibili.com/video/BV1B7411m7LV?p=3">video</a></p>', 'player.bilibili.com'],
    ['Standalone X video link', '<p><a href="https://x.com/user/status/1234567890123456789/video/1">video</a></p>', 'platform.twitter.com'],
    ['Uncooked onebox link', '<a class="onebox" href="https://youtu.be/dQw4w9WgXcQ">video</a>', 'youtube-nocookie.com']
  ]
  for (const [name, html, host] of fixtures) {
    const doc = render(html)
    const frames = doc.querySelectorAll('iframe')
    check(name, frames.length === 1 && frames[0].src.includes(host))
    check(`${name}: isolated frame`, frames[0].sandbox.contains('allow-scripts') && !frames[0].sandbox.contains('allow-top-navigation') && !doc.querySelector('script'))
    check(`${name}: no redundant source link`, !doc.querySelector('a'))
  }

  check('YouTube start time survives', parseMediaEmbed('https://youtu.be/dQw4w9WgXcQ?t=1m30s')?.src.endsWith('?start=90'))
  const bili = parseMediaEmbed('https://player.bilibili.com/player.html?bvid=BV1B7411m7LV&page=2&autoplay=1&evil=yes')!
  check('Bilibili page survives and autoplay is disabled', new URL(bili.src).searchParams.get('p') === '2' && new URL(bili.src).searchParams.get('autoplay') === '0' && !bili.src.includes('evil'))
  check('X status ID retains precision', parseMediaEmbed('https://twitter.com/u/status/1234567890123456789')?.src.includes('1234567890123456789'))
  check('Generated URLs can pass sanitizer and renderer again', fixtures.every(([, html]) => {
    const src = render(html).querySelector('iframe')!.src
    return parseMediaEmbed(src)?.src === src
  }))

  for (const bad of [
    'javascript:alert(1)', 'data:text/html,test', 'file:///C:/test.html',
    'https://www.youtube.com.evil.test/embed/dQw4w9WgXcQ',
    'https://www.youtube.com@evil.test/embed/dQw4w9WgXcQ',
    'https://user@www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com:444/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/redirect?q=evil',
    'https://player.bilibili.com/evil.html?bvid=BV1B7411m7LV',
    'https://platform.twitter.com/widgets.js?id=123', 'https://x.com/user',
    'https://youtu.be/not-an-id', 'https://www.bilibili.com/video/invalid'
  ]) check(`Reject ${bad}`, parseMediaEmbed(bad) === null)

  const attack = render('<iframe src="https://evil.test"></iframe><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" srcdoc="evil" onload="alert(1)" style="position:fixed" sandbox="allow-top-navigation"></iframe><img src="x" onerror="alert(1)"><script>alert(1)</script>')
  check('Untrusted iframe removed', attack.querySelectorAll('iframe').length === 1)
  check('Unsafe frame attributes removed', !attack.querySelector('[srcdoc], [onload], [onerror], script') && !attack.querySelector('iframe')!.getAttribute('style'))
  check('Inline links remain inline', render('<p>Watch <a href="https://youtu.be/dQw4w9WgXcQ">this</a> later.</p>').querySelectorAll('iframe').length === 0)
  check('Text surrounding iframe survives', render('<p>Before<iframe src="https://player.bilibili.com/player.html?bvid=BV1B7411m7LV"></iframe>After</p>').body.textContent?.includes('Before') && render('<p>Before<iframe src="https://player.bilibili.com/player.html?bvid=BV1B7411m7LV"></iframe>After</p>').body.textContent?.includes('After'))
  check('Ordinary onebox retained', render('<aside class="onebox" data-onebox-src="https://example.com"><h3>Example</h3></aside>').querySelector('aside')?.textContent === 'Example')
  check('Other lazy providers retain link fallback', render('<div class="lazy-video-container" data-provider-name="vimeo" data-video-id="12345"></div>').querySelector('a')?.href === 'https://vimeo.com/12345')
  return passed
}

/** Mount real iframe elements so Chromium, rather than string matching, checks the CSP. */
export async function runFrameTests(): Promise<void> {
  for (const url of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.bilibili.com/video/BV1B7411m7LV', 'https://x.com/u/status/20']) {
    const html = renderToStaticMarkup(createElement('div', null, ...renderChildren(sanitizeCooked(`<p><a href="${url}">video</a></p>`), { images: [] }, 'frame')))
    const container = document.createElement('div')
    container.innerHTML = html
    const frame = container.querySelector('iframe')!
    frame.loading = 'eager'
    const loaded = new Promise<void>((resolve) => { frame.onload = () => resolve() })
    document.body.append(container)
    await loaded
  }
  await new Promise<void>((resolve, reject) => {
    const onViolation = (event: SecurityPolicyViolationEvent): void => {
      if (event.violatedDirective === 'frame-src' && event.blockedURI.startsWith('https://evil.test')) {
        document.removeEventListener('securitypolicyviolation', onViolation)
        resolve()
      }
    }
    document.addEventListener('securitypolicyviolation', onViolation)
    const frame = document.createElement('iframe')
    frame.src = 'https://evil.test/frame'
    document.body.append(frame)
    setTimeout(() => reject(new Error('CSP failed to reject an unrelated frame')), 2000)
  })
}
