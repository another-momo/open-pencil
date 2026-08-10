/**
 * Pure color math for sample-hero-color. CanvasKit-free so the averaging,
 * region math, and hex formatting can be unit tested without a renderer.
 */

export type SampleDirection = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface BandColor extends Rgb {
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
): { x: number; y: number; width: number; height: number } {
  const clamped = Math.max(1, Math.min(size, direction === 'left' || direction === 'right' ? imageWidth : imageHeight))
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
}

/**
 * Average the sRGB pixels of an arbitrary rectangular region. `pixels` is an
 * RGBA_8888 buffer for the full image; `x`/`y`/`width`/`height` describe the
 * region to average. Alpha is ignored (translucent pixels are not weighted —
 * they bleed underlying fills and would skew the average).
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

export function bandColorToHex(color: Rgb): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase()
}