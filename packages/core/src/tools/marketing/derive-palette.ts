/**
 * derive_palette tool (pixel-first hero pipeline)
 *
 * Step 2 of the pipeline: once the hero image exists and its color has
 * been sampled (sample_hero_color), this tool expands that seed into a
 * full WCAG-checked palette — ground/wash/accent/ink/neutrals — so hero
 * text color and section colors are DERIVED FROM THE PIXELS instead of
 * being locked before the image exists. The agent's aesthetic decision
 * shrinks to two attributable choices: pick the seed, pick the harmony.
 *
 * All color math lives in derive-palette-pure.ts (culori, OKLCH) and is
 * unit-tested without a graph; this file is the thin ToolDef shell.
 */

import { defineTool } from '#core/tools/schema'

import {
  PALETTE_HARMONIES,
  derivePalette,
  type PaletteCheck,
  type PaletteHarmony
} from './derive-palette-pure'

const DEFAULT_CONTRAST_FLOOR = 4.5

export const derivePaletteTool = defineTool({
  name: 'derive_palette',
  mutates: false,
  description:
    'Derive a full WCAG-checked color palette from a sampled seed color. Input: a #RRGGBB seed (typically from sample_hero_color on the generated hero) and a harmony type. Output roles: ground (60% base surface, light tint of the seed hue), wash (30% structural color, the seed itself), accent (10% highlight, hue rotated by the harmony angle; monochromatic deepens instead), ink.onLight/ink.onDark (text colors), and a 3-step neutral ramp. Every pair that matters is contrast-checked: ink.onLight/ground must meet contrast_floor (default 4.5, WCAG AA body text); accent/ground and ink.onDark/wash are checked against 3.0 (graphics/large text) and reported with pass:false when they fall short. Deterministic — same seed + harmony, same palette. Use this AFTER the hero image exists; never lock text colors before it.',
  params: {
    seed: {
      type: 'string',
      description:
        'Seed color as #RRGGBB — typically the sample_hero_color result from the generated hero image.',
      required: true
    },
    harmony: {
      type: 'string',
      description:
        'Hue relationship for the accent: analogous (+40°), complementary (180°), split-complementary (150°), triadic (120°), monochromatic (same hue, deepened).',
      required: true,
      enum: PALETTE_HARMONIES
    },
    contrast_floor: {
      type: 'number',
      description:
        'Minimum WCAG contrast ratio for ink.onLight on ground (body text). Default 4.5 (AA).',
      default: DEFAULT_CONTRAST_FLOOR,
      min: 1,
      max: 21
    }
  },
  execute: (_figma, args) => {
    const seed = args.seed
    if (typeof seed !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(seed)) {
      return { error: `seed must be a #RRGGBB hex string (got ${JSON.stringify(seed)}).` }
    }
    const harmonyRaw = typeof args.harmony === 'string' ? args.harmony : ''
    if (!PALETTE_HARMONIES.includes(harmonyRaw as PaletteHarmony)) {
      return {
        error: `harmony must be one of ${PALETTE_HARMONIES.join('/')} (got "${harmonyRaw}").`
      }
    }
    const harmony = harmonyRaw as PaletteHarmony
    const contrastFloor =
      typeof args.contrast_floor === 'number' && Number.isFinite(args.contrast_floor)
        ? args.contrast_floor
        : DEFAULT_CONTRAST_FLOOR

    const derived = derivePalette(seed, harmony, contrastFloor)
    if (!derived) return { error: `Could not parse seed "${seed}".` }

    return {
      seed: seed.toUpperCase(),
      harmony,
      palette: derived.palette,
      checks: derived.checks,
      note: buildNote(derived.checks)
    }
  }
})

function buildNote(checks: PaletteCheck[]): string {
  const warnings = checks.filter((c) => !c.pass).map(describeFailure)
  return [
    'Palette roles: ground = 60% 底色（页面/分区背景）, wash = 30% 结构色（hero 实物色系，色带/大色块）, accent = 10% 强调色（按钮、标签、点缀，少量使用）, ink.onLight 压 ground 的正文色, ink.onDark 压 hero 图/wash 的文字色, neutrals = 分割线/描边/次级面。',
    ...warnings,
    checks.every((c) => c.pass) ? 'All contrast checks passed.' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

function describeFailure(check: PaletteCheck): string {
  if (check.pair === 'accent/ground') {
    return `WARNING: accent/ground 仅 ${check.ratio}:1 — accent 只可用于图形/色块，不可压正文 (graphics only, never body text on ground).`
  }
  if (check.pair === 'ink.onDark/wash') {
    return `WARNING: ink.onDark/wash 仅 ${check.ratio}:1 — 浅色文字压 wash 色块时只可用于大字号标题，正文改压 ground 用 ink.onLight (large headings only).`
  }
  return `WARNING: ${check.pair} 仅 ${check.ratio}:1 — 正文对比度不达标，调深 ink.onLight 或调浅 ground (body-text contrast below floor).`
}
