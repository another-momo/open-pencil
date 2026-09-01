/**
 * T54（Phase 3 W2/T-B3）：OpenAI 兼容图像 API provider 核心（自写，路线乙
 * 主路线）——自 open-pencil 仓 feature/agent-backend @ 5d38aa4e 的
 * tools/image-gen/providers.ts 移植。T66 起去 DMX 命名（P1）：本实现是通用
 * OpenAI 兼容端（/images/generations + /images/edits，Bearer 鉴权），
 * 与任何特定中转商无关；凭证四键（providerType/baseUrl/model/apiKey）
 * 全部由用户手填（T66 P0 删预设表）。
 *
 * 与源的差异：
 * - ofetch → 原生 fetch（红线：不引入新 npm 依赖；pi-backend 进程不经
 *   vite 打包，原生 fetch/FormData/Blob 均可用）
 * - 模块级可变凭证（setImageGenCredentials）→ 依赖注入：凭证经
 *   createImageGenProvider({credentials}) 传入，fetch 可注入（测试 mock）
 * - 超时：源 timeout 选项保留语义，改 AbortSignal.timeout；默认 240s
 *   （生图 HTTP 超时独立于桥超时，S3 §4），env OPENPENCIL_IMAGE_GEN_TIMEOUT_MS
 *   可覆盖（调用时读取）
 *
 * key 卫生：本模块不打印 key；错误信息取自响应体（OpenAI 兼容端点的
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

/** GET /models 列表响应（OpenAI 兼容 { data: [...] } 形状） */
interface ModelsListResponseBody {
  data?: unknown[]
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

export interface ImageGenProviderOptions {
  credentials: ImageGenCredentials
  /** 测试注入点（CI 凭证链 mock，D34）；缺省用全局 fetch */
  fetchImpl?: FetchLike
  /** 缺省读 env OPENPENCIL_IMAGE_GEN_TIMEOUT_MS || 240_000 */
  timeoutMs?: number
}

/**
 * T66 P3：显式 response_format: 'url'。依据 = OpenAI 兼容端惯例（OpenAI
 * images API 与各类中转代理均识别该参数且默认即为 url；显式写出消除
 * 「依赖各端默认值」的隐式假设，extractImageBytes 的 url 分支即消费路径，
 * b64_json 分支保留为端间差异兜底）。
 * 风险在案：不识别该参数的端点（如未来接入的 Seedream 协议族）按 JSON
 * 惯例应忽略未知字段——若某端因此报错，属该端不守兼容惯例，届时在
 * provider 层按 providerType 分派处理（T66 只有 openai-compatible 一族）。
 */
const RESPONSE_FORMAT = 'url'

export function createImageGenProvider(options: ImageGenProviderOptions): ImageGenProvider {
  const { credentials } = options
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? imageGenTimeoutMs()
  const baseURL = credentials.baseUrl.replace(/\/$/, '')

  return {
    name: `openai-compatible(${credentials.model})`,
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
        form.append('response_format', RESPONSE_FORMAT)
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
          moderation: 'auto',
          response_format: RESPONSE_FORMAT
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

/** 连接探针超时（远短于生图 240s——探针只验证可达 + 鉴权，不等待生成） */
export const IMAGE_GEN_PROBE_TIMEOUT_MS = 15_000

export type ImageGenProbeResult = { ok: true; modelCount?: number } | { ok: false; error: string }

/**
 * T66 P2：连接测试探针——GET {baseUrl}/models 带 Bearer（OpenAI 兼容端
 * 惯例：官方 API、中转代理、vLLM/Ollama 等兼容端均实现该列表端点，是
 * 最小代价的「端点可达 + key 有效」验证；不选小尺寸生成——会产生计费
 * 且耗时高出两个数量级）。错误文案取自响应体但绝不回显 key。
 */
export async function probeImageGenEndpoint(options: {
  baseUrl: string
  apiKey: string
  /** 测试注入点；缺省用全局 fetch */
  fetchImpl?: FetchLike
  timeoutMs?: number
}): Promise<ImageGenProbeResult> {
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? IMAGE_GEN_PROBE_TIMEOUT_MS
  const baseURL = options.baseUrl.trim().replace(/\/$/, '')
  if (!baseURL) return { ok: false, error: 'Base URL 不能为空' }
  if (!options.apiKey) return { ok: false, error: 'Image-gen API key not configured' }
  let response: Response
  try {
    response = await fetchImpl(`${baseURL}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs)
    })
  } catch (error) {
    return {
      ok: false,
      error: `端点不可达：${error instanceof Error ? error.message : String(error)}`
    }
  }
  if (!response.ok) {
    return { ok: false, error: await apiErrorMessage(response) }
  }
  const body = (await response.json().catch(() => null)) as ModelsListResponseBody | null
  const modelCount = Array.isArray(body?.data) ? body.data.length : undefined
  return { ok: true, ...(modelCount !== undefined ? { modelCount } : {}) }
}
