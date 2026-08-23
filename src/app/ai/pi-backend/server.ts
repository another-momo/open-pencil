/**
 * T20 pi 后端独立 HTTP 服务（owner 拍板 2026-08-23：后端是独立进程，
 * 不是 vite 中间件）。
 *
 * 路由：
 *  - POST /api/pi-chat → SSE（UIMessage stream v1 线格式：`data: <json>\n\n`
 *    帧序列 + `data: [DONE]\n\n` 收尾），处理器自 T19 vite-plugin.ts 迁入
 *  - GET  /health → { status: 'ok' }（vite 插件 spawn 后就绪探针 + 冒烟前置检查）
 *
 * 请求体：{ sessionId: string, messages: UIMessage[] }（ai SDK Chat 默认全量
 * messages 上报；本 service 只取末条 user 文本，历史由后端 SessionManager 持有）。
 *
 * 仅运行于独立 bun/node 进程（main.ts 入口或 vite 插件 spawn 的子进程），
 * 不经 vite esbuild 打包——package 导入（@open-pencil/mcp/* 等 workspace 包）可用。
 * key 卫生：OPENROUTER_API_KEY 只经 process.env 读取，不打印、不落盘明文。
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { PI_BACKEND_DEFAULT_PORT } from './config'
import { createPiChatService } from './service'

export { PI_BACKEND_DEFAULT_PORT }

type PiChatRequestBody = {
  sessionId?: string
  messages?: Array<{
    role: string
    parts?: Array<{ type: string; text?: string }>
  }>
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
    await service.prompt(sessionId, text, emit)
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

export function createPiBackendServer({ rootDir }: { rootDir: string }): Server {
  const service = createPiChatService({ rootDir })
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    if (url.pathname === '/api/pi-chat') {
      void handlePiChatRequest(service, req, res)
      return
    }
    res.writeHead(404).end('Not Found')
  })
  // SSE 长连接 + 长生成：关闭请求级超时（默认 300s 会斩断长回合）
  server.requestTimeout = 0
  return server
}
