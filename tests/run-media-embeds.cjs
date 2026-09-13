const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

if (!process.versions.electron) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawnSync(require('electron'), [__filename], { stdio: 'inherit', env, windowsHide: true })
  process.exit(child.status ?? 1)
}

const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const temp = mkdtempSync(join(tmpdir(), 'nodeloc-embed-test-'))
app.disableHardwareAcceleration()
app.setPath('userData', join(temp, 'profile'))
const timeout = setTimeout(() => { console.error('Media tests timed out'); app.exit(1) }, 30000)
app.whenReady().then(async () => {
  let window
  try {
    const bundle = await build({
      entryPoints: [resolve('tests/media-embeds.browser.tsx')],
      bundle: true, write: false, outfile: join(temp, 'tests.js'), format: 'iife', globalName: 'MediaTests', platform: 'browser',
      tsconfig: resolve('tsconfig.web.json'), loader: { '.css': 'empty', '.module.css': 'empty' },
      define: { 'process.env.NODE_ENV': '"test"' }
    })
    const built = readFileSync(resolve('out/renderer/index.html'), 'utf8')
    const csp = built.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)?.[0]
    if (!csp || !csp.includes('https://player.bilibili.com/player.html')) throw new Error('Build must include media CSP before running tests')
    writeFileSync(join(temp, 'index.html'), `<!doctype html><html><head>${csp}</head><body></body></html>`)
    window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    await window.loadFile(join(temp, 'index.html'))
    const result = await window.webContents.executeJavaScript(`${bundle.outputFiles[0].text}\nMediaTests.runTests()`)
    const framed = []
    await window.webContents.session.protocol.handle('https', (request) => {
      framed.push(new URL(request.url).hostname)
      return new Response('<!doctype html><title>Mock provider player</title>', { headers: { 'Content-Type': 'text/html' } })
    })
    await window.webContents.executeJavaScript('MediaTests.runFrameTests()')
    for (const host of ['www.youtube-nocookie.com', 'player.bilibili.com', 'platform.twitter.com']) {
      if (!framed.includes(host)) throw new Error(`CSP blocked supported player: ${host}`)
    }
    if (framed.includes('evil.test')) throw new Error('CSP allowed unrelated frame')
    console.log(`Passed ${result.length} rendering checks and 4 frame CSP checks in Electron (production file://, mocked providers).`)
    window.destroy()
    clearTimeout(timeout)
    app.quit()
  } catch (error) {
    console.error(error)
    window?.destroy()
    clearTimeout(timeout)
    app.exit(1)
  }
})
app.on('quit', () => {
  try { rmSync(temp, { recursive: true, force: true }) } catch { /* Chromium may still hold a profile lock. */ }
})
