/**
 * T54→T66：OpenAI 兼容 provider mock fetch 钉请求形状（验收锚 T54-plan §3.1，
 * D34 凭证链 mock 进 CI；T66 P1 去 DMX 命名/P3 response_format）。
 * T71：连接探针移除（owner 裁决 2026-09-01：并非所有 provider 实现 /models）。
 * 请求形状以移植源 providers.ts 为据（OpenAI 兼容 /images/generations +
 * /images/edits），fixture 用通用 example.com 端点——本实现与任何特定
 * 中转商无关；SP-a1 探针钉的是 pi-ai openrouter-images 扩展槽契约
 * （本任务不实现，见 T54 报告偏差节）。
 */
import { describe, expect, test } from 'bun:test'

import {
  createImageGenProvider,
  IMAGE_GEN_DEFAULT_TIMEOUT_MS,
  imageGenTimeoutMs
} from '@/app/ai/pi-backend/image-gen/provider'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

const CREDENTIALS = {
  providerType: 'openai-compatible' as const,
  baseUrl: 'https://api.example.com/v1',
  model: 'gpt-image-1',
  apiKey: 'sk-test-image-key'
}

interface CapturedCall {
  url: string
  method?: string
  headers: HeadersInit | undefined
  body: BodyInit | null | undefined
  signal: AbortSignal | null | undefined
}

function mockFetch(payload: unknown, status = 200) {
  const calls: CapturedCall[] = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: init?.headers,
      body: init?.body ?? null,
      signal: init?.signal ?? null
    })
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return new Response(body, {
      status,
      headers: { 'content-type': typeof payload === 'string' ? 'text/plain' : 'application/json' }
    })
  }
  return { calls, fetchImpl: fetchImpl as typeof fetch }
}

const B64_RESPONSE = { data: [{ b64_json: Buffer.from(PNG_BYTES).toString('base64') }] }

/** OpenAI 兼容 /images/generations 请求体（钉扎用命名类型） */
interface GenerationsRequestBody {
  model?: string
  prompt?: string
  size?: string
  n?: number
  quality?: string
  output_format?: string
  output_compression?: number
  background?: string
  moderation?: string
  response_format?: string
}

describe('provider 请求形状', () => {
  test('文生图：POST /images/generations JSON（契约字段全集 + 显式 response_format）', async () => {
    const { calls, fetchImpl } = mockFetch(B64_RESPONSE)
    const provider = createImageGenProvider({ credentials: CREDENTIALS, fetchImpl })
    const result = await provider.generate({
      prompt: 'hero shot',
      width: 1024,
      height: 1024,
      quality: 'high',
      outputFormat: 'png',
      background: 'opaque'
    })

    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call.url).toBe('https://api.example.com/v1/images/generations')
    expect(call.method).toBe('POST')
    const headers = new Headers(call.headers)
    expect(headers.get('authorization')).toBe('Bearer sk-test-image-key')
    expect(headers.get('content-type')).toBe('application/json')
    const body = JSON.parse(String(call.body)) as GenerationsRequestBody
    expect(body).toEqual({
      model: 'gpt-image-1',
      prompt: 'hero shot',
      size: '1024x1024',
      n: 1,
      quality: 'high',
      output_format: 'png',
      background: 'opaque',
      moderation: 'auto',
      response_format: 'url'
    })
    expect(call.signal).toBeInstanceOf(AbortSignal)
    expect([...result.bytes]).toEqual([...PNG_BYTES])
    expect(result.width).toBe(1024)
  })

  test('output_compression 仅 jpeg/webp 携带', async () => {
    const { calls, fetchImpl } = mockFetch(B64_RESPONSE)
    const provider = createImageGenProvider({ credentials: CREDENTIALS, fetchImpl })
    await provider.generate({
      prompt: 'a',
      width: 1024,
      height: 1024,
      outputFormat: 'jpeg',
      outputCompression: 80
    })
    let body = JSON.parse(String(calls[0].body)) as GenerationsRequestBody
    expect(body.output_compression).toBe(80)
    await provider.generate({ prompt: 'a', width: 1024, height: 1024, outputCompression: 80 })
    body = JSON.parse(String(calls[1].body)) as GenerationsRequestBody
    expect('output_compression' in body).toBe(false)
  })

  test('图生图：POST /images/edits multipart，image[] 字段带文件名 + 显式 response_format', async () => {
    const { calls, fetchImpl } = mockFetch(B64_RESPONSE)
    const provider = createImageGenProvider({ credentials: CREDENTIALS, fetchImpl })
    const refA = new Uint8Array([1, 1, 1])
    const refB = new Uint8Array([2, 2, 2])
    await provider.generate({ prompt: 'edit', width: 1024, height: 1024 }, [refA, refB])

    const call = calls[0]
    expect(call.url).toBe('https://api.example.com/v1/images/edits')
    expect(call.body).toBeInstanceOf(FormData)
    const form = call.body as FormData
    expect(form.get('model')).toBe('gpt-image-1')
    expect(form.get('prompt')).toBe('edit')
    expect(form.get('size')).toBe('1024x1024')
    expect(form.get('n')).toBe('1')
    expect(form.get('quality')).toBe('auto')
    expect(form.get('output_format')).toBe('png')
    expect(form.get('background')).toBe('auto')
    expect(form.get('moderation')).toBe('auto')
    expect(form.get('response_format')).toBe('url')
    const images = form.getAll('image[]')
    expect(images).toHaveLength(2)
    expect((images[0] as File).name).toBe('input-1.png')
    expect((images[1] as File).name).toBe('input-2.png')
    expect(new Uint8Array(await (images[0] as File).arrayBuffer())).toEqual(refA)
    // multipart 不手设 content-type（fetch 自动带 boundary）
    const headers = new Headers(call.headers)
    expect(headers.get('content-type')).toBeNull()
  })

  test('baseUrl 尾斜杠归一', async () => {
    const { calls, fetchImpl } = mockFetch(B64_RESPONSE)
    const provider = createImageGenProvider({
      credentials: { ...CREDENTIALS, baseUrl: 'https://api.example.com/v1/' },
      fetchImpl
    })
    await provider.generate({ prompt: 'a', width: 1024, height: 1024 })
    expect(calls[0].url).toBe('https://api.example.com/v1/images/generations')
  })

  test('响应 url 回退：二次 fetch 下载图像字节', async () => {
    const imageURL = 'https://cdn.example.com/out.png'
    const urls: string[] = []
    const downloadFetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      if (urls.length === 1) {
        return new Response(JSON.stringify({ data: [{ url: imageURL }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return new Response(PNG_BYTES, { status: 200 })
    }) as typeof fetch
    const provider = createImageGenProvider({
      credentials: CREDENTIALS,
      fetchImpl: downloadFetch
    })
    const result = await provider.generate({ prompt: 'a', width: 1024, height: 1024 })
    expect([...result.bytes]).toEqual([...PNG_BYTES])
    expect(urls).toEqual(['https://api.example.com/v1/images/generations', imageURL])
  })

  test('非 2xx：错误文案取响应体 error.message（401 凭证错误可被工具层引导配置）', async () => {
    const { fetchImpl } = mockFetch({ error: { message: 'Invalid API key' } }, 401)
    const provider = createImageGenProvider({ credentials: CREDENTIALS, fetchImpl })
    await expect(provider.generate({ prompt: 'a', width: 1024, height: 1024 })).rejects.toThrow(
      'Invalid API key'
    )
  })

  test('无 key → 即抛未配置（不发 HTTP）', async () => {
    const { calls, fetchImpl } = mockFetch(B64_RESPONSE)
    const provider = createImageGenProvider({
      credentials: { ...CREDENTIALS, apiKey: '' },
      fetchImpl
    })
    await expect(provider.generate({ prompt: 'a' })).rejects.toThrow(
      'Image-gen API key not configured'
    )
    expect(calls).toHaveLength(0)
  })

  test('错误信息/请求不带 key 泄露路径（响应体不回显请求头）', async () => {
    const { fetchImpl } = mockFetch('Unauthorized', 401)
    const provider = createImageGenProvider({ credentials: CREDENTIALS, fetchImpl })
    const error = await provider
      .generate({ prompt: 'a', width: 1024, height: 1024 })
      .catch((err: unknown) => err)
    expect(error instanceof Error ? error.message : '').not.toContain(CREDENTIALS.apiKey)
  })
})

describe('生图 HTTP 超时（独立于桥超时，240s 基线）', () => {
  test('缺省 240s；env 覆盖生效；非法值回退缺省', () => {
    const saved = process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS
    try {
      delete process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS
      expect(imageGenTimeoutMs()).toBe(IMAGE_GEN_DEFAULT_TIMEOUT_MS)
      expect(IMAGE_GEN_DEFAULT_TIMEOUT_MS).toBe(240_000)
      process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS = '90000'
      expect(imageGenTimeoutMs()).toBe(90_000)
      process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS = 'not-a-number'
      expect(imageGenTimeoutMs()).toBe(IMAGE_GEN_DEFAULT_TIMEOUT_MS)
    } finally {
      if (saved === undefined) delete process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS
      else process.env.OPENPENCIL_IMAGE_GEN_TIMEOUT_MS = saved
    }
  })
})
