import { FetchError, ofetch } from 'ofetch'

export type ImageGenQuality = 'low' | 'medium' | 'high' | 'auto'
export type ImageGenFormat = 'png' | 'jpeg' | 'webp'
export type ImageGenBackground = 'auto' | 'opaque'

export interface ImageGenReference {
  id: string
  /** Render the node via figma.exportImage instead of reading its IMAGE fill. */
  export?: boolean
}

export interface ImageGenRequest {
  id?: string
  prompt: string
  /** Required for new images; for targeted requests it is read from the target node when omitted. */
  width?: number
  height?: number
  quality?: ImageGenQuality
  outputFormat?: ImageGenFormat
  /** JPEG/WebP compression 0-100; only sent when output_format is jpeg/webp. */
  outputCompression?: number
  background?: ImageGenBackground
  /** The only source of input images; extracted by apply.ts before the call. */
  references?: ImageGenReference[]
}

export interface ImageGenResult {
  bytes: Uint8Array
  width: number
  height: number
}

export interface ImageGenProvider {
  name: string
  /**
   * @param req the generation/edit request
   * @param images input images extracted from `req.references`. Empty/absent →
   *               generations endpoint (text-to-image); non-empty → edits
   *               endpoint, sent as multipart `image[]` fields
   */
  generate(req: ImageGenRequest, images?: Uint8Array[]): Promise<ImageGenResult>
}

const providers = new Map<string, ImageGenProvider>()
let activeProviderId: string | null = null

export function registerImageGenProvider(provider: ImageGenProvider): void {
  providers.set(provider.name, provider)
  if (!activeProviderId) activeProviderId = provider.name
}

export function setActiveImageGenProvider(name: string | null): void {
  activeProviderId = name
}

export function getImageGenProviders(): string[] {
  return [...providers.keys()]
}

export function getActiveImageGenProvider(): ImageGenProvider | null {
  if (!activeProviderId) return null
  return providers.get(activeProviderId) ?? null
}

/** Independent from the chat LLM credentials. */
let imageGenKey: string | null = null
let imageGenBaseURL = 'https://www.dmxapi.cn/v1'
let imageGenModelName = 'gpt-image-2-ssvip'
let imageGenTimeoutMs = 120_000

export function setImageGenCredentials(
  key: string | null,
  baseURL?: string,
  model?: string,
  timeoutMs?: number
): void {
  if (key) {
    imageGenKey = key
    if (baseURL) imageGenBaseURL = baseURL.replace(/\/$/, '')
    if (model) imageGenModelName = model
    if (timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0) {
      imageGenTimeoutMs = timeoutMs
    }
    registerImageGenProvider(dmxImageProvider)
    setActiveImageGenProvider('dmx-gpt-image-2')
  }
}

interface ImageApiItem {
  b64_json?: string
  url?: string
}

interface ImageApiResponse {
  data?: ImageApiItem[]
}

async function extractImageBytes(data: ImageApiResponse): Promise<Uint8Array> {
  const item = data.data?.[0]
  if (!item) throw new Error('Image API returned no image data')
  if (item.b64_json) return Uint8Array.fromBase64(item.b64_json)
  if (item.url) {
    const response = await fetch(item.url)
    if (!response.ok) throw new Error(`Download generated image: ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }
  throw new Error('Image API response missing b64_json and url')
}

interface ApiErrorBody {
  error?: { message?: string } | string
  detail?: string
  message?: string
}

/**
 * ofetch throws FetchError on non-2xx — the API's real error message lives in
 * `err.data` (object or string), while `err.message` only has URL + status.
 */
function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof FetchError) {
    const data: unknown = err.data
    if (typeof data === 'string' && data.trim()) return data
    if (data && typeof data === 'object') {
      const body = data as ApiErrorBody
      if (body.error && typeof body.error === 'object') {
        const message = body.error.message
        if (typeof message === 'string' && message) return message
      }
      if (typeof body.detail === 'string' && body.detail) return body.detail
      if (typeof body.error === 'string' && body.error) return body.error
      if (typeof body.message === 'string' && body.message) return body.message
    }
    return err.message
  }
  return err instanceof Error ? err.message : fallback
}

const dmxImageProvider: ImageGenProvider = {
  name: 'dmx-gpt-image-2',
  async generate(req, images) {
    if (!imageGenKey) throw new Error('Image-gen API key not configured')
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
        if (target instanceof FormData) target.append('output_compression', String(req.outputCompression))
        else target.output_compression = req.outputCompression
      }
    }

    try {
      if (images && images.length > 0) {
        const form = new FormData()
        form.append('model', imageGenModelName)
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

        const response = await ofetch.raw<ImageApiResponse>(`${imageGenBaseURL}/images/edits`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${imageGenKey}` },
          body: form,
          retry: 0,
          timeout: imageGenTimeoutMs
        })
        const bytes = await extractImageBytes(response._data as ImageApiResponse)
        return { bytes, width: resultWidth, height: resultHeight }
      }

      const body: Record<string, unknown> = {
        model: imageGenModelName,
        prompt: req.prompt,
        size,
        n: 1,
        quality: req.quality ?? 'auto',
        output_format: req.outputFormat ?? 'png',
        background: req.background ?? 'auto',
        moderation: 'auto'
      }
      withCompression(body)

      const response = await ofetch.raw<ImageApiResponse>(
        `${imageGenBaseURL}/images/generations`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${imageGenKey}`,
            'Content-Type': 'application/json'
          },
          body,
          retry: 0,
          timeout: imageGenTimeoutMs
        }
      )
      const bytes = await extractImageBytes(response._data as ImageApiResponse)
      return { bytes, width: resultWidth, height: resultHeight }
    } catch (err) {
      throw new Error(apiErrorMessage(err, String(err)))
    }
  }
}
