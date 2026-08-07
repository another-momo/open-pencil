import { afterEach, describe, expect, test } from 'bun:test'

import { fontManager, puHuiTiStyleForWeight, setSingleFontMode } from '@open-pencil/core/text'

afterEach(() => {
  setSingleFontMode(false)
})

describe('puHuiTiStyleForWeight', () => {
  test('maps CSS weights to the nearest bundled PuHuiTi style', () => {
    expect(puHuiTiStyleForWeight(100)).toBe('Thin')
    expect(puHuiTiStyleForWeight(300)).toBe('Light')
    expect(puHuiTiStyleForWeight(400)).toBe('Regular')
    expect(puHuiTiStyleForWeight(500)).toBe('Medium')
    expect(puHuiTiStyleForWeight(600)).toBe('SemiBold')
    expect(puHuiTiStyleForWeight(700)).toBe('Bold')
  })

  test('clamps heavy weights to ExtraBold (Heavy/Black are glyph subsets)', () => {
    expect(puHuiTiStyleForWeight(800)).toBe('ExtraBold')
    expect(puHuiTiStyleForWeight(900)).toBe('ExtraBold')
    expect(puHuiTiStyleForWeight(950)).toBe('ExtraBold')
  })
})

describe('single-font mode loadFont', () => {
  test('serves any requested family from bundled PuHuiTi bytes', async () => {
    setSingleFontMode(true)
    const buffer = await fontManager.loadFont('Some Figma Family', 'Bold')
    expect(buffer).not.toBeNull()
    expect(fontManager.isStyleLoaded('Some Figma Family', 'Bold')).toBe(true)
  })

  test('shares one ArrayBuffer per weight across aliased families', async () => {
    setSingleFontMode(true)
    const first = await fontManager.loadFont('Family A', 'Regular')
    const second = await fontManager.loadFont('Family B', 'Regular')
    expect(first).not.toBeNull()
    expect(second).toBe(first)
  })

  test('different weights resolve to different bundled styles', async () => {
    setSingleFontMode(true)
    const regular = await fontManager.loadFont('Family C', 'Regular')
    const bold = await fontManager.loadFont('Family C', 'Bold')
    expect(regular).not.toBeNull()
    expect(bold).not.toBeNull()
    expect(bold).not.toBe(regular)
  })
})
