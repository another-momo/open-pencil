import type { FigmaAPI } from '#core/figma-api'
import { createImageFill } from '#core/tools/image-fill'

import type { ImageGenProvider, ImageGenReference, ImageGenRequest } from './providers'
import { normalizeSize } from './requests'

export interface ImageGenExecuteResult {
  id: string
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  provider: string
  note?: string
  error?: string
}

const IMAGE_MARKER_RE = /\[image\s+\d+\]/i

async function extractNodeImage(figma: FigmaAPI, nodeId: string): Promise<Uint8Array | null> {
  const node = figma.getNodeById(nodeId)
  if (!node) return null
  const imgFill = node.fills.find((fill) => fill.type === 'IMAGE') as
    | { imageHash?: string }
    | undefined
  if (!imgFill?.imageHash) return null
  return figma.graph.images.get(imgFill.imageHash) ?? null
}

async function extractReferenceImage(
  figma: FigmaAPI,
  ref: ImageGenReference
): Promise<Uint8Array | null> {
  if (ref.export) {
    if (!figma.exportImage) return null
    return figma.exportImage([ref.id], { scale: 1, format: 'PNG' })
  }
  return extractNodeImage(figma, ref.id)
}

/**
 * Generate an image and place it on the canvas.
 *
 * `references` is the ONLY source of input images — the target node (`id`) is
 * just the output destination and never contributes its pixels implicitly:
 * - No `id`: create a new FRAME sized to the request and fill it.
 * - With `id`: overwrite that node's fill (leaf shape or frame background).
 * - To EDIT an existing image, the agent includes the target's own id in
 *   `references`; to REGENERATE without the current image, it leaves it out.
 */
export async function generateOne(
  figma: FigmaAPI,
  provider: ImageGenProvider,
  req: ImageGenRequest
): Promise<ImageGenExecuteResult> {
  let target = req.id ? figma.getNodeById(req.id) : null

  const references = req.references ?? []
  const images: Uint8Array[] = []
  const skipped: string[] = []
  for (const ref of references) {
    const bytes = await extractReferenceImage(figma, ref)
    if (bytes) images.push(bytes)
    else skipped.push(ref.id)
  }

  if (references.length > 0) {
    // A prompt with [image N] markers misaligns silently when any image drops
    // out — fail loudly instead of letting the model edit the wrong image.
    if (skipped.length > 0 && IMAGE_MARKER_RE.test(req.prompt)) {
      throw new Error(
        `Failed to extract reference image(s): ${skipped.join(', ')} — the prompt contains [image N] markers that would misalign; fix the references and retry`
      )
    }
    if (images.length === 0) {
      throw new Error(`Failed to extract all reference image(s): ${skipped.join(', ')}`)
    }
  }
  const note =
    skipped.length > 0
      ? `Used ${images.length}/${references.length} reference image(s); skipped: ${skipped.join(', ')}`
      : undefined

  if (!target) {
    target = figma.createFrame()
    target.resize(req.width ?? 1024, req.height ?? 1024)
    target.name = req.prompt.slice(0, 40) || 'Generated image'
  } else if (req.id && (req.width === undefined || req.height === undefined)) {
    // Targeted request without an explicit size: inherit the target node's
    // real dimensions for the API size (16px-aligned + constraint-clipped).
    // Explicit width/height always win.
    const normalized = normalizeSize(Math.round(target.width), Math.round(target.height))
    if (!('error' in normalized)) {
      req.width = normalized.width
      req.height = normalized.height
    }
  }

  const gen = await provider.generate(req, images.length > 0 ? images : undefined)

  target.fills = [createImageFill(figma, gen.bytes)]

  return {
    id: target.id,
    width: gen.width,
    height: gen.height,
    canvasWidth: Math.round(target.width),
    canvasHeight: Math.round(target.height),
    provider: provider.name,
    ...(note ? { note } : {})
  }
}
