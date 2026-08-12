import { describe, expect, it } from 'bun:test'

import {
  applyAlpha,
  contentBounds,
  cornerSpread,
  cropRegion,
  despill,
  erodeAlpha,
  floodBackground,
  gridCells,
  interiorHoleRatio,
  keyOut,
  labelComponents,
  parseChromaHex,
  parseGrid,
  preservedChromaCount,
  sampleCornerColor
} from '#core/tools/marketing/cutout-pure'

/**
 * Unit tests for the chroma-key pure math. All buffers are synthetic
 * RGBA_8888 — no CanvasKit involved.
 */

const GREEN: [number, number, number] = [0, 255, 0]
const RED: [number, number, number] = [220, 40, 40]

function makePixels(width: number, height: number, fill: [number, number, number]): Uint8Array {
  const px = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = fill[0]
    px[i * 4 + 1] = fill[1]
    px[i * 4 + 2] = fill[2]
    px[i * 4 + 3] = 255
  }
  return px
}

function paintRect(
  px: Uint8Array,
  width: number,
  rect: { x: number; y: number; width: number; height: number },
  color: [number, number, number]
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * width + x) * 4
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
      px[i + 3] = 255
    }
  }
}

describe('cutout-pure / chroma parsing', () => {
  it('parses 6-digit hex and rejects malformed input', () => {
    expect(parseChromaHex('#00FF00')).toEqual({ r: 0, g: 255, b: 0 })
    expect(parseChromaHex('ff00ff')).toEqual({ r: 255, g: 0, b: 255 })
    expect(parseChromaHex('#00FF')).toBeNull()
    expect(parseChromaHex('green')).toBeNull()
    expect(parseChromaHex('#00FF0000')).toBeNull()
  })
})

describe('cutout-pure / corner sampling', () => {
  it('returns the fill color for a uniform image', () => {
    const px = makePixels(32, 32, GREEN)
    expect(sampleCornerColor(px, 32, 32)).toEqual({ r: 0, g: 255, b: 0 })
    expect(cornerSpread(px, 32, 32)).toBe(0)
  })

  it('averages over four corners and reports spread for uneven backgrounds', () => {
    const px = makePixels(32, 32, GREEN)
    // One corner drifts toward dark green (a vignette the model added).
    paintRect(px, 32, { x: 24, y: 24, width: 8, height: 8 }, [0, 200, 0])
    const sampled = sampleCornerColor(px, 32, 32)
    expect(sampled.g).toBeGreaterThan(200)
    expect(sampled.g).toBeLessThan(255)
    expect(cornerSpread(px, 32, 32)).toBe(55)
  })
})

describe('cutout-pure / keyOut', () => {
  it('keys out pixels within tolerance and keeps the subject', () => {
    const px = makePixels(8, 8, GREEN)
    paintRect(px, 8, { x: 2, y: 2, width: 4, height: 4 }, RED)
    const { alpha, bgCount } = keyOut(px, 8, 8, { r: 0, g: 255, b: 0 }, 90)
    expect(bgCount).toBe(64 - 16)
    expect(alpha[2 * 8 + 2]).toBe(255)
    expect(alpha[0]).toBe(0)
  })

  it('respects tolerance around the measured (imperfect) model green', () => {
    const px = makePixels(4, 4, [10, 240, 10]) // model-rendered "green", not #00FF00
    const tight = keyOut(px, 4, 4, { r: 0, g: 255, b: 0 }, 10)
    expect(tight.bgCount).toBe(0)
    const loose = keyOut(px, 4, 4, { r: 0, g: 255, b: 0 }, 30)
    expect(loose.bgCount).toBe(16)
  })
})

describe('cutout-pure / floodBackground', () => {
  it('removes border-connected background but preserves subject-interior chroma', () => {
    // Green bg; red 10×10 subject with a pure-green 4×4 core (the mint-stroke
    // case): global keying would eat the core, flood fill keeps it.
    const px = makePixels(16, 16, GREEN)
    paintRect(px, 16, { x: 3, y: 3, width: 10, height: 10 }, RED)
    paintRect(px, 16, { x: 6, y: 6, width: 4, height: 4 }, GREEN)
    const { alpha, bgCount } = floodBackground(px, 16, 16, { r: 0, g: 255, b: 0 }, 90)
    expect(alpha[6 * 16 + 6]).toBe(255) // green core survives
    expect(alpha[0]).toBe(0) // outer background removed
    expect(bgCount).toBe(16 * 16 - 100) // everything except the 10×10 block
  })

  it('counts preserved chroma pixels (trapped-background visibility)', () => {
    const px = makePixels(16, 16, GREEN)
    paintRect(px, 16, { x: 3, y: 3, width: 10, height: 10 }, RED)
    paintRect(px, 16, { x: 6, y: 6, width: 4, height: 4 }, GREEN)
    const { alpha } = floodBackground(px, 16, 16, { r: 0, g: 255, b: 0 }, 90)
    expect(preservedChromaCount(px, alpha, { r: 0, g: 255, b: 0 }, 90)).toBe(16)
  })
})

describe('cutout-pure / labelComponents', () => {
  it('finds separate blobs in reading order and skips noise below minArea', () => {
    const alpha = new Uint8Array(24 * 24)
    const paint = (x: number, y: number, w: number, h: number) => {
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) alpha[yy * 24 + xx] = 255
    }
    paint(12, 4, 8, 8) // top-right blob (area 64)
    paint(2, 14, 8, 8) // bottom-left blob
    alpha[2 * 24 + 2] = 255 // 1px noise
    const comps = labelComponents(alpha, 24, 24, 16)
    expect(comps.length).toBe(2)
    expect(comps[0].bounds).toEqual({ x: 12, y: 4, width: 8, height: 8 })
    expect(comps[1].bounds).toEqual({ x: 2, y: 14, width: 8, height: 8 })
    expect(comps[0].area).toBe(64)
  })

  it('keeps an element that spans grid cells as ONE component', () => {
    const alpha = new Uint8Array(24 * 24)
    for (let y = 4; y < 12; y++) for (let x = 4; x < 20; x++) alpha[y * 24 + x] = 255
    const comps = labelComponents(alpha, 24, 24, 16)
    expect(comps.length).toBe(1)
    expect(comps[0].bounds).toEqual({ x: 4, y: 4, width: 16, height: 8 })
  })
})

describe('cutout-pure / despill', () => {
  it('clamps green spill on kept EDGE pixels to the max of the other channels', () => {
    const px = makePixels(2, 1, [120, 200, 110]) // greenish edge fringe
    const alpha = new Uint8Array([255, 255])
    despill(px, alpha, 2, 1, { r: 0, g: 255, b: 0 })
    expect(px[1]).toBe(120) // g clamped to max(r, b) = 120
    expect(px[4 + 1]).toBe(120)
  })

  it('leaves non-spilled pixels and keyed-out pixels untouched', () => {
    const px = makePixels(2, 1, [220, 40, 40]) // red subject, g below cap
    const alpha = new Uint8Array([255, 0])
    despill(px, alpha, 2, 1, { r: 0, g: 255, b: 0 })
    expect(px[1]).toBe(40)
    expect(px[4 + 1]).toBe(40) // keyed-out pixel untouched
  })

  it('never touches deep-foreground pixels (interior chroma must survive intact)', () => {
    // 3×3 all-foreground; the center pixel is fully enclosed by kept pixels,
    // so despill must not clamp its (deliberately green) channel.
    const px = makePixels(3, 3, [220, 40, 40])
    paintRect(px, 3, { x: 1, y: 1, width: 1, height: 1 }, [20, 220, 30])
    const alpha = new Uint8Array(9).fill(255)
    despill(px, alpha, 3, 3, { r: 0, g: 255, b: 0 })
    expect(px[(1 * 3 + 1) * 4 + 1]).toBe(220) // interior green survives despill
  })
})

describe('cutout-pure / erode', () => {
  it('removes the 1px fringe around a solid block', () => {
    const alpha = new Uint8Array(7 * 7)
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) alpha[y * 7 + x] = 255
    const eroded = erodeAlpha(alpha, 7, 7, 1)
    expect(eroded[3 * 7 + 3]).toBe(255)
    expect(eroded[2 * 7 + 2]).toBe(0)
    expect(eroded[2 * 7 + 3]).toBe(0)
  })

  it('zero iterations is a no-op', () => {
    const alpha = new Uint8Array([0, 255, 0])
    expect(Array.from(erodeAlpha(alpha, 3, 1, 0))).toEqual([0, 255, 0])
  })
})

describe('cutout-pure / content bounds & holes', () => {
  it('returns the tight bounding box of kept pixels', () => {
    const alpha = new Uint8Array(8 * 8)
    for (let y = 3; y < 6; y++) for (let x = 1; x < 5; x++) alpha[y * 8 + x] = 255
    expect(contentBounds(alpha, 8, 8)).toEqual({ x: 1, y: 3, width: 4, height: 3 })
  })

  it('returns null when nothing survives', () => {
    expect(contentBounds(new Uint8Array(16), 4, 4)).toBeNull()
  })

  it('measures interior holes (subject contains the chroma color)', () => {
    const alpha = new Uint8Array(4 * 4).fill(255)
    alpha[1 * 4 + 1] = 0 // one hole inside the 4×4 content
    const bounds = contentBounds(alpha, 4, 4)!
    expect(bounds).toEqual({ x: 0, y: 0, width: 4, height: 4 })
    expect(interiorHoleRatio(alpha, 4, bounds)).toBeCloseTo(1 / 16, 5)
  })
})

describe('cutout-pure / grid', () => {
  it('parses grid specs and rejects malformed ones', () => {
    expect(parseGrid('3x3')).toEqual({ cols: 3, rows: 3 })
    expect(parseGrid('1x4')).toEqual({ cols: 1, rows: 4 })
    expect(parseGrid('0x3')).toBeNull()
    expect(parseGrid('5x5')).toBeNull()
    expect(parseGrid('abc')).toBeNull()
  })

  it('splits a 100×60 image into a 2×2 grid of exact cells', () => {
    const cells = gridCells(100, 60, 2, 2)
    expect(cells).toEqual([
      { x: 0, y: 0, width: 50, height: 30 },
      { x: 50, y: 0, width: 50, height: 30 },
      { x: 0, y: 30, width: 50, height: 30 },
      { x: 50, y: 30, width: 50, height: 30 }
    ])
  })
})

describe('cutout-pure / crop + applyAlpha', () => {
  it('crops a sub-region and writes the matte into the alpha channel', () => {
    const px = makePixels(4, 4, RED)
    paintRect(px, 4, { x: 1, y: 1, width: 2, height: 2 }, GREEN)
    const alpha = new Uint8Array(16).fill(255)
    alpha[1 * 4 + 1] = 0
    const { pixels: outPx, alpha: outA } = cropRegion(px, alpha, 4, {
      x: 1,
      y: 1,
      width: 2,
      height: 2
    })
    expect(outPx.length).toBe(2 * 2 * 4)
    expect([outPx[0], outPx[1], outPx[2]]).toEqual(GREEN)
    applyAlpha(outPx, outA)
    expect(outPx[3]).toBe(0) // holed pixel became transparent
    expect(outPx[1 * 4 + 3]).toBe(255) // second pixel kept
  })
})
