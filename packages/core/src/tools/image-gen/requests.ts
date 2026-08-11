import { parseJSONArrayParam } from '#core/tools/json-array'

import type { ImageGenReference, ImageGenRequest } from './providers'

const SIZE_MULTIPLE = 16
const MAX_EDGE = 3840
const MAX_ASPECT_RATIO = 3
const MIN_PIXELS = 655_360
const MAX_PIXELS = 8_294_400

function roundToMultiple(value: number, multiple: number) {
  return Math.max(multiple, Math.round(value / multiple) * multiple)
}

function floorToMultiple(value: number, multiple: number) {
  return Math.max(multiple, Math.floor(value / multiple) * multiple)
}

function ceilToMultiple(value: number, multiple: number) {
  return Math.max(multiple, Math.ceil(value / multiple) * multiple)
}

/**
 * Ported from gpt_image_playground/src/lib/size.ts — preserves the requested
 * aspect ratio and only clips to platform constraints. The loop converges
 * because constraints can conflict (e.g. ratio clipping can drop below the
 * pixel floor, which then re-triggers the ratio constraint).
 */
export function normalizeDimensions(width: number, height: number) {
  let normalizedWidth = roundToMultiple(width, SIZE_MULTIPLE)
  let normalizedHeight = roundToMultiple(height, SIZE_MULTIPLE)

  const scaleToFit = (scale: number) => {
    normalizedWidth = floorToMultiple(normalizedWidth * scale, SIZE_MULTIPLE)
    normalizedHeight = floorToMultiple(normalizedHeight * scale, SIZE_MULTIPLE)
  }

  const scaleToFill = (scale: number) => {
    normalizedWidth = ceilToMultiple(normalizedWidth * scale, SIZE_MULTIPLE)
    normalizedHeight = ceilToMultiple(normalizedHeight * scale, SIZE_MULTIPLE)
  }

  for (let i = 0; i < 4; i++) {
    const maxEdge = Math.max(normalizedWidth, normalizedHeight)
    if (maxEdge > MAX_EDGE) {
      scaleToFit(MAX_EDGE / maxEdge)
    }

    if (normalizedWidth / normalizedHeight > MAX_ASPECT_RATIO) {
      normalizedWidth = floorToMultiple(normalizedHeight * MAX_ASPECT_RATIO, SIZE_MULTIPLE)
    } else if (normalizedHeight / normalizedWidth > MAX_ASPECT_RATIO) {
      normalizedHeight = floorToMultiple(normalizedWidth * MAX_ASPECT_RATIO, SIZE_MULTIPLE)
    }

    const pixels = normalizedWidth * normalizedHeight
    if (pixels > MAX_PIXELS) {
      scaleToFit(Math.sqrt(MAX_PIXELS / pixels))
    } else if (pixels < MIN_PIXELS) {
      scaleToFill(Math.sqrt(MIN_PIXELS / pixels))
    }
  }

  return { width: normalizedWidth, height: normalizedHeight }
}

interface NormalizedSize {
  width: number
  height: number
  adjusted: boolean
}

export function normalizeSize(width: number, height: number): NormalizedSize | { error: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { error: `Invalid size ${width}x${height}` }
  }
  const normalized = normalizeDimensions(width, height)
  const adjusted =
    normalized.width !== Math.round(width) || normalized.height !== Math.round(height)
  return { width: normalized.width, height: normalized.height, adjusted }
}

export interface ParsedImageGenRequests {
  requests: ImageGenRequest[]
  sizeNote?: string
  warning?: string
}

function parseReferences(value: unknown): ImageGenReference[] | { error: string } {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return { error: '"references" must be an array of node ids' }
  interface RawReference {
    id?: unknown
    asImage?: unknown
  }
  const out: ImageGenReference[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.trim().length > 0) {
      out.push({ id: item })
      continue
    }
    if (item && typeof item === 'object') {
      const raw = item as RawReference
      if (typeof raw.id === 'string' && raw.id.trim().length > 0) {
        out.push({ id: raw.id, asImage: raw.asImage === true ? true : undefined })
        continue
      }
    }
    return { error: 'Each reference must be a node id string or { "id": "...", "asImage"?: true }' }
  }
  return out
}

export function parseImageGenRequests(value: unknown): ParsedImageGenRequests | { error: string } {
  const parsed = parseJSONArrayParam(value, 'requests')
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
    references?: unknown
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
    // Requests with an id may omit width/height — apply.ts reads them from the
    // target node, and the provider falls back to size "auto".
    const rawId = typeof raw.id === 'string' ? raw.id : undefined
    const hasTarget = !!rawId && rawId.trim().length > 0
    const hasDims = Number.isFinite(width) && Number.isFinite(height)

    let outWidth: number | undefined
    let outHeight: number | undefined
    if (hasDims) {
      const normalized = normalizeSize(width, height)
      if ('error' in normalized) return { error: normalized.error }
      outWidth = normalized.width
      outHeight = normalized.height
      if (normalized.adjusted) {
        sizeNotes.push(`${width}x${height} → ${normalized.width}x${normalized.height}`)
      }
    } else if (!hasTarget) {
      return { error: 'New images need numeric "width" and "height"' }
    }

    const references = parseReferences(raw.references)
    if ('error' in references) return references

    out.push({
      id: hasTarget ? rawId : undefined,
      prompt,
      width: outWidth,
      height: outHeight,
      quality: raw.quality as ImageGenRequest['quality'],
      outputFormat: raw.output_format as ImageGenRequest['outputFormat'],
      outputCompression:
        typeof raw.output_compression === 'number' ? raw.output_compression : undefined,
      background: raw.background as ImageGenRequest['background'],
      references: references.length > 0 ? references : undefined
    })
  }

  const result: { requests: ImageGenRequest[]; sizeNote?: string; warning?: string } = {
    requests: out
  }
  if (sizeNotes.length > 0) {
    result.sizeNote = `Adjusted to API constraints (16px alignment, edge/ratio/pixel limits): ${sizeNotes.join(', ')}`
  }
  if (parsed.warning) result.warning = parsed.warning
  return result
}
