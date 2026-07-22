import { ofetch } from 'ofetch'

export type ImageGenQuality = 'low' | 'medium' | 'high' | 'auto'
export type ImageGenFormat = 'png' | 'jpeg' | 'webp'
export type ImageGenBackground = 'auto' | 'opaque'

export interface ImageGenRequest {
  id?: string
  prompt: string
  /** Required for new images; for edits it is read from the target node when omitted. */
  width?: number
  height?: number
  quality?: ImageGenQuality
  outputFormat?: ImageGenFormat
  /** JPEG/WebP compression 0-100; only sent when output_format is jpeg/webp. */
  outputCompression?: number
  background?: ImageGenBackground
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
   * @param baseImage present when editing an existing canvas image; send as the
   *                  multipart `image` field to the edits endpoint
   */
  generate(req: ImageGenRequest, baseImage?: Uint8Array): Promise<ImageGenResult>
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

export function setImageGenCredentials(key: string | null, baseURL?: string, model?: string): void {
  if (key) {
    imageGenKey = key
    if (baseURL) imageGenBaseURL = baseURL.replace(/\/$/, '')
    if (model) imageGenModelName = model
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

const dmxImageProvider: ImageGenProvider = {
  name: 'dmx-gpt-image-2',
  async generate(req, baseImage) {
    if (!imageGenKey) throw new Error('Image-gen API key not configured')
    const hasDims =
      req.width != null &&
      req.height != null &&
      Number.isFinite(req.width) &&
      Number.isFinite(req.height)
    const size = hasDims ? `${req.width}x${req.height}` : 'auto'
    const resultWidth = hasDims ? (req.width as number) : 1024
    const resultHeight = hasDims ? (req.height as number) : 1024

    if (baseImage) {
      const form = new FormData()
      form.append('model', imageGenModelName)
      form.append('prompt', req.prompt)
      form.append('size', size)
      form.append('n', '1')
      form.append('quality', req.quality ?? 'auto')
      form.append('output_format', req.outputFormat ?? 'png')
      form.append('background', req.background ?? 'auto')
      form.append('image', new Blob([baseImage.slice().buffer], { type: 'image/png' }), 'input.png')

      const response = await ofetch.raw<ImageApiResponse>(`${imageGenBaseURL}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${imageGenKey}` },
        body: form,
        retry: 0
      })
      if (!response.ok) throw new Error(`Image edit API ${response.status}`)
      const bytes = await extractImageBytes(response._data as ImageApiResponse)
      return { bytes, width: resultWidth, height: resultHeight }
    }

    const body: Record<string, unknown> = {
      model: imageGenModelName,
      prompt: req.prompt,
      size,
      n: 1,
      quality: req.quality ?? 'auto',
      output_format: req.outputFormat ?? 'png'
    }
    if (
      (req.outputFormat === 'jpeg' || req.outputFormat === 'webp') &&
      req.outputCompression != null
    ) {
      body.output_compression = req.outputCompression
    }

    const response = await ofetch.raw<ImageApiResponse>(`${imageGenBaseURL}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${imageGenKey}`,
        'Content-Type': 'application/json'
      },
      body,
      retry: 0
    })
    if (!response.ok) throw new Error(`Image gen API ${response.status}`)
    const bytes = await extractImageBytes(response._data as ImageApiResponse)
    return { bytes, width: resultWidth, height: resultHeight }
  }
}
