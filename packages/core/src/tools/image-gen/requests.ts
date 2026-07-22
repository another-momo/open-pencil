import { parseJsonArrayParam } from '#core/tools/json-array'

import type { ImageGenRequest } from './providers'

/**
 * gpt-image-2 only accepts this enumerated set of sizes. Any other value
 * (including arbitrary 16-multiples) returns HTTP 400.
 */
const ALLOWED_SIZES: ReadonlyArray<{ width: number; height: number; label: string }> = [
  { width: 1024, height: 1024, label: '1024x1024' },
  { width: 1536, height: 1024, label: '1536x1024' },
  { width: 1024, height: 1536, label: '1024x1536' },
  { width: 2048, height: 2048, label: '2048x2048' },
  { width: 2048, height: 1152, label: '2048x1152' },
  { width: 3840, height: 2160, label: '3840x2160' },
  { width: 2160, height: 3840, label: '2160x3840' }
]

interface NormalizedSize {
  width: number
  height: number
  label: string
  adjusted: boolean
}

/**
 * Map a requested size to the nearest allowed enumerated size. We score each
 * candidate by absolute area delta and aspect-ratio delta so a 1080x500 banner
 * lands on 2048x1152 (landscape 16:9) rather than a square.
 */
export function normalizeSize(
  width: number,
  height: number
): NormalizedSize | { error: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { error: `Invalid size ${width}x${height}` }
  }

  const reqArea = width * height
  const reqRatio = Math.max(width, height) / Math.min(width, height)

  let best = ALLOWED_SIZES[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of ALLOWED_SIZES) {
    const candArea = candidate.width * candidate.height
    const candRatio =
      Math.max(candidate.width, candidate.height) / Math.min(candidate.width, candidate.height)
    const areaScore = Math.abs(candArea - reqArea) / reqArea
    const ratioScore = Math.abs(candRatio - reqRatio) / reqRatio
    const score = areaScore + ratioScore
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }

  const adjusted = best.width !== Math.round(width) || best.height !== Math.round(height)
  return { width: best.width, height: best.height, label: best.label, adjusted }
}

export interface ParsedImageGenRequests {
  requests: ImageGenRequest[]
  sizeNote?: string
  warning?: string
}

export function parseImageGenRequests(value: unknown): ParsedImageGenRequests | { error: string } {
  const parsed = parseJsonArrayParam(value, 'requests')
  if ('error' in parsed) return parsed

  interface RawRequest {
    id?: unknown
    prompt?: unknown
    width?: unknown
    height?: unknown
    quality?: unknown
    output_format?: unknown
    output_compression?: unknown
    background?: unknown
  }

  const requests = parsed.items as RawRequest[]
  if (requests.length === 0) return { error: 'Empty requests array' }

  const sizeNotes: string[] = []
  const out: ImageGenRequest[] = []
  for (const raw of requests) {
    const prompt = raw.prompt
    const width = Number(raw.width)
    const height = Number(raw.height)
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return { error: 'Each request needs a non-empty "prompt"' }
    }
    // Edits (id present) may omit width/height — apply.ts reads them from the
    // target node, and the provider falls back to size "auto".
    const rawId = typeof raw.id === 'string' ? raw.id : undefined
    const isEdit = !!rawId && rawId.trim().length > 0
    const hasDims = Number.isFinite(width) && Number.isFinite(height)

    let outWidth: number | undefined
    let outHeight: number | undefined
    if (hasDims) {
      const normalized = normalizeSize(width, height)
      if ('error' in normalized) return { error: normalized.error }
      outWidth = normalized.width
      outHeight = normalized.height
      if (normalized.adjusted) {
        sizeNotes.push(`${width}x${height} → ${normalized.label}`)
      }
    } else if (!isEdit) {
      return { error: 'New images need numeric "width" and "height"' }
    }

    out.push({
      id: isEdit ? rawId : undefined,
      prompt,
      width: outWidth,
      height: outHeight,
      quality: raw.quality as ImageGenRequest['quality'],
      outputFormat: raw.output_format as ImageGenRequest['outputFormat'],
      outputCompression:
        typeof raw.output_compression === 'number' ? raw.output_compression : undefined,
      background: raw.background as ImageGenRequest['background']
    })
  }

  const result: { requests: ImageGenRequest[]; sizeNote?: string; warning?: string } = {
    requests: out
  }
  if (sizeNotes.length > 0) {
    result.sizeNote = `Mapped to allowed gpt-image-2 sizes: ${sizeNotes.join(', ')}`
  }
  if (parsed.warning) result.warning = parsed.warning
  return result
}
