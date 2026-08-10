/**
 * Pure color math for sample-hero-color. Kept CanvasKit-free so the averaging,
 * lightening, and hex-formatting can be unit tested without a renderer.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface BandColor extends Rgb {
  samples: number
}

/**
 * Average the sRGB pixels of a single horizontal band. `pixels` is an
 * RGBA_8888 buffer laid out row-major; alpha is ignored (we treat opaque and
 * translucent samples uniformly — translucent pixels of the hero bleed
 * underlying fills and would skew the average if weighted).
 */
export function averageBandColor(pixels: Uint8Array, width: number, height: number): BandColor {
  let r = 0
  let g = 0
  let b = 0
  let samples = 0
  const stride = width * 4
  for (let y = 0; y < height; y++) {
    const row = y * stride
    for (let x = 0; x < width; x++) {
      const i = row + x * 4
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

/**
 * Move a 0–255 channel toward white by `t` (0 = unchanged, 1 = pure white).
 * Long-image backdrops want a tinted, softer version of the hero color so it
 * sits behind white text without competing; this is the gentlest way.
 */
export function adjustChannel(value: number, t: number): number {
  if (t <= 0) return Math.round(value)
  if (t >= 1) return 255
  return Math.round(value + (255 - value) * t)
}

export function bandColorToHex(color: Rgb): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase()
}