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
 * 请求体：{ sessionId: string, messages: UIMessage[], model?: ModelSpec }
 * （ai SDK Chat 默认全量 messages 上报；本 service 只取末条 user 文本，
 * 历史由后端 SessionManager 持有。model 为前端 design role 解析结果，T21）。
 *
 * 仅运行于独立 bun/node 进程（main.ts 入口或 vite 插件 spawn 的子进程），
 * 不经 vite esbuild 打包——package 导入（@open-pencil/mcp/* 等 workspace 包）可用。
 * key 卫生：凭据只进不出（写入经 provider-admin，任何响应/日志不含 key）。
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'

import { PI_BACKEND_DEFAULT_PORT } from './config'
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
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
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
  } catch {
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

  const emit = (chunk: unknown) => {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }

  try {
    await service.prompt(sessionId, text, emit, body.model)
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
    // 错误文案由 provider-admin 保证不含 key 本体
    sendJSON(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

export function createPiBackendServer({ rootDir }: { rootDir: string }): Server {
  const admin = createProviderAdmin({ agentDir: join(rootDir, '.openpencil', 'pi-agent') })
  const service = createPiChatService({ rootDir, admin })
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/health') {
      sendJSON(res, 200, { status: 'ok' })
      return
    }
    if (url.pathname === '/api/pi-chat') {
      void handlePiChatRequest(service, req, res)
      return
    }
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
