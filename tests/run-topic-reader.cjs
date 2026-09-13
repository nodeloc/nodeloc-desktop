const { mkdtempSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')
const suite = process.argv[2] ?? 'topic-reader'
if (!['topic-reader', 'checkin', 'reactions', 'feed-compact'].includes(suite)) throw new Error('Unknown UI test suite')

if (!process.versions.electron) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawnSync(require('electron'), [__filename, suite], { stdio: 'inherit', env, windowsHide: true })
  process.exit(child.status ?? 1)
}

const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const temp = mkdtempSync(join(tmpdir(), 'nodeloc-reader-test-'))
app.disableHardwareAcceleration()
app.setPath('userData', join(temp, 'profile'))
const timeout = setTimeout(() => { console.error('Reader tests timed out'); app.exit(1) }, 30000)
app.whenReady().then(async () => {
  let window
  try {
    const bundle = await build({
      entryPoints: [resolve(`tests/${suite}.browser.tsx`)],
      bundle: true, write: false, format: 'iife', globalName: 'ReaderTests', platform: 'browser',
      tsconfig: resolve('tsconfig.web.json'), loader: { '.css': 'empty', '.module.css': 'empty' },
      define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'error'
    })
    writeFileSync(join(temp, 'index.html'), '<!doctype html><html><body></body></html>')
    window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    window.webContents.session.webRequest.onBeforeRequest((request, callback) => {
      callback({ cancel: /^https?:/.test(request.url) })
    })
    await window.loadFile(join(temp, 'index.html'))
    const passed = await window.webContents.executeJavaScript(`${bundle.outputFiles[0].text}\nReaderTests.runTests()`)
    console.log(`Passed ${passed.length} ${suite} checks in Electron with mocked API responses:\n${passed.join('\n')}`)
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
