/**
 * T54（Phase 3 W2/T-B3）：DMX GPT-image-2 provider 核心（自写，路线乙
 * 主路线）——自 open-pencil 仓 feature/agent-backend @ 5d38aa4e 的
 * tools/image-gen/providers.ts dmxImageProvider 移植。
 *
 * 与源的差异：
 * - ofetch → 原生 fetch（红线：不引入新 npm 依赖；pi-backend 进程不经
 *   vite 打包，原生 fetch/FormData/Blob 均可用）
 * - 模块级可变凭证（setImageGenCredentials）→ 依赖注入：凭证经
 *   createDmxImageGenProvider({credentials}) 传入，fetch 可注入（测试 mock）
 * - 超时：源 timeout 选项保留语义，改 AbortSignal.timeout；默认 240s
 *   （生图 HTTP 超时独立于桥超时，S3 §4），env OPENPENCIL_IMAGE_GEN_TIMEOUT_MS
 *   可覆盖（调用时读取）
 *
 * key 卫生：本模块不打印 key；错误信息取自响应体（DMX/OpenAI 兼容端点的
 * error.message），不含请求头。
 */

import { decodeBase64 } from '@open-pencil/core/bytes'
import type {
  ImageGenProvider,
  ImageGenRequest,
  ImageGenResult
} from '@open-pencil/core/tools/fork/image-gen/requests'

import type { ImageGenCredentials } from './credentials'

/** 生图 HTTP 超时基线（S3 §4：240s，独立于桥超时）；env 可覆盖 */
export const IMAGE_GEN_DEFAULT_TIMEOUT_MS = 240_000

export function imageGenTimeoutMs(): number {
  return Number(process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS) || IMAGE_GEN_DEFAULT_TIMEOUT_MS
}

interface ImageAPIItem {
  b64_json?: string
  url?: string
}

interface ImageAPIResponse {
  data?: ImageAPIItem[]
}

type FetchLike = typeof fetch

async function extractImageBytes(
  data: ImageAPIResponse,
  fetchImpl: FetchLike,
  signal: AbortSignal
): Promise<Uint8Array> {
  const item = data.data?.[0]
  if (!item) throw new Error('Image API returned no image data')
  if (item.b64_json) return decodeBase64(item.b64_json)
  if (item.url) {
    const response = await fetchImpl(item.url, { signal })
    if (!response.ok) throw new Error(`Download generated image: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
  throw new Error('Image API response missing b64_json and url')
}

interface APIErrorBody {
  error?: { message?: string } | string
  detail?: string
  message?: string
}

/** 非 2xx 时从响应体提取真实错误文案（OpenAI 兼容 error.message / detail / 纯文本） */
async function apiErrorMessage(response: Response): Promise<string> {
  const fallback = `Image API: HTTP ${response.status}`
  const text = await response.text().catch(() => '')
  if (!text.trim()) return fallback
  let body: APIErrorBody | null = null
  try {
    body = JSON.parse(text) as APIErrorBody
  } catch {
    body = null // 非 JSON 错误体 → 原文返回
  }
  if (body) {
    if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string') {
      return body.error.message
    }
    if (typeof body.detail === 'string' && body.detail) return body.detail
    if (typeof body.error === 'string' && body.error) return body.error
    if (typeof body.message === 'string' && body.message) return body.message
  }
  return text.slice(0, 500)
}

export interface DmxImageGenProviderOptions {
  credentials: ImageGenCredentials
  /** 测试注入点（CI 凭证链 mock，D34）；缺省用全局 fetch */
  fetchImpl?: FetchLike
  /** 缺省读 env OPENPENCIL_IMAGE_GEN_TIMEOUT_MS || 240_000 */
  timeoutMs?: number
}

export function createDmxImageGenProvider(options: DmxImageGenProviderOptions): ImageGenProvider {
  const { credentials } = options
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? imageGenTimeoutMs()
  const baseURL = credentials.baseUrl.replace(/\/$/, '')

  return {
    name: `dmx-gpt-image-2(${credentials.presetId})`,
    async generate(req: ImageGenRequest, images?: Uint8Array[]): Promise<ImageGenResult> {
      if (!credentials.apiKey) throw new Error('Image-gen API key not configured')
      const hasDims =
        req.width != null &&
        req.height != null &&
        Number.isFinite(req.width) &&
        Number.isFinite(req.height)
      const size = hasDims ? `${req.width}x${req.height}` : 'auto'
      const resultWidth = hasDims ? (req.width as number) : 1024
      const resultHeight = hasDims ? (req.height as number) : 1024
      const withCompression = (target: FormData | Record<string, unknown>) => {
        if (
          (req.outputFormat === 'jpeg' || req.outputFormat === 'webp') &&
          req.outputCompression != null
        ) {
          if (target instanceof FormData)
            target.append('output_compression', String(req.outputCompression))
          else target.output_compression = req.outputCompression
        }
      }

      const signal = AbortSignal.timeout(timeoutMs)
      let response: Response
      if (images && images.length > 0) {
        const form = new FormData()
        form.append('model', credentials.model)
        form.append('prompt', req.prompt)
        form.append('size', size)
        form.append('n', '1')
        form.append('quality', req.quality ?? 'auto')
        form.append('output_format', req.outputFormat ?? 'png')
        withCompression(form)
        form.append('background', req.background ?? 'auto')
        form.append('moderation', 'auto')
        images.forEach((bytes, index) => {
          form.append(
            'image[]',
            new Blob([bytes.slice().buffer], { type: 'image/png' }),
            `input-${index + 1}.png`
          )
        })

        response = await fetchImpl(`${baseURL}/images/edits`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${credentials.apiKey}` },
          body: form,
          signal
        })
      } else {
        const body: Record<string, unknown> = {
          model: credentials.model,
          prompt: req.prompt,
          size,
          n: 1,
          quality: req.quality ?? 'auto',
          output_format: req.outputFormat ?? 'png',
          background: req.background ?? 'auto',
          moderation: 'auto'
        }
        withCompression(body)

        response = await fetchImpl(`${baseURL}/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal
        })
      }

      if (!response.ok) throw new Error(await apiErrorMessage(response))
      const data = (await response.json()) as ImageAPIResponse
      const bytes = await extractImageBytes(data, fetchImpl, signal)
      return { bytes, width: resultWidth, height: resultHeight }
    }
  }
}
