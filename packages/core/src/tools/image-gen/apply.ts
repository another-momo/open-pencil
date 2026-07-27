import type { FigmaAPI } from '#core/figma-api'
import { createImageFill } from '#core/tools/image-fill'

import type { ImageGenProvider, ImageGenRequest } from './providers'
import { normalizeSize } from './requests'

export interface ImageGenExecuteResult {
  id: string
  width: number
  height: number
  provider: string
  error?: string
}

/**
 * Generate or edit an image and place it on the canvas.
 *
 * - No `id`: create a new FRAME sized to the request and fill it with the image.
 * - With `id`: target an existing node. If it already holds an IMAGE fill, its
 *   bytes are pulled from `graph.images` and sent to the edits endpoint (image
 *   editing). Otherwise the node receives a fresh IMAGE fill.
 */
export async function generateOne(
  figma: FigmaAPI,
  provider: ImageGenProvider,
  req: ImageGenRequest
): Promise<ImageGenExecuteResult> {
  let target = req.id ? figma.getNodeById(req.id) : null
  let baseImage: Uint8Array | undefined

  if (target && req.id) {
    const imgFill = target.fills.find((fill) => fill.type === 'IMAGE') as
      | { imageHash?: string }
      | undefined
    if (imgFill?.imageHash) {
      const bytes = figma.graph.images.get(imgFill.imageHash)
      if (bytes) baseImage = bytes
    }
  }

  if (!target) {
    target = figma.createFrame()
    target.resize(req.width ?? 1024, req.height ?? 1024)
    target.name = req.prompt.slice(0, 40) || 'Generated image'
  } else if (req.id && (req.width === undefined || req.height === undefined)) {
    // Editing/filling without an explicit size: inherit the target node's real
    // dimensions for the API size — mapped to the allowed enum, otherwise
    // gpt-image-2 returns 400. Explicit width/height always win.
    const normalized = normalizeSize(Math.round(target.width), Math.round(target.height))
    if (!('error' in normalized)) {
      req.width = normalized.width
      req.height = normalized.height
    }
  }

  const gen = await provider.generate(req, baseImage)

  target.fills = [createImageFill(figma, gen.bytes)]

  return { id: target.id, width: gen.width, height: gen.height, provider: provider.name }
}
