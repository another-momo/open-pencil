import { describe, expect, it } from 'bun:test'

import {
  averageRegion,
  bandColorToHex,
  bandRegion
} from '#core/tools/marketing/sample-color-pure'

/**
 * Pure color math for sample-hero-color. CanvasKit-free so the gradient
 * recipe in the prompt actually receives a sensible hex when the agent
 * drops in the tool's result.
 */
describe('sample-hero-color / pure math', () => {
  describe('bandRegion', () => {
    it('returns the bottom strip by default', () => {
      const r = bandRegion('bottom', 200, 500, 100)
      expect(r).toEqual({ x: 0, y: 400, width: 200, height: 100 })
    })

    it('returns the top strip', () => {
      const r = bandRegion('top', 200, 500, 100)
      expect(r).toEqual({ x: 0, y: 0, width: 200, height: 100 })
    })

    it('returns the right strip in column units', () => {
      const r = bandRegion('right', 200, 500, 40)
      expect(r).toEqual({ x: 160, y: 0, width: 40, height: 500 })
    })

    it('returns the left strip in column units', () => {
      const r = bandRegion('left', 200, 500, 40)
      expect(r).toEqual({ x: 0, y: 0, width: 40, height: 500 })
    })

    it('centers the band when direction is center', () => {
      const r = bandRegion('center', 200, 500, 100)
      // (500 - 100) / 2 = 200
      expect(r).toEqual({ x: 0, y: 200, width: 200, height: 100 })
    })

    it('returns the full image when center band exceeds the image height', () => {
      const r = bandRegion('center', 200, 100, 200)
      expect(r).toEqual({ x: 0, y: 0, width: 200, height: 100 })
    })

    it('clamps size to the image edge when it would exceed the band axis', () => {
      expect(bandRegion('bottom', 200, 500, 10000).height).toBe(500)
      expect(bandRegion('right', 200, 500, 10000).width).toBe(200)
    })
  })

  describe('averageRegion', () => {
    it('averages an RGBA_8888 band of solid color', () => {
      const width = 4
      const height = 2
      const pixels = new Uint8Array(width * height * 4)
      for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 0x4a
        pixels[i + 1] = 0x7c
        pixels[i + 2] = 0x3f
        pixels[i + 3] = 0xff
      }
      const avg = averageRegion(pixels, width, 0, 0, width, height)
      expect(avg.samples).toBe(8)
      expect(avg.r).toBe(0x4a)
      expect(avg.g).toBe(0x7c)
      expect(avg.b).toBe(0x3f)
    })

    it('averages a mixed band down to the mean of each channel', () => {
      const pixels = new Uint8Array([
        10, 40, 20, 255,
        200, 240, 210, 255
      ])
      const avg = averageRegion(pixels, 2, 0, 0, 2, 1)
      expect(avg.r).toBe(105)
      expect(avg.g).toBe(140)
      expect(avg.b).toBe(115)
      expect(avg.samples).toBe(2)
    })

    it('ignores alpha when averaging (translucent pixels are not weighted)', () => {
      const pixels = new Uint8Array([
        100, 50, 25, 255,
        100, 50, 25, 0
      ])
      const avg = averageRegion(pixels, 2, 0, 0, 2, 1)
      expect(avg.r).toBe(100)
      expect(avg.g).toBe(50)
      expect(avg.b).toBe(25)
    })

    it('averages only the requested rectangle (skip rows above the region)', () => {
      // 2x2 image, region = bottom row only (y=1).
      // Top row is all red; bottom row is all green. Average should be pure green.
      const pixels = new Uint8Array([
        255, 0, 0, 255,
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 255, 0, 255
      ])
      const avg = averageRegion(pixels, 2, 0, 1, 2, 1)
      expect(avg.r).toBe(0)
      expect(avg.g).toBe(255)
      expect(avg.b).toBe(0)
    })

    it('averages only the requested rectangle (skip columns left of the region)', () => {
      // 3x1 row: left is red, middle/right are green. Region = right column only.
      const pixels = new Uint8Array([
        255, 0, 0, 255,
        0, 255, 0, 255,
        0, 255, 0, 255
      ])
      const avg = averageRegion(pixels, 3, 1, 0, 2, 1)
      expect(avg.r).toBe(0)
      expect(avg.g).toBe(255)
      expect(avg.b).toBe(0)
    })

    it('returns zero with sample count 0 for an empty region', () => {
      const pixels = new Uint8Array(0)
      const avg = averageRegion(pixels, 0, 0, 0, 0, 0)
      expect(avg.samples).toBe(0)
      expect(avg.r).toBe(0)
      expect(avg.g).toBe(0)
      expect(avg.b).toBe(0)
    })
  })

  describe('bandColorToHex', () => {
    it('formats RGB as a #RRGGBB uppercase hex string', () => {
      expect(bandColorToHex({ r: 0x4a, g: 0x7c, b: 0x3f })).toBe('#4A7C3F')
      expect(bandColorToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
      expect(bandColorToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF')
    })

    it('clamps out-of-range channels before formatting', () => {
      expect(bandColorToHex({ r: -5, g: 300, b: 128 })).toBe('#00FF80')
    })
  })
})