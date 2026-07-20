import type { FigmaAPI } from '#core/figma-api'

import type { ImageGenProvider, ImageGenRequest } from './providers'

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
  } else if (req.id) {
    // Editing: inherit the target node's real dimensions for the API size.
    req.width = Math.round(target.width)
    req.height = Math.round(target.height)
  }

  const gen = await provider.generate(req, baseImage)

  const image = figma.createImage(gen.bytes)
  target.fills = [
    {
      type: 'IMAGE',
      color: { r: 1, g: 1, b: 1, a: 1 },
      imageHash: image.hash,
      imageScaleMode: 'FILL',
      visible: true,
      opacity: 1
    }
  ]

  return { id: target.id, width: gen.width, height: gen.height, provider: provider.name }
}
