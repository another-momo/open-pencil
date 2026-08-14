import { describe, expect, it } from 'bun:test'

import { oklch, parseHex, wcagContrast } from 'culori'

import { derivePaletteTool } from '#core/tools/marketing/derive-palette'
import {
  derivePalette,
  type DerivedPalette,
  type PaletteCheck,
  type PaletteHarmony
} from '#core/tools/marketing/derive-palette-pure'

import { expectDefined } from '#tests/helpers/assert'

/**
 * Pure color math for derive_palette. The pinned contract: OKLCH hue
 * rotation per harmony (analogous +40 / complementary 180 /
 * split-complementary 150 / triadic 120 / monochromatic same-hue deepened),
 * every output clamped into the sRGB gamut, deterministic output, and
 * WCAG checks against ground and wash.
 */
describe('derive-palette / pure math', () => {
  const SEED = '#5A7F5B'

  function hueOf(hex: string): number {
    const parsed = parseHex(hex)
    const color = oklch(expectDefined(parsed, 'parsed hex'))
    return color.h ?? 0
  }

  function hueDiff(a: number, b: number): number {
    return Math.abs(((((a - b) % 360) + 540) % 360) - 180)
  }

  describe('harmony hue angles', () => {
    const cases: Array<[PaletteHarmony, number]> = [
      ['analogous', 40],
      ['complementary', 180],
      ['split-complementary', 150],
      ['triadic', 120]
    ]
    for (const [harmony, angle] of cases) {
      it(`${harmony} rotates the accent hue by ${angle}°`, () => {
        const result = expectDefined(derivePalette(SEED, harmony, 4.5), 'palette')
        // Hex quantization can nudge the hue by a degree or two.
        expect(Math.abs(hueDiff(hueOf(result.palette.accent), hueOf(SEED)) - angle)).toBeLessThan(3)
      })
    }

    it('monochromatic keeps the accent hue and darkens it', () => {
      const result = expectDefined(derivePalette(SEED, 'monochromatic', 4.5), 'palette')
      expect(hueDiff(hueOf(result.palette.accent), hueOf(SEED))).toBeLessThan(5)
      const accentL = oklch(expectDefined(parseHex(result.palette.accent), 'accent')).l
      const seedL = oklch(expectDefined(parseHex(SEED), 'seed')).l
      expect(accentL).toBeLessThan(seedL)
    })

    it('keeps ground and ink on the seed hue', () => {
      const result = expectDefined(derivePalette(SEED, 'triadic', 4.5), 'palette')
      expect(hueDiff(hueOf(result.palette.ground), hueOf(SEED))).toBeLessThan(5)
      expect(hueDiff(hueOf(result.palette.ink.onLight), hueOf(SEED))).toBeLessThan(5)
      for (const neutral of result.palette.neutrals) {
        expect(hueDiff(hueOf(neutral), hueOf(SEED))).toBeLessThan(5)
      }
    })
  })

  describe('output shape', () => {
    it('emits uppercase #RRGGBB hex everywhere', () => {
      const result = expectDefined(derivePalette(SEED, 'analogous', 4.5), 'palette')
      const all = [
        result.palette.ground,
        result.palette.wash,
        result.palette.accent,
        result.palette.ink.onLight,
        result.palette.ink.onDark,
        ...result.palette.neutrals
      ]
      for (const hex of all) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/)
      }
      expect(result.palette.neutrals.length).toBe(3)
    })

    it('wash is the seed color itself', () => {
      const result = expectDefined(derivePalette(SEED, 'analogous', 4.5), 'palette')
      expect(result.palette.wash).toBe(SEED)
    })

    it('ground is a light tint of the seed hue', () => {
      const result = expectDefined(derivePalette(SEED, 'analogous', 4.5), 'palette')
      const ground = oklch(expectDefined(parseHex(result.palette.ground), 'ground'))
      expect(ground.l).toBeGreaterThan(0.9)
    })

    it('keeps every derived color inside the sRGB gamut (clamped, not raw OKLCH)', () => {
      // A vivid seed whose +40° rotation would fall outside sRGB without
      // chroma clamping.
      const result = expectDefined(derivePalette('#FF3300', 'analogous', 4.5), 'palette')
      const accent = expectDefined(parseHex(result.palette.accent), 'accent')
      for (const channel of [accent.r, accent.g, accent.b]) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
      // Still recognizably hue-rotated, not collapsed to gray.
      expect(hueDiff(hueOf(result.palette.accent), hueOf('#FF3300'))).toBeGreaterThan(20)
    })

    it('is fully deterministic — same input, same output', () => {
      const a = derivePalette(SEED, 'split-complementary', 4.5)
      const b = derivePalette(SEED, 'split-complementary', 4.5)
      expect(a).toEqual(b)
    })

    it('returns undefined for an invalid seed', () => {
      expect(derivePalette('not-a-hex', 'analogous', 4.5)).toBeUndefined()
      expect(derivePalette('#FFF', 'analogous', 4.5)).toBeUndefined()
      expect(derivePalette('#5A7F5BFF', 'analogous', 4.5)).toBeUndefined()
    })
  })

  describe('contrast checks', () => {
    it('a light seed (#EFEDD9) keeps ink.onLight/ground ≥ 4.5', () => {
      for (const harmony of [
        'analogous',
        'complementary',
        'split-complementary',
        'triadic',
        'monochromatic'
      ] as PaletteHarmony[]) {
        const result = expectDefined(derivePalette('#EFEDD9', harmony, 4.5), 'palette')
        const check = expectDefined(
          result.checks.find((c) => c.pair === 'ink.onLight/ground'),
          'ink check'
        )
        expect(check.pass).toBe(true)
        expect(
          wcagContrast(result.palette.ink.onLight, result.palette.ground)
        ).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('reports ratios rounded to 1 decimal and flags accent/ground below 3.0', () => {
      const result = expectDefined(derivePalette(SEED, 'analogous', 4.5), 'palette')
      expect(result.checks.map((c) => c.pair)).toEqual([
        'ink.onLight/ground',
        'ink.onLight/neutrals[0]',
        'accent/ground',
        'ink.onDark/wash',
        'ink.onDark/accent',
        'ink.onDark/neutrals[2]'
      ])
      for (const check of result.checks) {
        expect(check.ratio).toBe(Math.round(check.ratio * 10) / 10)
      }
      // A mid-chroma accent rotated +40° off a mid-green seed sits close to
      // the ground tint — the check exists exactly for seeds like this.
      const accentCheck = expectDefined(
        result.checks.find((c) => c.pair === 'accent/ground'),
        'accent check'
      )
      const raw = wcagContrast(result.palette.accent, result.palette.ground)
      expect(accentCheck.ratio).toBe(Math.round(raw * 10) / 10)
      expect(accentCheck.pass).toBe(raw >= 3.0)
    })

    it('keeps surface roles distinct (regression: ground ≈ ink.onDark ≈ neutrals[0] invisibility)', () => {
      for (const seed of ['#EFEDD9', '#2E5A4C', SEED]) {
        const result = expectDefined(derivePalette(seed, 'analogous', 4.5), 'palette')
        const { ground, ink, neutrals } = result.palette
        // The 2026-08-14 smoke failure: text and its block painted the same
        // color. ground/ink.onDark/neutrals[0] must never coincide.
        expect(wcagContrast(ground, neutrals[0])).toBeGreaterThan(1.2)
        expect(ink.onDark).not.toBe(neutrals[0])
        // Sanctioned pairings exist and every sanctioned pair is checked.
        expect(result.pairings['ink.onLight']).toContain('ground')
        expect(result.pairings['ink.onDark']).toContain('wash')
        for (const [inkRole, surfaces] of Object.entries(result.pairings)) {
          for (const surface of surfaces) {
            expect(
              result.checks.some((c) => c.pair === `${inkRole}/${surface}`),
              `missing check for ${inkRole}/${surface}`
            ).toBe(true)
          }
        }
      }
    })

    it('honors a custom contrast_floor for the ink check', () => {
      const result = expectDefined(derivePalette(SEED, 'analogous', 7), 'palette')
      const check = expectDefined(
        result.checks.find((c) => c.pair === 'ink.onLight/ground'),
        'ink check'
      )
      const raw = wcagContrast(result.palette.ink.onLight, result.palette.ground)
      expect(check.pass).toBe(raw >= 7)
    })
  })
})

describe('derive_palette tool', () => {
  function makeFigma() {
    return {} as never
  }

  interface ToolResult {
    seed: string
    harmony: string
    palette: DerivedPalette
    checks: PaletteCheck[]
    note: string
  }

  it('returns seed/harmony/palette/checks/note', async () => {
    const result = (await derivePaletteTool.execute(makeFigma(), {
      seed: '#5a7f5b',
      harmony: 'complementary'
    })) as ToolResult
    expect(result).not.toHaveProperty('error')
    expect(result.seed).toBe('#5A7F5B')
    expect(result.harmony).toBe('complementary')
    expect(result.note).toEqual(expect.stringContaining('ground'))
    expect(Array.isArray(result.checks)).toBe(true)
  })

  it('returns an error for an invalid seed', async () => {
    const result = await derivePaletteTool.execute(makeFigma(), {
      seed: 'red',
      harmony: 'analogous'
    })
    expect(result).toMatchObject({ error: expect.stringContaining('#RRGGBB') })
  })

  it('returns an error for an unknown harmony', async () => {
    const result = await derivePaletteTool.execute(makeFigma(), {
      seed: '#5A7F5B',
      harmony: 'discordant'
    })
    expect(result).toMatchObject({ error: expect.stringContaining('harmony') })
  })

  it('warns in the note when a check fails', async () => {
    // A light seed: the accent keeps the seed's high lightness, so
    // accent/ground sits near 1:1 — deterministically below the 3.0 floor.
    const result = (await derivePaletteTool.execute(makeFigma(), {
      seed: '#EFEDD9',
      harmony: 'complementary'
    })) as ToolResult
    const accentCheck = expectDefined(
      result.checks.find((c) => c.pair === 'accent/ground'),
      'accent check'
    )
    expect(accentCheck.pass).toBe(false)
    expect(result.note).toContain('WARNING')
    expect(result.note).toContain('accent/ground')
    expect(result.note).toContain('accent 只可用于图形/色块')
  })

  it('reports all-passed when every check meets its floor', async () => {
    // A dark, saturated seed: accent is far from the ground tint.
    const result = (await derivePaletteTool.execute(makeFigma(), {
      seed: '#1A3B8F',
      harmony: 'complementary'
    })) as ToolResult
    expect(result.checks.every((c) => c.pass)).toBe(true)
    expect(result.note).toContain('All contrast checks passed')
  })

  it('does not mutate the graph', () => {
    expect(derivePaletteTool.mutates).toBe(false)
  })
})
