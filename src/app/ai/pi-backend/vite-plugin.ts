/**
 * T19 vite 中间件：POST /api/pi-chat → SSE（UIMessage stream v1 线格式：
 * `data: <json>\n\n` 帧序列 + `data: [DONE]\n\n` 收尾）。
 *
 * 装配形态照抄 vite/automation.ts 的 openPencilAutomationPlugin（configureServer
 * + middlewares.use）；D4（独立 localhost serve 产品形态）不在本 task。
 *
 * 请求体：{ sessionId: string, messages: UIMessage[] }（ai SDK Chat 默认全量
 * messages 上报；本 service 只取末条 user 文本，历史由后端 SessionManager 持有）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { Plugin } from 'vite'

import { createPiChatService } from './service'

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

export function piBackendPlugin(): Plugin {
  return {
    name: 'openpencil-pi-backend',
    apply: 'serve',
    configureServer(server) {
      const service = createPiChatService({ rootDir: server.config.root })

      server.middlewares.use('/api/pi-chat', (req: IncomingMessage, res: ServerResponse) => {
        void handlePiChatRequest(service, req, res)
      })
    }
  }
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
