/**
 * T33 生产编排器（localhost 分发骨架）：vite dev server 客串的编排职责的生产
 * 形态入口。`bun run build && bun run serve` 一条链起完整产品——静态编辑器 +
 * pi 后端 + MCP 工具桥，浏览器打开即用。
 *
 * 职责（对齐两个 vite 插件的行为，env 语义刻意复制而非共享导入——automation
 * 面在 pendingReclass 区且有「只允许相对导入」约束，重分类仪式未到不动它；
 * 复制面各约 10 行，来源注释见 spawnBridge/spawnBackend）：
 *  1. spawn MCP 桥（packages/mcp/src/index.ts，TCP 7600 + token）
 *  2. spawn pi 后端（src/app/ai/pi-backend/main.ts，7700 + token env 注入）
 *  3. 托管 dist/（MIME 表 + SPA fallback），index.html 注入桥 token 运行时
 *     全局（配合 spawn.ts P104 的 window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__
 *     hook——上游生产形态靠 Tauri 读 discovery 文件，web 形态无该通道）
 *  4. 反代 /api/pi* → 127.0.0.1:7700 并注入 Bearer（流式管道透传，SSE 不缓冲；
 *     客户端断连即销毁上游请求，chat abort 语义与 vite proxy 一致）
 *
 * 端口：主服务 OPENPENCIL_SERVE_PORT（默认 8080）；子进程沿用既有常量
 * 7600/7700。与 vite dev 互斥（同端口冲突时子进程 EADDRINUSE 文案已有）。
 * key 卫生：token 只经 env 进子进程 / 经注入脚本进同源页面，不落日志。
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type ServerResponse
} from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'
import { readDiscoveryFile } from '@open-pencil/mcp/discovery'
import { getSocketPath, platformHasUnixSockets } from '@open-pencil/mcp/transport'

import { PI_BACKEND_DEFAULT_PORT } from './config'

const rootDir = process.cwd()
const distDir = resolve(rootDir, 'dist')
const servePort = Number(process.env.OPENPENCIL_SERVE_PORT ?? 8080)
const backendPort = Number(process.env.OPENPENCIL_PI_BACKEND_PORT ?? PI_BACKEND_DEFAULT_PORT)
// CORS/WS 都按主服务来源放行（浏览器跨源 fetch 桥 /health 需要它）
const serveOrigin = `http://localhost:${servePort}`

function randomToken(): string {
  return randomBytes(16).toString('hex')
}

const automationToken = randomToken()
const piToken = randomToken()

// ── 子进程编排（语义复制自 automation/bridge/vite-plugin.ts startChild）──

let bridge: ChildProcess | null = null
let backend: ChildProcess | null = null

function passthroughStderr(child: ChildProcess, label: string): void {
  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    if (text.includes('EADDRINUSE')) {
      console.error(
        `[host] ${label} 端口绑定失败（可能另一个 OpenPencil 实例/dev server 正在运行）——先停掉占用 ${AUTOMATION_HTTP_PORT}/${backendPort} 的进程`
      )
      child.kill()
      return
    }
    process.stderr.write(data)
  })
}

async function stopChild(child: ChildProcess | null, label: string): Promise<void> {
  if (!child) return
  // 经函数读 exitCode：直读会被 type-aware 收窄定死、循环比较判「不可能」（lint
  // 实证），函数调用每次取实时值——同 automation/bridge/vite-plugin.ts hasExited 先例
  const hasExited = (): boolean => child.exitCode !== null
  if (hasExited()) return
  child.kill()
  const deadline = Date.now() + 2_000
  while (!hasExited() && Date.now() < deadline) {
    await new Promise((r) => {
      setTimeout(r, 50)
    })
  }
  if (!hasExited()) child.kill('SIGKILL')
  console.error(`[host] ${label} 已停止`)
}

async function spawnBridge(): Promise<void> {
  // env 语义复制自 automation/bridge/vite-plugin.ts createAutomationEnvironment
  // （默认 configuration：鉴权开、root=cwd、无禁用工具）
  //
  // T34 评估：跟不跟 OPENPENCIL_MCP_DISCOVERY_PATH 隔离（0f981ff2）？
  // 不跟——host.ts 自身是生产形态，7600 端口独占（serveOrigin 也固定），
  // 多实例会被端口 EADDRINUSE 拦截，不存在 dev-plugin 同款「worktree 隔离」
  // 场景。discovery 默认路径 `~/.openpencil/mcp.json` 在 host.ts 单实例下不
  // 构成冲突；若未来扩成同主机多 host.ts 实例，再补 OPENPENCIL_MCP_DISCOVERY_PATH
  // 临时目录隔离——届时复用 vite-plugin 的 sha256(runtimeId) 方案即可。
  const socketPath = platformHasUnixSockets() ? await getSocketPath() : null
  bridge = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
    stdio: ['ignore', 'inherit', 'pipe'],
    env: {
      ...process.env,
      PORT: String(AUTOMATION_HTTP_PORT),
      OPENPENCIL_MCP_TCP: '1',
      ...(socketPath ? { OPENPENCIL_MCP_SOCKET: socketPath } : {}),
      OPENPENCIL_MCP_AUTH_TOKEN: automationToken,
      OPENPENCIL_MCP_CORS_ORIGIN: serveOrigin,
      OPENPENCIL_MCP_ROOT: rootDir,
      OPENPENCIL_MCP_DISABLED_TOOLS: ''
    }
  })
  bridge.on('error', (err) => console.error(`[host] 无法 spawn MCP 桥：${err.message}`))
  passthroughStderr(bridge, 'MCP 桥')
}

async function spawnBackend(): Promise<void> {
  // env 语义复制自 ai/pi-backend/vite-plugin.ts spawnBackend
  backend = spawn('bun', ['run', 'src/app/ai/pi-backend/main.ts'], {
    stdio: ['ignore', 'inherit', 'pipe'],
    env: {
      ...process.env,
      OPENPENCIL_PI_BACKEND_PORT: String(backendPort),
      OPENPENCIL_PI_TOKEN: piToken
    }
  })
  backend.on('error', (err) => console.error(`[host] 无法 spawn pi 后端：${err.message}`))
  passthroughStderr(backend, 'pi 后端')
}

// ── 就绪探针 ──

async function waitFor(
  label: string,
  timeoutMs: number,
  probe: () => Promise<boolean>
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await probe()) return
      // 探针内的连接拒绝/404 即「未就绪」，属预期路径
    } catch (error) {
      console.warn(
        `[host] ${label} 探针异常（继续等待）：${error instanceof Error ? error.message : String(error)}`
      )
    }
    await new Promise((r) => {
      setTimeout(r, 200)
    })
  }
  throw new Error(
    `[host] ${timeoutMs}ms 内未等到 ${label} 就绪——查看上方子进程日志定位启动失败原因`
  )
}

async function backendReadyProbe(): Promise<boolean> {
  const res = await fetch(`http://127.0.0.1:${backendPort}/health`)
  return res.ok
}

async function bridgeReadyProbe(): Promise<boolean> {
  return (await readDiscoveryFile()) !== null
}

// ── 静态托管（dist/ + SPA fallback + index.html token 注入）──

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
}

/** index.html 前置注入运行时桥 token（spawn.ts P104 消费；dev 构建无此需求但注入无害） */
function withRuntimeToken(html: string): string {
  const script = `<script>window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__=${JSON.stringify(automationToken)}</script>`
  const headIndex = html.indexOf('<head>')
  if (headIndex === -1) return script + html
  return html.slice(0, headIndex + 6) + script + html.slice(headIndex + 6)
}

function sendFile(res: ServerResponse, filePath: string): void {
  res.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream'
  })
  // 读失败（权限/竞态删除）转 500，不让未捕获流错误炸进程
  const stream = createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
  stream.pipe(res)
}

function isInsideDist(filePath: string): boolean {
  const relative = normalize(filePath).slice(distDir.length)
  return !relative.startsWith('..') && !normalize(filePath).startsWith('..')
}

// ── /api/pi 反代（流式；语义对齐 vite proxy + Bearer 注入）──

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer'
])

function proxyPi(req: IncomingMessage, res: ServerResponse): void {
  const headers: Record<string, string | string[] | undefined> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key)) headers[key] = value
  }
  headers.authorization = `Bearer ${piToken}`
  headers.host = `127.0.0.1:${backendPort}`
  const upstream = httpRequest(
    { host: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers },
    (up) => {
      // 上游的 hop-by-hop 头不回写（transfer-encoding 由 node 按流自动处理）
      const responseHeaders: Record<string, string | string[] | undefined> = {}
      for (const [key, value] of Object.entries(up.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(key)) responseHeaders[key] = value
      }
      res.writeHead(up.statusCode ?? 502, responseHeaders)
      up.pipe(res) // 逐 chunk 透传——SSE 不缓冲
    }
  )
  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    }
    res.end(`pi 后端不可达（${error instanceof Error ? error.message : String(error)}）`)
  })
  // 客户端断连（chat abort）→ 销毁上游请求，后端 SSE 链路随之终止
  res.on('close', () => upstream.destroy())
  req.pipe(upstream)
}

// ── host 主服务 ──

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
  // 前缀语义对齐 vite proxy 的 '/api/pi'：含 /api/pi-chat 等连字符路由
  if (urlPath.startsWith('/api/pi')) {
    proxyPi(req, res)
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  const filePath = normalize(join(distDir, urlPath))
  if (!isInsideDist(filePath)) {
    res.writeHead(403).end()
    return
  }
  const servePath = existsAsFile(filePath) ? filePath : join(distDir, 'index.html')
  const isIndex = servePath === join(distDir, 'index.html')
  if (isIndex && extname(urlPath) !== '' && urlPath !== '/' && !existsAsFile(filePath)) {
    // 带扩展名但不存在的资源不做 SPA fallback（真实 404）
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found')
    return
  }
  if (isIndex) {
    // index.html 每次现读现注 token（文件小，且避免缓存陈旧 token）
    const html = readFileSyncSafe(servePath)
    if (html === null) {
      res.writeHead(500).end()
      return
    }
    res.writeHead(200, { 'content-type': MIME_TYPES['.html'] })
    res.end(withRuntimeToken(html))
    return
  }
  sendFile(res, servePath)
}

function existsAsFile(filePath: string): boolean {
  try {
    // 目录也满足 R_OK——必须 stat 显式排除（T33 冒烟实证：'/' 曾致 EISDIR 崩溃）
    return statSync(filePath).isFile()
  } catch {
    // 不可读/不存在即 false——静态分派的常规路径
    // oxlint-disable-next-line open-pencil/no-silent-catch
    return false
  }
}

function readFileSyncSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8')
  } catch {
    // 读 index 失败 → 调用方转 500 出声，此处无需重复日志
    // oxlint-disable-next-line open-pencil/no-silent-catch
    return null
  }
}

function main(): void {
  if (!existsAsFile(join(distDir, 'index.html'))) {
    console.error('[host] dist/index.html 不存在——先跑 bun run build 再 bun run serve')
    process.exit(1)
  }
  void (async () => {
    await spawnBridge()
    await spawnBackend()
    await waitFor('MCP 桥（discovery 文件）', 15_000, bridgeReadyProbe)
    console.error(`[host] MCP 桥就绪（127.0.0.1:${AUTOMATION_HTTP_PORT}）`)
    await waitFor(`pi 后端（/health @ ${backendPort}）`, 15_000, backendReadyProbe)
    console.error(`[host] pi 后端就绪（127.0.0.1:${backendPort}）`)
    const server = createServer(handleRequest)
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[host] 端口 ${servePort} 已被占用——换 OPENPENCIL_SERVE_PORT 或停掉占用进程`)
      } else {
        console.error(`[host] 启动失败：${error.message}`)
      }
      void shutdown()
      process.exitCode = 1
    })
    server.listen(servePort, '127.0.0.1', () => {
      console.error(`[host] OpenPencil 已就绪 → ${serveOrigin}`)
      console.error('[host] Ctrl+C 退出（级联停止后端与工具桥）')
    })
  })().catch((error: unknown) => {
    console.error(`[host] 启动失败：${error instanceof Error ? error.message : String(error)}`)
    void shutdown()
    process.exitCode = 1
  })
}

let shuttingDown = false
async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  await stopChild(backend, 'pi 后端')
  await stopChild(bridge, 'MCP 桥')
}
process.on('SIGINT', () => void shutdown().then(() => process.exit(0)))
process.on('SIGTERM', () => void shutdown().then(() => process.exit(0)))

main()
