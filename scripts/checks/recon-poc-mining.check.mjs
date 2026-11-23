// Subject: T-14/T-15/T-16 primitives — scope fence, asset ledger, parsers,
// PoC positive/negative verdict, candidate extraction. Network is limited to a
// local lab HTTP server in the PoC case.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { distDir } from './artifacts.mjs'
import { createReporter, skip } from './reporter.mjs'

const reconEntry = join(distDir, 'recon.js')
const pocEntry = join(distDir, 'poc.js')
const miningEntry = join(distDir, 'mining.js')
if (![reconEntry, pocEntry, miningEntry].every((path) => existsSync(path))) skip('recon-poc-mining', 'need packages/helmd/dist (run pnpm build)')
const recon = await import(pathToFileURL(reconEntry).href)
const poc = await import(pathToFileURL(pocEntry).href)
const mining = await import(pathToFileURL(miningEntry).href)
const home = mkdtempSync(join(tmpdir(), 'helmd-recon-'))
const report = createReporter('recon-poc-mining')

await report.check('scope fence rejects out-of-scope and private targets unless lab', () => {
  assert.equal(recon.checkReconTarget('api.example.com', ['example.com']).ok, true)
  assert.equal(recon.checkReconTarget('evil.test', ['example.com']).ok, false)
  assert.equal(recon.checkReconTarget('127.0.0.1', ['127.0.0.1']).ok, false)
  assert.equal(recon.checkReconTarget('127.0.0.1', ['127.0.0.1'], true).ok, true)
  assert.equal(recon.checkReconTarget('example.com', []).ok, false)
  assert.equal(recon.checkReconTarget('203.0.113.10', ['203.0.113.0/24']).ok, true)
  assert.equal(recon.checkReconTarget('203.0.114.10', ['203.0.113.0/24']).ok, false)
  assert.equal(recon.checkReconTarget('[2001:db8::1]', ['2001:db8::/32']).ok, true)
  assert.equal(recon.checkReconTarget('::ffff:127.0.0.1', ['::ffff:127.0.0.1']).ok, false)
})

await report.check('asset ledger dedupes kind|value|parent and coverage counts dimensions', () => {
  const dir = join(home, 'assets')
  mkdirSync(join(dir, 'recon'), { recursive: true })
  const first = recon.addAsset(dir, { kind: 'host', value: 'a.example.com', source: 'test' })
  const second = recon.addAsset(dir, { kind: 'host', value: 'a.example.com', source: 'test-2' })
  assert.equal(first.deduped, false)
  assert.equal(second.deduped, true)
  recon.addAsset(dir, { kind: 'port', value: '443', parent: 'a.example.com', source: 'test' })
  const coverage = recon.coverageFor(recon.loadAssets(dir))
  assert.equal(coverage.dns, 1)
  assert.equal(coverage.ports, 1)
  assert.match(recon.coverageLine(recon.loadAssets(dir)), /\[recon\] assets 2/)
})

await report.check('nmap/httpx/nuclei parsers map to the same asset vocabulary', () => {
  const nmap = recon.parseNmapXml('<nmaprun><host><address addr="10.0.0.5"/><ports><port portid="22"/><port portid="443"/></ports></host></nmaprun>')
  assert.deepEqual(nmap, [{ host: '10.0.0.5', ports: [22, 443] }])
  assert.equal(recon.parseHttpxJsonl('{"url":"https://x/","tech":["nginx"],"status_code":200}\n')[0].tech[0], 'nginx')
  assert.equal(recon.parseNucleiJsonl('{"host":"https://x","matched-at":"https://x/a","template-id":"t"}\n')[0].template, 't')
})

await report.check('PoC verdict matrix is positive + negative control', () => {
  assert.equal(poc.classifyPoc(true, false).verdict, 'verified')
  assert.equal(poc.classifyPoc(true, true).verdict, 'inconclusive')
  assert.equal(poc.classifyPoc(false, false).verdict, 'refuted')
  assert.ok(poc.recipeById('sqli-boolean'))
  const rendered = poc.renderPocRequest({ method: 'GET', headers: { a: '1' } }, { headers: { b: '2' } })
  assert.deepEqual(rendered.headers, { a: '1', b: '2' })
})

await report.check('HAR/OpenAPI/text extractors dedupe and rank candidates', () => {
  const har = JSON.stringify({ log: { entries: [
    { request: { url: 'https://x/api/account?id=1' } },
    { request: { url: 'https://x/api/account?id=1' } },
    { request: { url: 'https://x/static/a.js' } },
  ] } })
  const harRows = mining.extractHar(har, 'https://x')
  assert.equal(harRows.length, 2)
  const openapi = JSON.stringify({ openapi: '3.0.0', paths: { '/api/user/{id}': { get: { parameters: [{ name: 'id', in: 'path' }] } } } })
  const apiRows = mining.extractOpenApi(openapi, 'https://x')
  assert.equal(apiRows[0].param, 'id')
  assert.ok(mining.extractText('fetch("https://x/api/v1/items?q=1")', 'https://x').length > 0)
})

await report.check('local lab PoC sends positive and negative requests and records evidence', async () => {
  const server = createServer((req, res) => {
    if (String(req.url).startsWith('/escape')) {
      res.writeHead(302, { location: 'http://example.invalid/outside-scope' })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(String(req.url).includes('payload=1') ? '<svg/onload=alert(1)>' : 'benign page')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('no port')
    const dir = join(home, 'lab-case')
    mkdirSync(join(dir, 'evidence'), { recursive: true })
    writeFileSync(join(dir, 'CASE.md'), 'status: open\ngoal: lab\nmode: full\nroute: pentest\nscope: 127.0.0.1\n')
    const { getCase, bindCase } = await import(pathToFileURL(join(distDir, 'case.js')).href)
    bindCase('sess-lab', { dir, name: 'lab-case', goal: 'lab', mode: 'full', route: 'pentest', scope: ['127.0.0.1'] })
    const { registerPocTools } = await import(pathToFileURL(join(distDir, 'tools', 'poc.js')).href)
    let tool
    registerPocTools({ tools: { register: (def) => { if (def.name === 'run_poc') tool = def } }, get: () => undefined })
    const out = await tool.execute({
      recipe: 'xss-canary',
      url: `http://127.0.0.1:${address.port}/`,
      positive_suffix: '?payload=1',
      negative_suffix: '?payload=0',
      lab: true,
    }, { agent: { id: 'sess-lab' } })
    assert.match(out, /verdict: verified/)
    assert.match(out, /positive_evidence_ids=\[E-001\]/)
    assert.match(out, /negative_evidence_ids=\[E-002\]/)
    assert.equal(getCase('sess-lab').scope[0], '127.0.0.1')
    await assert.rejects(tool.execute({
      recipe: 'xss-canary', url: `http://127.0.0.1:${address.port}/escape`, lab: true,
    }, { agent: { id: 'sess-lab' } }), /redirect target rejected/)
    const { registerReconTools } = await import(pathToFileURL(join(distDir, 'tools', 'recon.js')).href)
    let httpTool
    registerReconTools({ tools: { register: (def) => { if (def.name === 'recon_http') httpTool = def } } })
    await assert.rejects(httpTool.execute({ url: `http://127.0.0.1:${address.port}/escape`, lab: true },
      { agent: { id: 'sess-lab' } }), /redirect target rejected/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

await report.check('cross-origin redirects strip credentials, same-origin redirects keep them', async () => {
  const { requestText } = await import(pathToFileURL(join(distDir, 'star-gate.js')).href)
  let forwarded = {}
  const destination = createServer((req, res) => {
    forwarded = { auth: req.headers.authorization, cookie: req.headers.cookie }
    res.end('done')
  })
  const origin = createServer((req, res) => {
    if (req.url === '/within') { res.end(req.headers.authorization ?? 'missing'); return }
    res.writeHead(302, { location: req.url === '/cross'
      ? `http://127.0.0.1:${destination.address().port}/target`
      : '/within' })
    res.end()
  })
  await new Promise((resolve) => destination.listen(0, '127.0.0.1', resolve))
  await new Promise((resolve) => origin.listen(0, 'localhost', resolve))
  try {
    const url = `http://localhost:${origin.address().port}`
    const init = { method: 'GET', headers: { Authorization: 'test-token', Cookie: 'test-cookie' } }
    assert.equal((await requestText(url + '/same', init)).text, 'test-token')
    assert.equal((await requestText(url + '/cross', init)).status, 200)
    assert.equal(forwarded.auth, undefined)
    assert.equal(forwarded.cookie, undefined)
  } finally {
    await new Promise((resolve) => origin.close(resolve))
    await new Promise((resolve) => destination.close(resolve))
  }
})

await report.check('HTTP through a CONNECT proxy uses an HTTP-compatible agent', async () => {
  const { requestText } = await import(pathToFileURL(join(distDir, 'star-gate.js')).href)
  const target = createServer((_req, res) => res.end('proxied HTTP'))
  const proxy = createServer()
  proxy.on('connect', (_req, downstream) => {
    const upstream = connect(target.address().port, '127.0.0.1', () => {
      downstream.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      upstream.pipe(downstream)
      downstream.pipe(upstream)
    })
    upstream.on('error', () => downstream.destroy())
  })
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve))
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  const old = { https: process.env.HTTPS_PROXY, no: process.env.NO_PROXY, lower: process.env.no_proxy }
  process.env.HTTPS_PROXY = `http://127.0.0.1:${proxy.address().port}`
  process.env.NO_PROXY = ''
  process.env.no_proxy = ''
  try {
    const result = await requestText(`http://example.invalid:${target.address().port}/`, { method: 'GET', headers: {} })
    assert.equal(result.text, 'proxied HTTP')
  } finally {
    for (const [name, value] of [['HTTPS_PROXY', old.https], ['NO_PROXY', old.no], ['no_proxy', old.lower]]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await new Promise((resolve) => proxy.close(resolve))
    await new Promise((resolve) => target.close(resolve))
  }
})

await report.check('loopback OOB listener records one callback and stops cleanly', async () => {
  const oob = await import(pathToFileURL(join(distDir, 'oob.js')).href)
  const session = await oob.startOob(60_000)
  assert.match(session.url, /^http:\/\/127\.0\.0\.1:\d+\//)
  await fetch(session.url + '?canary=1')
  const hits = oob.pollOob(session.id)
  assert.equal(hits.length, 1)
  assert.match(hits[0].url, /canary=1/)
  assert.equal(oob.stopOob(session.id), true)
  assert.equal(oob.stopOob(session.id), false)
})

await report.check('Android binary XML string pool is decoded without aapt', () => {
  const strings = ['com.example.app', 'https://api.example.com/v1/user?id=1', 'android.permission.INTERNET']
  const encoded = strings.map((value) => {
    const bytes = Buffer.from(value, 'utf8')
    return Buffer.concat([Buffer.from([value.length, bytes.length]), bytes, Buffer.from([0])])
  })
  const headerSize = 28
  const stringsStart = headerSize + strings.length * 4
  const data = Buffer.concat(encoded)
  const size = stringsStart + data.length
  const buffer = Buffer.alloc(size)
  buffer.writeUInt16LE(0x0001, 0)
  buffer.writeUInt16LE(headerSize, 2)
  buffer.writeUInt32LE(size, 4)
  buffer.writeUInt32LE(strings.length, 8)
  buffer.writeUInt32LE(0, 12)
  buffer.writeUInt32LE(0x100, 16)
  buffer.writeUInt32LE(stringsStart, 20)
  buffer.writeUInt32LE(0, 24)
  let offset = 0
  for (let i = 0; i < encoded.length; i += 1) {
    buffer.writeUInt32LE(offset, headerSize + i * 4)
    offset += encoded[i].length
  }
  data.copy(buffer, stringsStart)
  assert.deepEqual(mining.decodeAxmlStrings(buffer), strings)
  const candidates = mining.extractCandidates('', 'https://api.example.com', 'apk')
  assert.ok(Array.isArray(candidates))
})

rmSync(home, { recursive: true, force: true })
report.finish()
