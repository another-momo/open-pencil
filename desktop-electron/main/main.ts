/**
 * Electron spike 第 3 步——Electron main：用 utilityProcess 托管 pi-backend
 * + bridge 双 sidecar，打通 AI 全链路。
 *
 * 职责（与 src/app/ai/pi-backend/host.ts 对齐——host.ts 是 T33 生产编排器，
 * 本步用 utilityProcess 在 Electron 内做同款编排；env 语义刻意照抄而非共享
 * 导入，详见 spawnBridge/spawnBackend 来源注释）：
 *  1. spawn 自动化桥（electron-spike/dist-sidecar/bridge.mjs，token 经 env）
 *  2. spawn pi 后端（electron-spike/dist-sidecar/pi-backend.mjs，token + port 经 env）
 *  3. 托管 dist/（MIME 表 + SPA fallback），index.html 注入桥 token 运行时
 *     全局（__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__，见 bridge/runtime.ts P104）
 *  4. 反代 /api/pi* → 127.0.0.1:<backend> 并注入 Bearer piToken（流式管道透传，
 *     SSE 不缓冲；前端同源调用零改动）
 *  5. sidecar 崩溃退避复活（移植 vite-plugin.ts T27 语义：最多 3 次、间隔退避，
 *     一次 /health 就绪即清零）
 *  6. app quit 两段式 kill（utilityProcess.kill() = SIGTERM，2s 内未退走
 *     Windows taskkill /F 兜底——utilityProcess.kill() 不接受 signal 参数，
 *     Windows 上无原生 SIGKILL 等价）
 *  7. 窗口与 sidecar 生命周期解耦（关窗不杀 sidecar，app quit 才杀）
 *
 * token 三方对齐（不变量，spike 阶段由本文件单点维护）：
 *   pageToken === bridgeEnvToken（页面经 WS 连桥用的 token = 注入 index.html
 *     的 __OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__ = spawn 桥时 env 传入的 token）
 *   proxyBearer === piBackendEnvToken（/api/pi 反代注入的 Bearer = spawn 后端
 *     时 env 传入的 OPENPENCIL_PI_TOKEN）
 *   桥与后端的 token 彼此独立——只与代理/前端对应侧对齐即可。
 *   任何漂移都会破坏：① /rpc 401；② /api/pi 401；③ pi-backend 拿不到桥端口/token。
 */

import { randomBytes } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, utilityProcess, type UtilityProcess } from 'electron'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 端口 + token 自举 ──

// 端口随机化——避免碰主战场 7600/7700，与 sidecar-smoke 的 20000-49000 段策略同源
function randomPort(): number {
  // 排除 1420/7600/7700：再 rand 一次撞到就再 rand
  for (let i = 0; i < 8; i++) {
    const candidate = 20000 + Math.floor(Math.random() * 29000)
    if (candidate !== 1420 && candidate !== 7600 && candidate !== 7700) return candidate
  }
  return 27900
}

// spike-electron-spike：挑一个真空闲端口（先 probe-bind 再 close），让回环
// 服务能确定性地 listen 在已知端口（给 sidecar CORS origin 用）。pin 模式
// （OPENPENCIL_LOOPBACK_PORT > 0）跳过 probe。
async function pickFreePort(): Promise<number> {
  const { createServer } = await import('node:net')
  for (let attempt = 0; attempt < 32; attempt++) {
    const candidate = randomPort()
    const ok = await new Promise<boolean>((resolveProbe) => {
      const probe = createServer()
      probe.once('error', () => resolveProbe(false))
      probe.listen(candidate, '127.0.0.1', () => {
        probe.close(() => resolveProbe(true))
      })
    })
    if (ok) return candidate
  }
  throw new Error('无可用空闲端口（20000-49000 段已耗尽）')
}

// OPENPENCIL_PI_BACKEND_PORT / OPENPENCIL_MCP_PORT 是 sidecar 自身 env 名（见
// pi-backend/main.ts:92 + bridge/server/index.ts:28）。与 vite plugin 命名错开
// 是有意的——electron 主进程设的是「自己 fork 子进程时的 env」，不是 vite
// plugin 已经设过的 env，二者不冲突；vite plugin 路径走的是另一套进程。
// OPENPENCIL_LOOPBACK_PORT：full-smoke 用，把回环服务端口钉住便于外部脚本
// 经固定 URL 探活（不钉则 smoke 必须 grep 主进程 stdout 解出随机端口）
const bridgePort = Number(process.env.OPENPENCIL_BRIDGE_PORT) || randomPort()
const backendPort = Number(process.env.OPENPENCIL_PI_BACKEND_PORT_ELECTRON) || randomPort()
const pinnedLoopbackPort = Number(process.env.OPENPENCIL_LOOPBACK_PORT) || 0
// 三方对齐不变量（见文件头）
const bridgeToken = randomBytes(16).toString('hex')
const piToken = randomBytes(16).toString('hex')

// ── sidecar 子进程编排（移植 vite-plugin.ts T27 退避 + host.ts spawn 语义）──

const MAX_AUTO_RESTARTS = 3
const RESTART_BACKOFF_MS = [500, 1_500, 4_000] as const
const CHILD_EXIT_TIMEOUT_MS = 2_000
const HEALTH_TIMEOUT_MS = 15_000
const HEALTH_INTERVAL_MS = 150

interface SidecarHandle {
  readonly name: string
  readonly modulePath: string
  readonly env: NodeJS.ProcessEnv
  /** health URL——bridge 探 /health（127.0.0.1:<bridgePort>），backend 同款 */
  readonly healthUrl: string
  /** 当前活进程引用——kill / pid 查询都走这里；复活时由 spawnAndWatch 重设 */
  current: UtilityProcess | null
  /** 主动退出标记（app quit 触发，区分「意外崩溃」与「主动 kill」） */
  stopping: boolean
  /** 连续崩溃计数——一次 /health 就绪即清零 */
  restartCount: number
  /** 复活定时器——app quit 时清理 */
  restartTimer: ReturnType<typeof setTimeout> | null
}

let bridgeHandle: SidecarHandle | null = null
let backendHandle: SidecarHandle | null = null

// 「主进程端口」+ 回环 server 引用——抽成模块态供 runFullSmoke / 关窗回调复用
let portFromState = 0
let serverFromState: ReturnType<typeof createServer> | null = null

async function waitForHealth(
  child: UtilityProcess,
  healthUrl: string,
  onReady: () => void
): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    // pid 变 undefined = 子进程已退出（utilityProcess 退出后 pid 会置 undefined，
    // 见 electron.d.ts L15940），立刻放弃等待
    if (child.pid === undefined) return
    try {
      const res = await fetch(healthUrl)
      if (res.ok) {
        onReady()
        return
      }
    } catch {
      // 未就绪——继续轮询
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
  }
  console.warn(`[sidecar] ${HEALTH_TIMEOUT_MS}ms 内未等到 ${healthUrl} 就绪`)
}

function passthroughStream(stream: NodeJS.ReadableStream | null, label: string): void {
  if (!stream) return
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    process.stderr.write(`[${label}] ${chunk}`)
  })
}

function scheduleRestart(handle: SidecarHandle): void {
  if (handle.stopping) return
  if (handle.restartCount >= MAX_AUTO_RESTARTS) {
    console.error(
      `[sidecar] ${handle.name} 已连续崩溃 ${MAX_AUTO_RESTARTS} 次，停止自动复活——` +
        `修复后重启 Electron，或 bun run spike:sidecar:smoke 单起 sidecar 看启动报错`
    )
    return
  }
  const delay = RESTART_BACKOFF_MS[handle.restartCount]!
  handle.restartCount++
  console.error(`[sidecar] ${handle.name} ${delay}ms 后自动重启（第 ${handle.restartCount}/${MAX_AUTO_RESTARTS} 次）`)
  handle.restartTimer = setTimeout(() => {
    handle.restartTimer = null
    spawnAndWatch(handle)
  }, delay)
}

function spawnAndWatch(handle: SidecarHandle): void {
  // utilityProcess.fork 必须是 ESM 入口（Electron 41+ 强制 modulePath 为 ESM
  // 或 CJS 之一，dist-sidecar/*.mjs 是 ESM）
  let child: UtilityProcess
  try {
    child = utilityProcess.fork(handle.modulePath, [], {
      env: handle.env,
      serviceName: handle.name,
      // stdio: 'pipe' 让 stdout/stderr 经 main 进程透传（默认 inherit 直绑
      // 主进程终端，smoke 抓日志更稳）；stdin 固定 ignore（utilityProcess 不接）
      stdio: 'pipe'
    })
  } catch (error) {
    console.error(`[sidecar] ${handle.name} fork 失败：${error instanceof Error ? error.message : String(error)}`)
    scheduleRestart(handle)
    return
  }
  handle.current = child
  // full-smoke 用：打印 PID 让外部脚本能 taskkill 该子进程模拟崩溃。
  // child.pid 在 fork 返回时仍是 undefined（utilityProcess 文档：直到 'spawn'
  // 事件触发才赋值），所以在 'spawn' 上打印而非同步 console.log
  child.once('spawn', () => {
    console.log(`SIDECAR_PID ${handle.name} ${child.pid}`)
  })
  void waitForHealth(child, handle.healthUrl, () => {
    // 一次 /health 就绪即清零崩溃计数——只针对「连续」崩溃
    handle.restartCount = 0
    console.error(`[sidecar] ${handle.name} ready (pid=${child.pid})`)
  })

  passthroughStream(child.stdout, handle.name)
  passthroughStream(child.stderr, handle.name)

  child.on('exit', (code: number) => {
    // handle.current 被 stopSidecar 主动置 null = 主动回收（app quit 触发的
    // kill），不复活
    if (handle.current !== child) return
    handle.current = null
    if (handle.stopping) return
    if (code === 0) return // 正常退出
    console.error(`[sidecar] ${handle.name} 进程退出 code=${code}`)
    scheduleRestart(handle)
  })
}

function stopSidecar(handle: SidecarHandle): Promise<void> {
  handle.stopping = true
  if (handle.restartTimer) {
    clearTimeout(handle.restartTimer)
    handle.restartTimer = null
  }
  const child = handle.current
  handle.current = null
  if (!child || child.pid === undefined) return Promise.resolve()
  return new Promise<void>((resolveStop) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      resolveStop()
    }
    child.once('exit', finish)
    try {
      child.kill()
    } catch (error) {
      console.error(`[sidecar] ${handle.name} kill 失败：${error instanceof Error ? error.message : String(error)}`)
      finish()
      return
    }
    // SIGTERM 兜底：utilityProcess.kill() 是 SIGTERM，但 Windows 上 SIGTERM
    // 落到 Node 子进程 ≈ 立即终止（无优雅退出概念），保留 2s 是为 Unix 形态
    // 上给 sidecar 自己的 shutdown handler 排空连接。
    setTimeout(() => {
      if (settled) return
      if (child.pid === undefined) {
        finish()
        return
      }
      // Windows 兜底：用 taskkill /T /F 强杀（utilityProcess.kill() 不接受
      // signal 参数，无原生 SIGKILL；fork 的 Node 进程默认响应 SIGTERM 但
      // Windows 上常被立即强杀，保留 taskkill 是为罕见「SIGTERM 忽略」兜底）。
      if (process.platform === 'win32') {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true
        })
        killer.once('exit', finish)
        killer.once('error', finish)
      } else {
        try {
          process.kill(child.pid, 'SIGKILL')
        } catch {
          // 已退出
        }
        finish()
      }
    }, CHILD_EXIT_TIMEOUT_MS).unref()
  })
}

// ── 回环静态服务 + /api/pi 反代 ──

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

function proxyPi(req: IncomingMessage, res: ServerResponse, backendPortInner: number, bearer: string): void {
  // SSE 流式代理——vite http-proxy 的等价物（spike 不引 http-proxy 包，手写）
  // 关键纪律：
  //  1. 转发 request body（POST /api/pi-chat 的 JSON）
  //  2. 转发 response stream（SSE 不缓冲，逐 chunk）
  //  3. 客户端断连（res.close 且非 writableEnded）才销毁上游；SSE 正常结
  //     尾时 response.pipe(res) 自然 end，res.close 触发但不销毁上游
  //  4. 上游错（refused / hangup）回 502，**headersSent 后不重写**
  // 早期实现的 bug：res.on('close') 无条件 upstream.destroy()——SSE 正常
  // 结尾时 response.pipe 完成也会触发 res.close，导致上游被强杀、pi-backend
  // 看到自己的 res close（writableEnded=false 因为没显式 res.end()）→ 调
  // service.abort → 用户感知「chat 跑一半被取消」。修复：只销毁 if 客户端
  // 主动断（res.writableEnded=false）
  process.stderr.write(`[proxyPi] → ${req.method} ${req.url} (backend=${backendPortInner})\n`)
  const headers: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) if (!HOP_BY_HOP_HEADERS.has(key)) headers[key] = value
  headers.authorization = `Bearer ${bearer}`
  headers.host = `127.0.0.1:${backendPortInner}`
  const upstream = httpRequest({ host: '127.0.0.1', port: backendPortInner, path: req.url, method: req.method, headers }, (response) => {
    process.stderr.write(`[proxyPi] ← ${response.statusCode} ${req.url}\n`)
    // 客户端在等上游响应期间断开（页面刷新/设置面板切换取消在途请求）：
    // res 已销毁，writeHead/pipe 会抛 ERR_STREAM_DESTROYED / EPIPE——直接弃流
    if (res.destroyed) {
      response.destroy()
      return
    }
    const responseHeaders: Record<string, string | string[] | undefined> = {}
    for (const [key, value] of Object.entries(response.headers)) if (!HOP_BY_HOP_HEADERS.has(key)) responseHeaders[key] = value
    res.writeHead(response.statusCode ?? 502, responseHeaders)
    // pipe 不转发错误：两侧各自挂 error 监听，否则客户端中途断连时
    // res.write 抛 EPIPE → uncaughtException → Electron 弹「main process 错误」对话框
    response.on('error', (error) => {
      process.stderr.write(`[proxyPi] upstream response error: ${error.message}\n`)
      if (!res.destroyed) res.destroy()
    })
    response.pipe(res)
  })
  upstream.on('error', (error) => {
    process.stderr.write(`[proxyPi] upstream error: ${error.message}\n`)
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    }
    if (!res.writableEnded) res.end(`pi 后端不可达（${error.message}）`)
  })
  upstream.on('socket', (s) => {
    s.on('close', (hadError) => {
      process.stderr.write(`[proxyPi] upstream socket close (hadError=${hadError})\n`)
    })
  })
  res.on('error', (error) => {
    // 客户端 socket 已断后的写失败（EPIPE 典型）——吞掉并断上游，不冒泡
    process.stderr.write(`[proxyPi] client res error: ${error.message}\n`)
    upstream.destroy()
  })
  res.on('close', () => {
    process.stderr.write(`[proxyPi] client close (writableEnded=${res.writableEnded})\n`)
    // 仅当客户端断连（res 未正常结束）才销毁上游；正常 SSE 收尾不杀
    if (!res.writableEnded) {
      upstream.destroy()
    }
  })
  // POST body 透传：req.pipe 在 'end' 时自动 upstream.end()——比手写
  // data/end 健壮；Node 20 http 模块会自动等 socket 可写再 flush
  req.pipe(upstream)
}

export interface LoopbackServerOptions {
  distDir: string
  automationToken?: string
  backendPort?: number
  piToken?: string
  /** 0 = 随机端口；full-smoke 用 env 钉住便于外部脚本探活 */
  port?: number
}

export function createLoopbackServer(options: LoopbackServerOptions): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  const distDir = resolve(options.distDir)
  const indexPath = join(distDir, 'index.html')
  if (!existsAsFile(indexPath)) throw new Error(`dist/index.html 不存在：${distDir}`)
  const token = options.automationToken ?? randomBytes(16).toString('hex')
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
    if (urlPath.startsWith('/api/pi') && options.backendPort && options.piToken) {
      return proxyPi(req, res, options.backendPort, options.piToken)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    const filePath = normalize(join(distDir, urlPath))
    const relative = filePath.slice(distDir.length)
    if (relative.startsWith('..') || filePath.startsWith('..')) { res.writeHead(403).end(); return }
    const candidate = existsAsFile(filePath) ? filePath : indexPath
    if (candidate === indexPath && extname(urlPath) !== '' && urlPath !== '/' && !existsAsFile(filePath)) { res.writeHead(404).end('Not Found'); return }
    if (candidate === indexPath) {
      const html = readFileSync(indexPath, 'utf8')
      // spike-electron-spike：双注入——桥 token + 桥 WS URL（运行时全局名见
      // src/app/automation/bridge/{url,runtime}.ts）。electron 形态下桥在
      // 随机端口（bridgePort），页面必须拿这个 URL 去连；只有 token 没有 URL
      // 会让页面去撞 build-time 烘焙的 ws://127.0.0.1:7600，撞主战场 + token
      // 不符。dev 形态不注入，页面 fallback 到 vite define 烘焙值。
      const script = `<script>window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__=${JSON.stringify(token)};window.__OPENPENCIL_RUNTIME_BRIDGE_URL__=${JSON.stringify(`ws://127.0.0.1:${bridgePort}`)}</script>`
      res.writeHead(200, { 'content-type': MIME_TYPES['.html'] }); res.end(html.replace('<head>', `<head>${script}`)); return
    }
    sendFile(res, candidate)
  })
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    // pinnedLoopbackPort>0 时钉住端口；full-smoke 必须钉（外部脚本靠固定 URL
    // 探活）；0 = 随机（与 spike 第 2 步形态兼容）
    server.listen(options.port && options.port > 0 ? options.port : 0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('无法读取回环服务端口'))
      resolvePromise({ server, port: address.port })
    })
  })
}

// ── BrowserWindow 共享 options ──

// P0 外壳打磨——去掉原生标题栏：
//   titleBarStyle: 'hidden' → 隐藏标题栏但保留窗口阴影/拖拽/贴边分屏等系统行为
//   titleBarOverlay → Windows 上在页面顶部叠加原生最小化/最大化/关闭按钮（macOS
//   无按钮显示，但 overlay 字段不影响）。色值必须匹配应用顶栏实际背景——
//   src/theme/tab-bar.ts 的 root 槽位 'bg-canvas'，深色主题 token
//   --color-canvas: #1e1e1e（src/app.css L41）。height 36 = h-9 匹配顶栏高度。
//   symbolColor：Windows 不读但 Electron 类型要求，写合理前景色保持语义完整。
// 默认尺寸 1440x900：旧缺省 800x600 太小，肉眼可见「迷你窗」。抽取 helper
// 收敛三处 BrowserWindow 调用，防漂移。
const BASE_WINDOW_OPTIONS: Electron.BrowserWindowConstructorOptions = {
  width: 1440,
  height: 900,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#1e1e1e',
    symbolColor: '#ffffff',
    height: 36
  }
}

function baseWindowOptions(extra: Electron.BrowserWindowConstructorOptions = {}): Electron.BrowserWindowConstructorOptions {
  return { ...BASE_WINDOW_OPTIONS, ...extra }
}

// ── 隐藏窗探针（与 electron-smoke 同款，full-smoke 用）──

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
  // spike-electron-spike：桥 URL 运行时全局注入断言（electron 形态必命中；
  // dev 形态——OPENPENCIL_DEV_URL 路径下 main 不注入——本条天然不命中，smoke
  // 跳过本条以免误伤）
  out.runtimeBridgeUrl = typeof window.__OPENPENCIL_RUNTIME_BRIDGE_URL__ === 'string' && window.__OPENPENCIL_RUNTIME_BRIDGE_URL__.startsWith('ws://')
  record('runtime bridge url injected', out.runtimeBridgeUrl, window.__OPENPENCIL_RUNTIME_BRIDGE_URL__ ?? '')
  // spike-electron-spike：Vue mount + mcpRuntime 状态探针——证 WorkspaceView
  // onMounted 跑了 startMCPRuntime，进而 connectAutomation 才会经运行时 URL
  // 通道 WS 连桥。
  await new Promise((r) => setTimeout(r, 500))
  out.vueMounted = !!document.querySelector('[data-shell]') || !!document.querySelector('#app .app-root, #app > div')
  record('vue mounted (workspace shell rendered)', out.vueMounted, 'data-shell or #app child element')
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
  const checks = (result.checks ?? []).filter((c) =>
    !(skipTokenCheck && (c.name === 'runtime automation token injected' || c.name === 'runtime bridge url injected'))
  )
  const allOk = checks.length > 0 && checks.every((c) => c.ok)
  return { ok: allOk, result: { checks, consoleErrors, pageErrors } }
}

// ── sidecar + 回环启动（编排入口，被 main / full-smoke 共用）──

function buildSidecars(distDir: string, loopbackOrigin: string): { bridge: SidecarHandle; backend: SidecarHandle } {
  // OPENPENCIL_ROOT_DIR：sidecar cwd 不可依赖——宿主显式注入。允许通过 env
  // 覆盖（full-smoke 用），默认 spawn 时所在目录的 .openpencil/
  const rootDir = process.env.OPENPENCIL_ROOT_DIR || distDir
  // OPENPENCIL_MCP_SOCKET / OPENPENCIL_MCP_DISCOVERY_PATH：host.ts 不隔离（单
  // 实例 + 平台默认路径）；Electron 同款——不注入则 sidecar 落平台默认路径。
  // full-smoke 通过 env 覆盖到 tmp 子目录即可隔离多 smoke 实例。
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OPENPENCIL_ROOT_DIR: rootDir
  }
  const bridge: SidecarHandle = {
    name: 'openpencil-bridge',
    modulePath: join(__dirname, '..', 'dist-sidecar', 'bridge.mjs'),
    env: {
      ...baseEnv,
      PORT: String(bridgePort),
      // bridge token 经 env 进 sidecar——与 index.html 注入的 token 同源
      OPENPENCIL_MCP_AUTH_TOKEN: bridgeToken,
      // spike-electron-spike：跨源兜底——页面在 loopback 端口（http://127.0.0.1:
      // <loopback>）发 fetch 到 bridge 端口（http://127.0.0.1:<bridge>），跨
      // 源；显式给 bridge CORS origin = 页面 origin，让预检通过。旧「空字符
      // 串禁用 cors middleware」在跨源 fetch 时会让浏览器预检 401，readAutomationHealth
      // 失败 → connectAutomation 永不 register → bridge /health 永 no_app。
      OPENPENCIL_MCP_CORS_ORIGIN: loopbackOrigin
    },
    healthUrl: `http://127.0.0.1:${bridgePort}/health`,
    current: null,
    stopping: false,
    restartCount: 0,
    restartTimer: null
  }
  const backend: SidecarHandle = {
    name: 'openpencil-pi-backend',
    modulePath: join(__dirname, '..', 'dist-sidecar', 'pi-backend.mjs'),
    env: {
      ...baseEnv,
      OPENPENCIL_PI_BACKEND_PORT: String(backendPort),
      OPENPENCIL_PI_TOKEN: piToken
    },
    healthUrl: `http://127.0.0.1:${backendPort}/health`,
    current: null,
    stopping: false,
    restartCount: 0,
    restartTimer: null
  }
  console.error(
    `[electron-main] sidecar 编排就绪（bridgePort=${bridgePort} backendPort=${backendPort}）`
  )
  return { bridge, backend }
}

async function startLoopbackWithSidecars(distDir: string): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  // spike-electron-spike：先钉 loopback 端口（full-smoke 已用 OPENPENCIL_
  // LOOPBACK_PORT 注入；默认 0 = 选个空闲端口），再编排 sidecar——桥 CORS
  // origin 必须等于页面 origin（即 loopbackOrigin），跨源 fetch 才会放行。
  // 旧顺序「先 spawn bridge 再 listen loopback」会让 CORS origin 拿不到，
  // 跨源 fetch 预检 401，page-side readAutomationHealth 永远失败，桥 /health
  // 永 no_app。
  const reservedLoopbackPort = pinnedLoopbackPort > 0 ? pinnedLoopbackPort : await pickFreePort()
  const loopbackOrigin = `http://127.0.0.1:${reservedLoopbackPort}`

  // 1. 编排 sidecar——env 语义对齐 host.ts（端口 / token / discovery path 注入）
  const { bridge, backend } = buildSidecars(distDir, loopbackOrigin)
  bridgeHandle = bridge
  backendHandle = backend
  spawnAndWatch(bridge)
  spawnAndWatch(backend)

  // 2. 等双方就绪（先 bridge，后 backend——backend 的 readDiscoveryFile 找的是
  // bridge 写出的 mcp.json；超时由 waitForHealth 内部打 warn，不抛）
  await new Promise<void>((r) => setTimeout(r, 100))
  // 直接 await handle 内部 ready 不行——buildSidecars 不暴露 Promise；用
  // 轮询 /health 替代（与 vite-plugin waitForHealth 等价）
  await waitForHealthUntil(bridge.healthUrl, HEALTH_TIMEOUT_MS, 'bridge')
  await waitForHealthUntil(backend.healthUrl, HEALTH_TIMEOUT_MS, 'pi-backend')

  // 3. 起回环服务。token / port 注入 createLoopbackServer；pinnedLoopbackPort
  // 由 OPENPENCIL_LOOPBACK_PORT 解析（full-smoke 钉住便于外部脚本探活）
  const { server, port } = await createLoopbackServer({
    distDir,
    automationToken: bridgeToken,
    backendPort,
    piToken,
    port: reservedLoopbackPort
  })
  portFromState = port
  serverFromState = server
  console.error(`[electron-main] 回环服务就绪 http://127.0.0.1:${port}`)

  // 4. app quit 两段式 kill——注册到 before-quit 防止默认强杀孤儿
  app.on('before-quit', async (event) => {
    const globalScope = globalThis as { __opSidecarQuitting?: boolean }
    if (globalScope.__opSidecarQuitting) return
    globalScope.__opSidecarQuitting = true
    event.preventDefault()
    if (server) await new Promise<void>((r) => server.close(() => r()))
    await stopSidecar(backend)
    await stopSidecar(bridge)
    app.exit(0)
  })

  return { server, port }
}

async function waitForHealthUntil(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        console.error(`[electron-main] ${label} /health 200`)
        return
      }
    } catch {
      // 未就绪
    }
    await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS))
  }
  console.warn(`[electron-main] ${timeoutMs}ms 内未等到 ${url} 就绪——继续执行，依赖首次调用触发复活`)
}

// ── main 入口 ──

async function main(): Promise<void> {
  await app.whenReady()
  const devUrl = process.env.OPENPENCIL_DEV_URL
  const smokeMode = process.env.OPENPENCIL_SMOKE === '1'
  const fullSmokeMode = process.env.OPENPENCIL_FULL_SMOKE === '1'

  // full-smoke 模式：sidecar 编排 + 回环 + 隐藏窗 + 让出控制权给父脚本驱动
  // 探针（外部脚本读 FULL_SMOKE_RESULT 后自行 kill 本进程）
  if (fullSmokeMode) {
    const { server, port } = await startLoopbackWithSidecars(join(__dirname, '..', '..', 'dist'))
    const window = new BrowserWindow(baseWindowOptions({ show: false, webPreferences: { contextIsolation: true, sandbox: true } }))
    window.once('closed', () => { server.close() })
    await window.loadURL(`http://127.0.0.1:${port}`)
    const verdict = await runSmoke(window, false)
    console.log('[electron-main] FULL_SMOKE_RESULT', JSON.stringify(verdict.result))
    // 不调 app.exit——保留进程给父脚本操作 sidecar
    return
  }

  // spike-electron-spike：OPENPENCIL_SHOW=1 让窗口可见——给主 agent L3
  // 「真窗口+真编辑器+真侧链」手工探活用。spike 冒烟仍走隐藏窗路径（L3
  // 不是我的工作面，本任务不开 OPENPENCIL_SHOW，只加口）。
  const showWindow = process.env.OPENPENCIL_SHOW === '1'

  if (devUrl) {
    const window = new BrowserWindow(baseWindowOptions({ show: showWindow, webPreferences: { contextIsolation: true, sandbox: true } }))
    await window.loadURL(devUrl)
    if (smokeMode) {
      const verdict = await runSmoke(window, true)
      console.log('[electron-main] SMOKE_RESULT', JSON.stringify(verdict.result))
      app.exit(verdict.ok ? 0 : 1)
    }
    return
  }

  // 默认形态：sidecar + 回环 + 隐藏窗加载。关窗不杀 sidecar（与下一步
  // 「多窗口共享 sidecar」对齐），app quit 才杀
  const { server, port } = await startLoopbackWithSidecars(join(__dirname, '..', '..', 'dist'))
  const window = new BrowserWindow(baseWindowOptions({ show: showWindow, webPreferences: { contextIsolation: true, sandbox: true } }))
  window.once('closed', () => server.close())
  await window.loadURL(`http://127.0.0.1:${port}`)
  if (smokeMode) {
    const verdict = await runSmoke(window, false)
    console.log('[electron-main] SMOKE_RESULT', JSON.stringify(verdict.result))
    app.exit(verdict.ok ? 0 : 1)
  }
}

// 全局兜底：Electron 对 main 进程的 uncaughtException 默认弹系统错误对话框
// （「A JavaScript error occurred in the main process」）——spike 期任何漏挂
// error 监听的流（proxyPi 之类）都不该以弹窗形式打扰用户， loudly 记日志即可
process.on('uncaughtException', (error) => {
  console.error(`[electron-main] uncaughtException（已吞，进程继续）：${error.stack ?? error.message}`)
})
process.on('unhandledRejection', (reason) => {
  console.error(`[electron-main] unhandledRejection（已吞，进程继续）：${reason instanceof Error ? reason.stack : String(reason)}`)
})

void main().catch((error) => { console.error(`[electron-main] ${error instanceof Error ? error.stack : String(error)}`); app.exit(1) })

// 导出供 spike:electron:full-smoke / 单元测试用
export { spawnAndWatch, stopSidecar, bridgeHandle, backendHandle, bridgePort, backendPort, bridgeToken, piToken }
export type { SidecarHandle }
