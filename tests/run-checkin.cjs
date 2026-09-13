const assert = require('node:assert/strict')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')
const { build } = require('esbuild')

async function run() {
  const output = join(mkdtempSync(join(tmpdir(), 'nodeloc-checkin-test-')), 'client.cjs')
  await build({
    entryPoints: [resolve('src/main/api/client.ts')], outfile: output,
    bundle: true, platform: 'node', format: 'cjs', tsconfig: resolve('tsconfig.node.json'),
    plugins: [{ name: 'mock-electron', setup(builder) {
      builder.onResolve({ filter: /^electron$/ }, () => ({ path: 'electron', namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const app = { isPackaged: true }; export const session = { fromPartition: () => globalThis.checkinSession };' }))
    } }]
  })
  const { DiscourseClient } = require(output)
  const requests = []
  let csrfReply = { csrf: 'session-token' }
  let csrfStatus = 200
  let writeStatus = 200
  globalThis.checkinSession = { fetch: async (url, options) => {
    requests.push({ url, ...options })
    return new Response(JSON.stringify(url.endsWith('/session/csrf.json') ? csrfReply : { success: writeStatus === 200 }), {
      status: url.endsWith('/session/csrf.json') ? csrfStatus : writeStatus,
      headers: { 'Content-Type': 'application/json' }
    })
  } }
  const client = new DiscourseClient({
    origin: 'https://www.nodeloc.com', partition: 'mock',
    scheduler: { schedule: (_priority, task) => task() },
    getCredentials: () => ({ userApiKey: 'test-key', clientId: 'test-client' })
  })
  const request = {
    method: 'POST', path: '/checkin',
    headers: { 'X-Discourse-Checkin': 'true', 'X-Checkin-Nonce': 'unique-test-nonce', 'X-CSRF-Token': 'untrusted-token' },
    form: [['nonce', 'unique-test-nonce'], ['timestamp', 1234567890]], priority: 'user'
  }
  assert.equal((await client.request(request)).ok, true)
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ['/session/csrf.json', '/checkin'])
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].headers['User-Api-Key'], 'test-key')
  assert.equal(requests[1].headers['X-CSRF-Token'], 'session-token')
  assert.equal(requests[1].headers['X-Discourse-Checkin'], 'true')
  assert.equal(requests[1].headers['X-Checkin-Nonce'], 'unique-test-nonce')
  assert.equal(new URLSearchParams(requests[1].body).get('nonce'), 'unique-test-nonce')

  requests.length = 0
  csrfReply = { csrf: 'fresh-token' }
  await client.request(request)
  assert.equal(requests[1].headers['X-CSRF-Token'], 'fresh-token')

  for (const reply of [null, {}, { csrf: '' }]) {
    requests.length = 0
    csrfReply = reply
    assert.equal((await client.request(request)).error.kind, 'decode')
    assert.equal(requests.length, 1, 'Never submit check-in without a valid token')
  }
  requests.length = 0
  csrfStatus = 403
  assert.equal((await client.request(request)).error.kind, 'forbidden')
  assert.equal(requests.length, 1)

  requests.length = 0
  csrfStatus = 200
  csrfReply = { csrf: 'session-token' }
  writeStatus = 403
  assert.equal((await client.request(request)).error.kind, 'forbidden')
  assert.equal(requests.length, 2, 'Never automatically retry a rejected check-in')

  requests.length = 0
  await client.request({ method: 'POST', path: '/posts.json', form: [['raw', 'test']] })
  assert.equal(requests.length, 1, 'Other writes keep their existing request flow')
  assert.equal(requests[0].headers['X-CSRF-Token'], undefined)
  console.log('Passed check-in request contract: CSRF ordering, fresh tokens, headers, token failures, no automatic retries, unrelated writes.')
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
