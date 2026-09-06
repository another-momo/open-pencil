import { randomBytes } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
}
const HOP_BY_HOP_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer'])

function existsAsFile(filePath: string): boolean {
  try { return statSync(filePath).isFile() } catch { return false }
}

function sendFile(res: ServerResponse, filePath: string): void {
  res.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream' })
  const stream = createReadStream(filePath)
  stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end() })
  stream.pipe(res)
}

function proxyPi(req: IncomingMessage, res: ServerResponse, backendPort: number): void {
  const headers: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) if (!HOP_BY_HOP_HEADERS.has(key)) headers[key] = value
  headers.host = `127.0.0.1:${backendPort}`
  const upstream = httpRequest({ host: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers }, (response) => {
    const responseHeaders: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(response.headers)) if (!HOP_BY_HOP_HEADERS.has(key)) responseHeaders[key] = value
    res.writeHead(response.statusCode ?? 502, responseHeaders)
    response.pipe(res)
  })
  upstream.on('error', (error) => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`pi 后端不可达（${error.message}）`) })
  res.on('close', () => upstream.destroy())
  req.pipe(upstream)
}

export interface LoopbackServerOptions {
  distDir: string
  automationToken?: string
  backendPort?: number
}

export function createLoopbackServer(options: LoopbackServerOptions): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  const distDir = resolve(options.distDir)
  const indexPath = join(distDir, 'index.html')
  if (!existsAsFile(indexPath)) throw new Error(`dist/index.html 不存在：${distDir}`)
  const token = options.automationToken ?? randomBytes(16).toString('hex')
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (urlPath.startsWith('/api/pi') && options.backendPort) return proxyPi(req, res, options.backendPort)
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    const filePath = normalize(join(distDir, urlPath))
    const relative = filePath.slice(distDir.length)
    if (relative.startsWith('..') || filePath.startsWith('..')) { res.writeHead(403).end(); return }
    const candidate = existsAsFile(filePath) ? filePath : indexPath
    if (candidate === indexPath && extname(urlPath) !== '' && urlPath !== '/' && !existsAsFile(filePath)) { res.writeHead(404).end('Not Found'); return }
    if (candidate === indexPath) {
      const html = readFileSync(indexPath, 'utf8')
      const script = `<script>window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__=${JSON.stringify(token)}</script>`
      res.writeHead(200, { 'content-type': MIME_TYPES['.html'] }); res.end(html.replace('<head>', `<head>${script}`)); return
    }
    sendFile(res, candidate)
  })
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('无法读取回环服务端口'))
      resolvePromise({ server, port: address.port })
    })
  })
}

const PROBE_SCRIPT = `(async () => {
  const out = { checks: [] }
  function record(name, ok, detail) { out.checks.push({ name, ok: !!ok, detail: detail ?? null }); return !!ok }
  out.rootExists = !!document.querySelector('#app, [data-shell]')
  record('editor root', out.rootExists, 'document selector #app or [data-shell]')
  out.ck = await (async () => {
    try {
      const res = await fetch('/canvaskit.wasm', { method: 'GET' })
      const ct = res.headers.get('content-type') || ''
      const buf = await res.arrayBuffer()
      return { ok: res.ok && ct.includes('application/wasm') && buf.byteLength > 1024, status: res.status, contentType: ct, size: buf.byteLength }
    } catch (e) { return { ok: false, error: String(e) } }
  })()
  record('canvaskit.wasm fetchable via http', out.ck.ok, JSON.stringify(out.ck))
  out.idb = await (async () => {
    try {
      const open = indexedDB.open('openpencil-smoke', 1)
      await new Promise((res, rej) => { open.onupgradeneeded = () => open.result.createObjectStore('kv'); open.onsuccess = res; open.onerror = () => rej(open.error) })
      const db = open.result
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put('hello-electron', 'k')
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error) })
      const readTx = db.transaction('kv', 'readonly')
      const v = await new Promise((res, rej) => { const r = readTx.objectStore('kv').get('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
      db.close()
      return { ok: v === 'hello-electron', value: v }
    } catch (e) { return { ok: false, error: String(e) } }
  })()
  record('idb write+read', out.idb.ok, JSON.stringify(out.idb))
  out.token = typeof window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__ === 'string' && window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__.length > 0
  record('runtime automation token injected', out.token, window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__ ?? '')
  window.__SMOKE_RESULT__ = out
})().catch((e) => { window.__SMOKE_RESULT__ = { fatal: String(e) } })`

async function runSmoke(window: BrowserWindow, skipTokenCheck: boolean): Promise<{ ok: boolean; result: unknown }> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  window.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) consoleErrors.push(message)
  })
  window.webContents.on('render-process-gone', (_e, details) => consoleErrors.push('render-process-gone: ' + JSON.stringify(details)))
  window.webContents.on('did-fail-load', (_e, code, desc, url) => pageErrors.push('did-fail-load: ' + code + ' ' + desc + ' ' + url))
  await window.webContents.executeJavaScript(PROBE_SCRIPT, true)
  const raw = await window.webContents.executeJavaScript('window.__SMOKE_RESULT__', true)
  const result = (raw ?? {}) as { fatal?: string; checks?: Array<{ name: string; ok: boolean; detail: string | null }> }
  if (result.fatal) return { ok: false, result: { ...result, consoleErrors, pageErrors } }
  const checks = (result.checks ?? []).filter((c) => !(skipTokenCheck && c.name === 'runtime automation token injected'))
  const allOk = checks.length > 0 && checks.every((c) => c.ok)
  return { ok: allOk, result: { checks, consoleErrors, pageErrors } }
}

async function main(): Promise<void> {
  await app.whenReady()
  const devUrl = process.env.OPENPENCIL_DEV_URL
  const smokeMode = process.env.OPENPENCIL_SMOKE === '1'
  if (devUrl) {
    const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
    await window.loadURL(devUrl)
    if (smokeMode) {
      const verdict = await runSmoke(window, true)
      console.log('[electron-main] SMOKE_RESULT', JSON.stringify(verdict.result))
      app.exit(verdict.ok ? 0 : 1)
    }
    return
  }
  const { server, port } = await createLoopbackServer({ distDir: join(__dirname, '..', '..', 'dist') })
  const window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } })
  window.once('closed', () => server.close())
  await window.loadURL(`http://127.0.0.1:${port}`)
  if (smokeMode) {
    const verdict = await runSmoke(window, false)
    console.log('[electron-main] SMOKE_RESULT', JSON.stringify(verdict.result))
    app.exit(verdict.ok ? 0 : 1)
  }
}

void main().catch((error) => { console.error(`[electron-main] ${error instanceof Error ? error.stack : String(error)}`); app.exit(1) })
