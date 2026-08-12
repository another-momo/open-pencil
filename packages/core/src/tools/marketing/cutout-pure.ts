/**
 * Pure pixel math for the cutout tool (green-screen / chroma-key pipeline).
 * CanvasKit-free so every step is unit-testable with synthetic buffers.
 *
 * Pipeline order (see docs/research/2026-08-11-design-technique-distillation-
 * map.md §12.5): corner-sampled chroma → per-pixel classify → despill →
 * erode → (grid) split → trim to content bounds.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface KeyResult {
  /** Per-pixel alpha (0 = background, 255 = keep), length w*h. */
  alpha: Uint8Array
  /** Pixels keyed out as background. */
  bgCount: number
}

/** Parse "#RRGGBB" into an Rgb. Returns null on malformed input. */
export function parseChromaHex(hex: string): Rgb | null {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16)
  }
}

/**
 * Sample the actual background color from the four corners (PATCH×PATCH
 * average each). AI image models never render the requested chroma exactly —
 * trusting the literal "#00FF00" instead of measuring it is the main source
 * of keying residue.
 */
export function sampleCornerColor(
  pixels: Uint8Array,
  width: number,
  height: number,
  patch = 8
): Rgb {
  const p = Math.max(1, Math.min(patch, Math.floor(width / 2), Math.floor(height / 2)))
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - p, 0],
    [0, height - p],
    [width - p, height - p]
  ]
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (const [cx, cy] of corners) {
    for (let y = cy; y < cy + p; y++) {
      for (let x = cx; x < cx + p; x++) {
        const i = (y * width + x) * 4
        r += pixels[i]
        g += pixels[i + 1]
        b += pixels[i + 2]
        n++
      }
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

/**
 * How much the four corner patches disagree — the uniformity signal for the
 * anti-silent WARNING. Returns the max per-channel spread between any corner
 * patch averages (0 = perfectly uniform).
 */
export function cornerSpread(pixels: Uint8Array, width: number, height: number, patch = 8): number {
  const p = Math.max(1, Math.min(patch, Math.floor(width / 2), Math.floor(height / 2)))
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - p, 0],
    [0, height - p],
    [width - p, height - p]
  ]
  const means = corners.map(([cx, cy]) => {
    let r = 0
    let g = 0
    let b = 0
    for (let y = cy; y < cy + p; y++) {
      for (let x = cx; x < cx + p; x++) {
        const i = (y * width + x) * 4
        r += pixels[i]
        g += pixels[i + 1]
        b += pixels[i + 2]
      }
    }
    const n = p * p
    return { r: r / n, g: g / n, b: b / n }
  })
  let spread = 0
  for (let a = 0; a < means.length; a++) {
    for (let bIdx = a + 1; bIdx < means.length; bIdx++) {
      for (const ch of ['r', 'g', 'b'] as const) {
        spread = Math.max(spread, Math.abs(means[a][ch] - means[bIdx][ch]))
      }
    }
  }
  return Math.round(spread)
}

/**
 * Classify pixels as background when their RGB distance to the chroma is
 * within `tolerance` (Euclidean on 0-255 channels; default tuned for the
 * slightly-uneven green a model actually renders).
 *
 * Prefer `floodBackground` for real sheets — global classification keys out
 * subject interiors that happen to match the chroma (a mint-green sticker
 * loses its middle). This stays exported for tests and diagnostics.
 */
export function keyOut(
  pixels: Uint8Array,
  width: number,
  height: number,
  chroma: Rgb,
  tolerance = 90
): KeyResult {
  const alpha = new Uint8Array(width * height)
  const tol2 = tolerance * tolerance
  let bgCount = 0
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const dr = pixels[o] - chroma.r
    const dg = pixels[o + 1] - chroma.g
    const db = pixels[o + 2] - chroma.b
    if (dr * dr + dg * dg + db * db <= tol2) {
      bgCount++
      alpha[i] = 0
    } else {
      alpha[i] = 255
    }
  }
  return { alpha, bgCount }
}

/**
 * Background removal by flood fill from the image border: only chroma-
 * colored pixels CONNECTED to the edge count as background. Chroma-colored
 * regions fully enclosed by the subject (a mint-green brush stroke's middle)
 * are preserved — global keying would eat them.
 *
 * Trade-off (documented): a region of TRAPPED background fully enclosed by
 * subject (a donut-hole showing the green screen through it) survives as
 * green. That is the rarer failure and is visible in look verification; the
 * tool reports the preserved-chroma pixel count so it isn't silent.
 */
export function floodBackground(
  pixels: Uint8Array,
  width: number,
  height: number,
  chroma: Rgb,
  tolerance = 90
): KeyResult {
  const tol2 = tolerance * tolerance
  const isBackgroundColored = (i: number): boolean => {
    const o = i * 4
    const dr = pixels[o] - chroma.r
    const dg = pixels[o + 1] - chroma.g
    const db = pixels[o + 2] - chroma.b
    return dr * dr + dg * dg + db * db <= tol2
  }
  const alpha = new Uint8Array(width * height).fill(255)
  const stack: number[] = []
  const seed = (i: number) => {
    if (alpha[i] === 255 && isBackgroundColored(i)) {
      alpha[i] = 0
      stack.push(i)
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (stack.length > 0) {
    const i = stack.pop()!
    const x = i % width
    const y = (i - x) / width
    if (x > 0) seed(i - 1)
    if (x < width - 1) seed(i + 1)
    if (y > 0) seed(i - width)
    if (y < height - 1) seed(i + width)
  }
  let bgCount = 0
  for (let i = 0; i < alpha.length; i++) if (alpha[i] === 0) bgCount++
  return { alpha, bgCount }
}

/** Chroma-colored pixels that survived flood filling (interior regions). */
export function preservedChromaCount(
  pixels: Uint8Array,
  alpha: Uint8Array,
  chroma: Rgb,
  tolerance = 90
): number {
  const tol2 = tolerance * tolerance
  let count = 0
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] === 0) continue
    const o = i * 4
    const dr = pixels[o] - chroma.r
    const dg = pixels[o + 1] - chroma.g
    const db = pixels[o + 2] - chroma.b
    if (dr * dr + dg * dg + db * db <= tol2) count++
  }
  return count
}

export interface Component {
  bounds: Rect
  area: number
}

/**
 * Connected-component labeling (4-connectivity) over the alpha matte. Each
 * blob becomes one asset — sheets whose elements drift out of their grid
 * cells are cut correctly regardless. Components smaller than `minArea` are
 * keying noise. Returned in reading order (top-to-bottom, left-to-right) so
 * sheet elements number naturally.
 */
export function labelComponents(
  alpha: Uint8Array,
  width: number,
  height: number,
  minArea = 256
): Component[] {
  const visited = new Uint8Array(width * height)
  const components: Component[] = []
  const stack: number[] = []
  for (let start = 0; start < alpha.length; start++) {
    if (alpha[start] === 0 || visited[start] !== 0) continue
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let area = 0
    visited[start] = 1
    stack.push(start)
    while (stack.length > 0) {
      const i = stack.pop()!
      const x = i % width
      const y = (i - x) / width
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && alpha[i - 1] !== 0 && visited[i - 1] === 0) {
        visited[i - 1] = 1
        stack.push(i - 1)
      }
      if (x < width - 1 && alpha[i + 1] !== 0 && visited[i + 1] === 0) {
        visited[i + 1] = 1
        stack.push(i + 1)
      }
      if (y > 0 && alpha[i - width] !== 0 && visited[i - width] === 0) {
        visited[i - width] = 1
        stack.push(i - width)
      }
      if (y < height - 1 && alpha[i + width] !== 0 && visited[i + width] === 0) {
        visited[i + width] = 1
        stack.push(i + width)
      }
    }
    if (area >= minArea && maxX >= 0) {
      components.push({
        bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
        area
      })
    }
  }
  components.sort((a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x)
  return components
}

/**
 * Suppress chroma spill on kept EDGE pixels: the dominant channel of the
 * chroma (G for green screens) is clamped to the max of the other two, so
 * green bounce light on subject edges disappears. Only pixels adjacent to
 * keyed background are touched — applying despill to the whole foreground
 * would corrupt preserved interior chroma (a mint core would go black).
 */
export function despill(
  pixels: Uint8Array,
  alpha: Uint8Array,
  width: number,
  height: number,
  chroma: Rgb
): void {
  const dominant: 0 | 1 | 2 =
    chroma.g >= chroma.r && chroma.g >= chroma.b ? 1 : chroma.r >= chroma.b ? 0 : 2
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] === 0) continue
    const x = i % width
    const y = (i - x) / width
    const touchesBackground =
      x === 0 ||
      y === 0 ||
      x === width - 1 ||
      y === height - 1 ||
      alpha[i - 1] === 0 ||
      alpha[i + 1] === 0 ||
      alpha[i - width] === 0 ||
      alpha[i + width] === 0
    if (!touchesBackground) continue
    const o = i * 4
    const other1 = pixels[o + ((dominant + 1) % 3)]
    const other2 = pixels[o + ((dominant + 2) % 3)]
    const cap = Math.max(other1, other2)
    if (pixels[o + dominant] > cap) pixels[o + dominant] = cap
  }
}

/**
 * Erode the alpha matte by 4-connectivity: a kept pixel with any transparent
 * orthogonal neighbor becomes transparent. One iteration removes the 1px
 * anti-aliased chroma fringe that survives classification.
 */
export function erodeAlpha(
  alpha: Uint8Array,
  width: number,
  height: number,
  iterations = 1
): Uint8Array {
  let current = alpha
  for (let it = 0; it < iterations; it++) {
    const next = new Uint8Array(current)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (current[i] === 0) continue
        if (
          x === 0 ||
          y === 0 ||
          x === width - 1 ||
          y === height - 1 ||
          current[i - 1] === 0 ||
          current[i + 1] === 0 ||
          current[i - width] === 0 ||
          current[i + width] === 0
        ) {
          next[i] = 0
        }
      }
    }
    current = next
  }
  return current
}

/** Bounding box of kept pixels, or null when nothing survived. */
export function contentBounds(alpha: Uint8Array, width: number, height: number): Rect | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] !== 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Share of transparent pixels INSIDE the content bounding box. A high value
 * means the subject itself matched the chroma (e.g. a green sticker on a
 * green screen) — the anti-silent hole warning keys off this.
 */
export function interiorHoleRatio(alpha: Uint8Array, width: number, bounds: Rect): number {
  let holes = 0
  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      if (alpha[y * width + x] === 0) holes++
    }
  }
  return holes / (bounds.width * bounds.height)
}

/** Parse a grid spec like "3x3" / "2x3" / "1x4" into {cols, rows}. */
export function parseGrid(spec: string): { cols: number; rows: number } | null {
  const m = /^([1-4])x([1-4])$/.exec(spec.trim().toLowerCase())
  if (!m) return null
  return { cols: Number.parseInt(m[1], 10), rows: Number.parseInt(m[2], 10) }
}

/** Cell rects of a cols×rows grid over an image of the given size. */
export function gridCells(width: number, height: number, cols: number, rows: number): Rect[] {
  const cells: Rect[] = []
  const cw = width / cols
  const ch = height / rows
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        x: Math.round(col * cw),
        y: Math.round(row * ch),
        width: Math.round((col + 1) * cw) - Math.round(col * cw),
        height: Math.round((row + 1) * ch) - Math.round(row * ch)
      })
    }
  }
  return cells
}

/** Extract a sub-region of a pixel buffer (and its matte) into new buffers. */
export function cropRegion(
  pixels: Uint8Array,
  alpha: Uint8Array,
  width: number,
  rect: Rect
): { pixels: Uint8Array; alpha: Uint8Array } {
  const outPx = new Uint8Array(rect.width * rect.height * 4)
  const outA = new Uint8Array(rect.width * rect.height)
  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const src = ((rect.y + y) * width + (rect.x + x)) * 4
      const dst = (y * rect.width + x) * 4
      outPx[dst] = pixels[src]
      outPx[dst + 1] = pixels[src + 1]
      outPx[dst + 2] = pixels[src + 2]
      outPx[dst + 3] = pixels[src + 3]
      outA[y * rect.width + x] = alpha[(rect.y + y) * width + (rect.x + x)]
    }
  }
  return { pixels: outPx, alpha: outA }
}

/** Write an alpha matte into a pixel buffer's alpha channel. */
export function applyAlpha(pixels: Uint8Array, alpha: Uint8Array): void {
  for (let i = 0; i < alpha.length; i++) {
    pixels[i * 4 + 3] = alpha[i]
  }
}
