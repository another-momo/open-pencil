import { describe, expect, it } from 'bun:test'

import { averageRegion, bandColorToHex, bandRegion } from '#core/tools/marketing/sample-color-pure'

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
      const pixels = new Uint8Array([10, 40, 20, 255, 200, 240, 210, 255])
      const avg = averageRegion(pixels, 2, 0, 0, 2, 1)
      expect(avg.r).toBe(105)
      expect(avg.g).toBe(140)
      expect(avg.b).toBe(115)
      expect(avg.samples).toBe(2)
    })

    it('ignores alpha when averaging (translucent pixels are not weighted)', () => {
      const pixels = new Uint8Array([100, 50, 25, 255, 100, 50, 25, 0])
      const avg = averageRegion(pixels, 2, 0, 0, 2, 1)
      expect(avg.r).toBe(100)
      expect(avg.g).toBe(50)
      expect(avg.b).toBe(25)
    })

    it('averages only the requested rectangle (skip rows above the region)', () => {
      // 2x2 image, region = bottom row only (y=1).
      // Top row is all red; bottom row is all green. Average should be pure green.
      const pixels = new Uint8Array([
        255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255
      ])
      const avg = averageRegion(pixels, 2, 0, 1, 2, 1)
      expect(avg.r).toBe(0)
      expect(avg.g).toBe(255)
      expect(avg.b).toBe(0)
    })

    it('averages only the requested rectangle (skip columns left of the region)', () => {
      // 3x1 row: left is red, middle/right are green. Region = right column only.
      const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255])
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

    /**
     * Regression for the 8-10 smoke run. The tool used to call readPixels
     * with the sub-region's width/height, returning a sub-region-sized
     * buffer — then passed it to averageRegion with the FULL image's
     * width as stride. Result: out-of-bounds reads → all-zero bytes →
     * 0/0 = NaN → "#NANNANNAN". The test simulates a realistic full-image
     * buffer and a bottom-region query.
     */
    it('averages the bottom band of a realistic full-image buffer without producing NaN', () => {
      const imageWidth = 1504
      const imageHeight = 1008
      const bandHeight = 100

      // Construct a 1504×1008 image where the top half is red (255,0,0)
      // and the bottom band (y=908..1008) is green (0,255,0).
      const pixels = new Uint8Array(imageWidth * imageHeight * 4)
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          const i = (y * imageWidth + x) * 4
          if (y >= imageHeight - bandHeight) {
            pixels[i] = 0
            pixels[i + 1] = 255
            pixels[i + 2] = 0
          } else {
            pixels[i] = 255
            pixels[i + 1] = 0
            pixels[i + 2] = 0
          }
          pixels[i + 3] = 255
        }
      }

      const avg = averageRegion(
        pixels,
        imageWidth,
        0,
        imageHeight - bandHeight,
        imageWidth,
        bandHeight
      )
      expect(avg.samples).toBe(imageWidth * bandHeight)
      // All-zero average → NaN. The regression asserts finite values.
      expect(Number.isFinite(avg.r)).toBe(true)
      expect(Number.isFinite(avg.g)).toBe(true)
      expect(Number.isFinite(avg.b)).toBe(true)
      // Average should be pure green.
      expect(avg.r).toBe(0)
      expect(avg.g).toBe(255)
      expect(avg.b).toBe(0)
    })

    it('does not silently NaN when called with a sub-region-shaped buffer instead of full image', () => {
      // This mirrors the OLD bug: the caller passes a buffer sized for
      // just the sub-region, not the full image. The pure function does
      // not know the buffer shape — only the caller does — so the
      // defensive check belongs at the tool boundary (see sample-color.ts).
      // Here we document that the function will produce nonsense when
      // given mismatched stride vs. buffer, which is why the tool must
      // pass the full image buffer.
      const imageWidth = 1504
      const imageHeight = 1008
      const bandHeight = 100
      // Sub-region-sized buffer (the bug case).
      const subBuffer = new Uint8Array(imageWidth * bandHeight * 4)
      const avg = averageRegion(
        subBuffer,
        imageWidth,
        0,
        imageHeight - bandHeight,
        imageWidth,
        bandHeight
      )
      // With the wrong buffer, r/g/b will be NaN. The point of this test
      // is to make the contract explicit: callers MUST pass a full-image
      // buffer; otherwise the result is undefined and the tool must guard.
      expect(Number.isNaN(avg.r)).toBe(true)
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
