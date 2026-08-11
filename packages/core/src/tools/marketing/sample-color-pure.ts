/**
 * Pure color math for sample-hero-color. CanvasKit-free so the averaging,
 * region math, and hex formatting can be unit tested without a renderer.
 */

import type { Rect } from '@open-pencil/scene-graph/primitives'

export type SampleDirection = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface RGB {
  r: number
  g: number
  b: number
}

export interface BandColor extends RGB {
  samples: number
}

/**
 * Slice a single band of an RGBA_8888 buffer. Returns the (offset, width, height)
 * of the band in pixel units — same coordinates the readPixels call would use.
 * Caller passes the full image buffer, this returns the region to average.
 *
 * `size` is the band thickness (rows for top/bottom/center, columns for
 * left/right). The band is always contiguous on the chosen edge.
 */
export function bandRegion(
  direction: SampleDirection,
  imageWidth: number,
  imageHeight: number,
  size: number
): Rect {
  const bandAxis = direction === 'left' || direction === 'right' ? imageWidth : imageHeight
  const clamped = Math.max(1, Math.min(size, bandAxis))
  switch (direction) {
    case 'top':
      return { x: 0, y: 0, width: imageWidth, height: clamped }
    case 'bottom':
      return { x: 0, y: imageHeight - clamped, width: imageWidth, height: clamped }
    case 'left':
      return { x: 0, y: 0, width: clamped, height: imageHeight }
    case 'right':
      return { x: imageWidth - clamped, y: 0, width: clamped, height: imageHeight }
    case 'center':
      if (imageHeight <= clamped) {
        return { x: 0, y: 0, width: imageWidth, height: imageHeight }
      }
      return {
        x: 0,
        y: Math.floor((imageHeight - clamped) / 2),
        width: imageWidth,
        height: clamped
      }
  }
  // Unreachable — SampleDirection is exhaustive — but consistent-return
  // requires a value on the implicit fall-through path.
  return { x: 0, y: 0, width: imageWidth, height: imageHeight }
}

/**
 * Average the sRGB pixels of an arbitrary rectangular region. `pixels` is an
 * RGBA_8888 buffer for the full image; `x`/`y`/`width`/`height` describe the
 * region to average. The alpha channel is ignored: a translucent pixel
 * contributes its raw (unpremultiplied) RGB like any other. For AI-generated
 * heroes — fully opaque — this is exact.
 */
export function averageRegion(
  pixels: Uint8Array,
  imageWidth: number,
  x: number,
  y: number,
  width: number,
  height: number
): BandColor {
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  const stride = imageWidth * 4
  for (let row = 0; row < height; row++) {
    const pixelY = y + row
    const rowStart = pixelY * stride + x * 4
    for (let col = 0; col < width; col++) {
      const i = rowStart + col * 4
      r += pixels[i]
      g += pixels[i + 1]
      b += pixels[i + 2]
      samples++
    }
  }
  if (samples === 0) return { r: 0, g: 0, b: 0, samples: 0 }
  return {
    r: Math.round(r / samples),
    g: Math.round(g / samples),
    b: Math.round(b / samples),
    samples
  }
}

export function bandColorToHex(color: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase()
}
