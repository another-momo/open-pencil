/**
 * Pure color math for derive_palette. culori-only (OKLCH space,
 * clampChroma for sRGB gamut, wcagContrast for checks) and fully
 * deterministic — same seed + harmony, same palette.
 *
 * Role model (60/30/10):
 *   ground   60% base surface — seed hue, very light tint
 *   wash     30% structural color — the seed itself
 *   accent   10% highlight — seed hue rotated by the harmony angle
 *            (monochromatic: same hue, deepened)
 *   ink      text colors — onLight for ground, onDark for wash/hero
 *   neutrals seed-hue low-chroma lightness ramp for borders/dividers
 */

import type { Oklch } from 'culori'
import { clampChroma, formatHex, oklch, parseHex, wcagContrast } from 'culori'

export type PaletteHarmony =
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triadic'
  | 'monochromatic'

export const PALETTE_HARMONIES: PaletteHarmony[] = [
  'analogous',
  'complementary',
  'split-complementary',
  'triadic',
  'monochromatic'
]

/** Hue rotation per harmony. Monochromatic keeps the hue and deepens instead. */
const HUE_ROTATION: Record<Exclude<PaletteHarmony, 'monochromatic'>, number> = {
  analogous: 40,
  complementary: 180,
  'split-complementary': 150,
  triadic: 120
}

const GROUND_LIGHTNESS = 0.96
const GROUND_CHROMA_FACTOR = 0.3
const INK_ON_LIGHT_LIGHTNESS = 0.25
const INK_ON_DARK_LIGHTNESS = 0.96
const INK_CHROMA_FACTOR = 0.2
const NEUTRAL_CHROMA_FACTOR = 0.15
// Deliberately BELOW ground lightness (0.96): an earlier ramp started at
// 0.96, which made neutrals[0] pixel-identical to ground and ink.onDark —
// three roles, one color, and agents pairing "ink.onDark" (misread as
// "dark ink") with a ground block produced invisible text.
const NEUTRAL_LIGHTNESSES = [0.9, 0.72, 0.5] as const
const MONO_ACCENT_LIGHTNESS_FACTOR = 0.6

/** WCAG 3.0 = large-text / graphics floor for accent and hero-overlay ink. */
const LARGE_TEXT_FLOOR = 3.0

export interface PaletteCheck {
  pair: string
  /** Contrast ratio rounded to 1 decimal. */
  ratio: number
  pass: boolean
}

export interface DerivedPalette {
  ground: string
  wash: string
  accent: string
  ink: { onLight: string; onDark: string }
  neutrals: string[]
}

export interface DerivePaletteResult {
  palette: DerivedPalette
  checks: PaletteCheck[]
  /** Sanctioned text-on-surface pairings — every listed pair is covered by checks. */
  pairings: Record<string, string[]>
}

/**
 * Sanctioned ink pairings. ink.onLight (dark text) belongs on LIGHT
 * surfaces only; ink.onDark (light text) on DARK surfaces only. Anything
 * outside this table is unsupported — most importantly ink.onDark on
 * ground/neutrals[0], which is invisible by construction (same lightness).
 */
const PAIRINGS: Record<string, string[]> = {
  'ink.onLight': ['ground', 'neutrals[0]'],
  'ink.onDark': ['wash', 'accent', 'neutrals[2]']
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

/**
 * Derive the full palette from a #RRGGBB seed. Returns undefined for an
 * invalid seed — the tool shell turns that into an { error } result.
 */
export function derivePalette(
  seed: string,
  harmony: PaletteHarmony,
  contrastFloor: number
): DerivePaletteResult | undefined {
  if (!HEX_REGEX.test(seed)) return undefined
  const parsed = parseHex(seed)
  if (!parsed) return undefined
  const seedOklch = oklch(parsed)
  // Achromatic seeds have no hue — clampChroma keeps it that way and every
  // role degenerates to a gray ramp, which is the correct neutral behavior.
  const h = seedOklch.h ?? 0
  const base = { l: seedOklch.l, c: seedOklch.c, h }

  const wash = toHex(base)
  const ground = toHex({
    l: GROUND_LIGHTNESS,
    c: base.c * GROUND_CHROMA_FACTOR,
    h
  })
  const accent =
    harmony === 'monochromatic'
      ? toHex({ l: base.l * MONO_ACCENT_LIGHTNESS_FACTOR, c: base.c, h })
      : toHex({ l: base.l, c: base.c, h: h + HUE_ROTATION[harmony] })
  const inkOnLight = toHex({ l: INK_ON_LIGHT_LIGHTNESS, c: base.c * INK_CHROMA_FACTOR, h })
  const inkOnDark = toHex({ l: INK_ON_DARK_LIGHTNESS, c: base.c * NEUTRAL_CHROMA_FACTOR, h })
  const neutrals = NEUTRAL_LIGHTNESSES.map((l) =>
    toHex({ l, c: base.c * NEUTRAL_CHROMA_FACTOR, h })
  )

  const checks: PaletteCheck[] = [
    check('ink.onLight/ground', inkOnLight, ground, contrastFloor),
    check('ink.onLight/neutrals[0]', inkOnLight, neutrals[0], contrastFloor),
    check('accent/ground', accent, ground, LARGE_TEXT_FLOOR),
    check('ink.onDark/wash', inkOnDark, wash, LARGE_TEXT_FLOOR),
    check('ink.onDark/accent', inkOnDark, accent, LARGE_TEXT_FLOOR),
    check('ink.onDark/neutrals[2]', inkOnDark, neutrals[2], contrastFloor)
  ]

  return {
    palette: {
      ground,
      wash,
      accent,
      ink: { onLight: inkOnLight, onDark: inkOnDark },
      neutrals
    },
    checks,
    pairings: PAIRINGS
  }
}

/** OKLCH → sRGB-gamut-clamped uppercase #RRGGBB. */
function toHex(color: { l: number; c: number; h: number }): string {
  const oklchColor: Oklch = { mode: 'oklch', l: color.l, c: color.c, h: color.h }
  return formatHex(clampChroma(oklchColor, 'oklch')).toUpperCase()
}

function check(pair: string, a: string, b: string, floor: number): PaletteCheck {
  const ratio = wcagContrast(a, b)
  return { pair, ratio: Math.round(ratio * 10) / 10, pass: ratio >= floor }
}
