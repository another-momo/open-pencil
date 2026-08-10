import { describe, expect, it } from 'bun:test'

import {
  adjustChannel,
  averageBandColor,
  bandColorToHex
} from '#core/tools/marketing/sample-color-pure'

/**
 * Pure color math for sample-hero-color. CanvasKit-free so the gradient
 * recipe in the prompt actually receives a sensible hex when the agent
 * drops in the tool's result.
 */
describe('sample-hero-color / pure math', () => {
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
    const avg = averageBandColor(pixels, width, height)
    expect(avg.samples).toBe(8)
    expect(avg.r).toBe(0x4a)
    expect(avg.g).toBe(0x7c)
    expect(avg.b).toBe(0x3f)
  })

  it('averages a mixed band down to the mean of each channel', () => {
    // 2×1 band: pixel A is dark green, pixel B is light green
    const pixels = new Uint8Array([
      10, 40, 20, 255,
      200, 240, 210, 255
    ])
    const avg = averageBandColor(pixels, 2, 1)
    expect(avg.r).toBe(105)
    expect(avg.g).toBe(140)
    expect(avg.b).toBe(115)
    expect(avg.samples).toBe(2)
  })

  it('ignores alpha when averaging (translucent hero pixels are not special)', () => {
    const pixels = new Uint8Array([
      100, 50, 25, 255,
      100, 50, 25, 0
    ])
    const avg = averageBandColor(pixels, 2, 1)
    expect(avg.r).toBe(100)
    expect(avg.g).toBe(50)
    expect(avg.b).toBe(25)
  })

  it('lighten 0 leaves the channel unchanged', () => {
    expect(adjustChannel(100, 0)).toBe(100)
    expect(adjustChannel(0, 0)).toBe(0)
    expect(adjustChannel(255, 0)).toBe(255)
  })

  it('lighten 1 pulls all the way to white', () => {
    expect(adjustChannel(0, 1)).toBe(255)
    expect(adjustChannel(120, 1)).toBe(255)
  })

  it('lighten 0.4 lands on the expected interpolated value', () => {
    // 100 + (255 - 100) * 0.4 = 100 + 62 = 162
    expect(adjustChannel(100, 0.4)).toBe(162)
  })

  it('rounds to integer channel values (alpha is 8-bit)', () => {
    expect(adjustChannel(100, 0.5)).toBe(178) // 100 + 155*0.5 = 177.5 → 178
  })

  it('formats RGB as a #RRGGBB uppercase hex string', () => {
    expect(bandColorToHex({ r: 0x4a, g: 0x7c, b: 0x3f })).toBe('#4A7C3F')
    expect(bandColorToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(bandColorToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF')
  })

  it('clamps out-of-range channels before formatting', () => {
    expect(bandColorToHex({ r: -5, g: 300, b: 128 })).toBe('#00FF80')
  })
})