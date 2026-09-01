/**
 * T54（Phase 3 W2/T-B3）：generate_image 凭证 HTTP 面（pi-backend server 路由）。
 * T66（P0/P1）：presetId 退役——POST 收 providerType/baseUrl/model/apiKey
 * 四键（全部用户手填）。T71（owner 裁决 2026-09-01）：POST .../test 连接探针
 * 端点移除——并非所有 provider 实现 /models 列表端点，探针结论不可靠。
 *
 * 端点（与 /api/pi/credentials 同纪律：只进不出，无任何回读 key 的路径）：
 *   GET    /api/pi/image-gen/credentials → { configured, providerType?, baseUrl?, model? }
 *   POST   /api/pi/image-gen/credentials { providerType, baseUrl, model, apiKey }
 *          （空 apiKey = 清除，00 #7；此时其余字段不校验）
 *   DELETE /api/pi/image-gen/credentials
 *
 * server.ts 在 /api/pi/ 管理面前缀之前挂本处理器（bearer 鉴权由 server.ts
 * 统一前置）。错误文案只含公共信息，绝不含 key；全部 4xx 一律 JSON 信封
 * （前端 requestJSON 只解 JSON——纯文本 400 会让用户只看到「HTTP 400」，
 * T66 曾在此踩坑，T71 统一）。
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

async function handleCredentialsRequest(
  store: ImageGenCredentialStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method === 'GET') {
    sendJSON(res, 200, store.status())
    return
  }
  if (req.method === 'DELETE') {
    store.clear()
    sendJSON(res, 200, { ok: true })
    return
  }
  if (req.method !== 'POST') {
    sendJSON(res, 405, { error: 'Method Not Allowed' })
    return
  }
  const body = (JSON.parse((await readBody(req)) || '{}') ?? {}) as {
    providerType?: string
    baseUrl?: string
    model?: string
    apiKey?: string
  }
  if (typeof body.apiKey !== 'string') {
    sendJSON(res, 400, { error: 'apiKey required' })
    return
  }
  // 空 key = 清除（00 #7：清除必须生效；清除不依赖其余字段）
  if (!body.apiKey.trim()) {
    store.clear()
    sendJSON(res, 200, { ok: true })
    return
  }
  if (!body.providerType || !body.baseUrl?.trim() || !body.model?.trim()) {
    sendJSON(res, 400, { error: 'providerType, baseUrl, model and apiKey required' })
    return
  }
  store.set({
    providerType: body.providerType,
    baseUrl: body.baseUrl,
    model: body.model,
    apiKey: body.apiKey
  })
  sendJSON(res, 200, { ok: true })
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
    await handleCredentialsRequest(store, req, res)
  } catch (error) {
    sendJSON(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
  return true
}
