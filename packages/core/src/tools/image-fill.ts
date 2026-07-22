import type { Fill } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'

/** Upload image bytes and build an IMAGE fill (FILL scale mode) for them */
export function createImageFill(figma: FigmaAPI, bytes: Uint8Array): Fill {
  const image = figma.createImage(bytes)
  return {
    type: 'IMAGE',
    color: { r: 1, g: 1, b: 1, a: 1 },
    imageHash: image.hash,
    imageScaleMode: 'FILL',
    visible: true,
    opacity: 1
  }
}
