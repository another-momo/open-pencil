/**
 * T20 pi 后端独立 HTTP 服务（owner 拍板 2026-08-23：后端是独立进程，
 * 不是 vite 中间件）。
 *
 * 路由：
 *  - POST /api/pi-chat → SSE（UIMessage stream v1 线格式：`data: <json>\n\n`
 *    帧序列 + `data: [DONE]\n\n` 收尾），处理器自 T19 vite-plugin.ts 迁入
 *  - GET  /health → { status: 'ok' }（vite 插件 spawn 后就绪探针 + 冒烟前置检查）
 *  - T21 provider/凭据管理（pi 原生，provider-admin.ts）：
 *    GET /api/pi/catalog（目录 + auth 状态，脱敏）、POST /api/pi/credentials、
 *    DELETE /api/pi/credentials、POST /api/pi/providers（自定义 provider）
 *    ——无任何回读 key 的端点
 *
 * 请求体：{ sessionId: string, messages: UIMessage[], model?: ModelSpec,
 * documentId?: string, chatMode?: 'ui'|'marketing', pickedProfileId?: string|null }
 * （ai SDK Chat 默认全量 messages 上报；本 service 只取末条 user 文本，
 * 历史由后端 SessionManager 持有。model 为前端 design role 解析结果，T21。
 * documentId 为桥目标注入，T22。chatMode/pickedProfileId 为 T24 四层装配
 * 的最小载荷——types/profiles/工作流段永远后端读，T24-plan D7）。
 *
 * T22：GET /api/pi/history?docKey=<族谱前缀>（或 ?sessionId=<完整 id>）→
 * { sessionId, messages }——会话族谱解析 + 历史回填（T22-plan D2/D3）。
 *
 * T24：GET /api/pi/brand/manifest → PiBrandManifest（种子脱敏投影，
 * 无 markdown 正文）——前端 profile 选择器数据源（T24-plan D6）。
 *
 * 仅运行于独立 bun/node 进程（main.ts 入口或 vite 插件 spawn 的子进程），
 * 不经 vite esbuild 打包——package 导入（@open-pencil/mcp/* 等 workspace 包）可用。
 * key 卫生：凭据只进不出（写入经 provider-admin，任何响应/日志不含 key）。
 *
 * T28（决策单 #1）：除 /health 外全部端点要求 Authorization: Bearer <token>
 * （auth.ts，timingSafeEqual 定常比较）；token 由 main.ts 解析传入——vite 插件
 * spawn 时经 env 注入（proxy 自动补头，前端零改动），standalone 自生成落
 * .openpencil/pi-backend-token。无 token 配置时 fail-close 全拒（不应发生）。
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'

import { isAuthorized } from './auth'
import { PI_BACKEND_DEFAULT_PORT } from './config'
import { isPiChatMode } from './modes'
import { createProviderAdmin, type ModelSpec } from './provider-admin'
import { createPiChatService } from './service'

export { PI_BACKEND_DEFAULT_PORT }

type PiChatRequestBody = {
  sessionId?: string
  messages?: Array<{
    role: string
    parts?: Array<{ type: string; text?: string }>
  }>
  model?: ModelSpec
  documentId?: string
  chatMode?: string
  pickedProfileId?: string | null
}

// T27：UIMessage[] 全量上报的最大合理体量留有数量级余量（聊天文本 KB 级）
const MAX_BODY_BYTES = 4 * 1024 * 1024
class PayloadTooLargeError extends Error {
  constructor() {
    super('request body too large')
    this.name = 'PayloadTooLargeError'
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // T27：请求体上限——超限即拒并断流，防无界读取打爆后端内存
      if (size > MAX_BODY_BYTES) {
        reject(new PayloadTooLargeError())
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function lastUserText(body: PiChatRequestBody): string {
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')
  return (lastUser?.parts ?? [])
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n')
}

async function handlePiChatRequest(
  service: ReturnType<typeof createPiChatService>,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405).end('Method Not Allowed')
    return
  }

  let body: PiChatRequestBody
  try {
    body = JSON.parse(await readBody(req)) as PiChatRequestBody
  } catch (error) {
    // T27：超限单独 413；其余（坏 JSON / 连接中断）按 400
    if (error instanceof PayloadTooLargeError) {
      res.writeHead(413).end('Payload Too Large')
      return
    }
    res.writeHead(400).end('Bad Request: invalid JSON')
    return
  }

  const sessionId = body.sessionId
  const text = lastUserText(body)
  if (!sessionId || !text.trim()) {
    res.writeHead(400).end('Bad Request: sessionId and non-empty user text required')
    return
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-vercel-ai-ui-message-stream': 'v1'
  })

  // T27：客户端断连（前端 stop 只 abort fetch）时取消后端当次 run，停止烧 token；
  // 正常收尾（res.end 已发）时 writableEnded 为 true，不误伤
  res.on('close', () => {
    if (!res.writableEnded) void service.abort(sessionId)
  })

  const emit = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }

  try {
    await service.prompt(sessionId, text, emit, {
      model: body.model,
      documentId: body.documentId,
      chatMode: isPiChatMode(body.chatMode) ? body.chatMode : undefined,
      pickedProfileId: typeof body.pickedProfileId === 'string' ? body.pickedProfileId : null
    })
  } catch (error) {
    emit({
      type: 'error',
      errorText: error instanceof Error ? error.message : String(error)
    })
  } finally {
    res.write('data: [DONE]\n\n')
    res.end()
  }
}

function sendJSON(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function handleAdminRequest(
  admin: ReturnType<typeof createProviderAdmin>,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<void> {
  try {
    if (pathname === '/api/pi/catalog') {
      if (req.method !== 'GET') {
        res.writeHead(405).end('Method Not Allowed')
        return
      }
      sendJSON(res, 200, await admin.getCatalog())
      return
    }
    if (pathname === '/api/pi/credentials') {
      const body = (JSON.parse((await readBody(req)) || '{}') ?? {}) as {
        providerId?: string
        apiKey?: string
      }
      if (req.method === 'POST') {
        if (!body.providerId || !body.apiKey) {
          res.writeHead(400).end('Bad Request: providerId and apiKey required')
          return
        }
        await admin.setCredential(body.providerId, body.apiKey)
        sendJSON(res, 200, { ok: true })
        return
      }
      if (req.method === 'DELETE') {
        if (!body.providerId) {
          res.writeHead(400).end('Bad Request: providerId required')
          return
        }
        await admin.deleteCredential(body.providerId)
        sendJSON(res, 200, { ok: true })
        return
      }
      res.writeHead(405).end('Method Not Allowed')
      return
    }
    if (pathname === '/api/pi/providers') {
      if (req.method !== 'POST') {
        res.writeHead(405).end('Method Not Allowed')
        return
      }
      const body = JSON.parse((await readBody(req)) || '{}') as Parameters<
        ReturnType<typeof createProviderAdmin>['upsertProvider']
      >[0]
      await admin.upsertProvider(body)
      sendJSON(res, 200, { ok: true })
      return
    }
    res.writeHead(404).end('Not Found')
  } catch (error) {
    // T27：超限 413；其余错误文案由 provider-admin 保证不含 key 本体
    if (error instanceof PayloadTooLargeError) {
      res.writeHead(413).end('Payload Too Large')
      return
    }
    sendJSON(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * T27：只读 GET 路由（history/sessions/brand manifest）统一收编——
 * ① fs 读取异常不应打穿进程（500 而非崩溃/悬挂）；② 从 createServer 回调
 * 抽出控制复杂度（oxlint complexity 上限）。返回是否已处理。
 * 必须在 /api/pi/ 管理面前缀之前匹配（调用方保证顺序）。
 */
function handleReadonlyPiRequest(
  service: ReturnType<typeof createPiChatService>,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): boolean {
  const { pathname } = url
  if (
    pathname !== '/api/pi/history' &&
    pathname !== '/api/pi/sessions' &&
    pathname !== '/api/pi/brand/manifest'
  ) {
    return false
  }
  if (req.method !== 'GET') {
    res.writeHead(405).end('Method Not Allowed')
    return true
  }
  try {
    // T22：历史回填（D3）——docKey 前缀解析族内最新会话，或 sessionId 精确读取
    if (pathname === '/api/pi/history') {
      const exact = url.searchParams.get('sessionId')
      const docKey = url.searchParams.get('docKey')
      const sessionId = exact ?? (docKey ? service.resolveLatestSessionId(docKey) : null)
      if (!sessionId) {
        sendJSON(res, 200, { sessionId: null, messages: [] })
        return true
      }
      sendJSON(res, 200, { sessionId, messages: service.readHistory(sessionId) })
      return true
    }
    // T23：会话族谱清单（E1）——docKey 前缀扫描族内全部会话摘要，最新在前
    if (pathname === '/api/pi/sessions') {
      const docKey = url.searchParams.get('docKey')
      sendJSON(res, 200, { sessions: docKey ? service.listSessionFamily(docKey) : [] })
      return true
    }
    // T24：brand manifest（D6）——种子脱敏投影供前端 profile 选择器
    sendJSON(res, 200, service.getBrandManifest())
  } catch (error) {
    sendJSON(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
  return true
}

export function createPiBackendServer({
  rootDir,
  authToken
}: {
  rootDir: string
  /** T28：bearer 鉴权 token（main.ts 解析）；null = 无配置，fail-close 全拒 */
  authToken: string | null
}): Server {
  const admin = createProviderAdmin({ agentDir: join(rootDir, '.openpencil', 'pi-agent') })
  const service = createPiChatService({ rootDir, admin })
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/health') {
      sendJSON(res, 200, { status: 'ok' })
      return
    }
    // T28：/health（就绪探针）之外全部端点鉴权——管理面写 key/baseUrl、
    // 只读面泄会话历史，都不能裸奔；未带/带错 token 一律 401（响应不含任何提示内容）
    if (!isAuthorized(req.headers.authorization, authToken)) {
      sendJSON(res, 401, { error: 'unauthorized' })
      return
    }
    if (url.pathname === '/api/pi-chat') {
      void handlePiChatRequest(service, req, res)
      return
    }
    // T22/T23/T24 只读路由（须在 /api/pi/ 管理面前缀之前匹配）
    if (handleReadonlyPiRequest(service, req, res, url)) return
    if (url.pathname.startsWith('/api/pi/')) {
      void handleAdminRequest(admin, req, res, url.pathname)
      return
    }
    res.writeHead(404).end('Not Found')
  })
  // SSE 长连接 + 长生成：关闭请求级超时（默认 300s 会斩断长回合）
  server.requestTimeout = 0
  return server
}
