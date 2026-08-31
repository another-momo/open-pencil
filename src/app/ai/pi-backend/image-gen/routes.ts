/**
 * T54（Phase 3 W2/T-B3）：generate_image 凭证 HTTP 面（pi-backend server 路由）。
 *
 * 端点（与 /api/pi/credentials 同纪律：只进不出，无任何回读 key 的路径）：
 *   GET    /api/pi/image-gen/credentials → { configured, presetId?, baseUrl?, model? }
 *   POST   /api/pi/image-gen/credentials { presetId, apiKey }（空 apiKey = 清除，00 #7）
 *   DELETE /api/pi/image-gen/credentials
 *
 * server.ts 在 /api/pi/ 管理面前缀之前挂本处理器（bearer 鉴权由 server.ts
 * 统一前置）。错误文案只含预设 id 等公共信息，绝不含 key。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

import type { ImageGenCredentialStore } from './credentials'

const PATHNAME = '/api/pi/image-gen/credentials'

function sendJSON(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 返回是否已处理（false = 非本面路径，交后续路由） */
export async function handleImageGenAdminRequest(
  store: ImageGenCredentialStore,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname !== PATHNAME) return false
  try {
    if (req.method === 'GET') {
      sendJSON(res, 200, store.status())
      return true
    }
    if (req.method === 'POST') {
      const body = (JSON.parse((await readBody(req)) || '{}') ?? {}) as {
        presetId?: string
        apiKey?: string
      }
      if (!body.presetId || typeof body.apiKey !== 'string') {
        res.writeHead(400).end('Bad Request: presetId and apiKey required')
        return true
      }
      // 空 key = 清除（store.set 内部分派，00 #7）
      store.set({ presetId: body.presetId, apiKey: body.apiKey })
      sendJSON(res, 200, { ok: true })
      return true
    }
    if (req.method === 'DELETE') {
      store.clear()
      sendJSON(res, 200, { ok: true })
      return true
    }
    res.writeHead(405).end('Method Not Allowed')
    return true
  } catch (error) {
    sendJSON(res, 400, { error: error instanceof Error ? error.message : String(error) })
    return true
  }
}
