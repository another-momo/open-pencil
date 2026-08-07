// Fork: single-font mode. Every requested family is served by the bundled
// Alibaba PuHuiTi (weight-mapped), registered under the requested name.
// This neutralizes the multi-source font pipeline (system / web / downloaded
// fonts) at a single choke point — FontManager.loadFont — while keeping all
// upstream machinery in place for painless merges and an easy opt-out.

let enabled = false

export function singleFontModeEnabled(): boolean {
  return enabled
}

export function setSingleFontMode(value: boolean): void {
  enabled = value
}

export const SINGLE_FONT_FAMILY = 'Alibaba PuHuiTi'

/** Maps an arbitrary CSS weight (100–900) to the nearest safe bundled PuHuiTi style.
 * Heavy/Black are deliberately excluded: those bundled files are 33%-glyph
 * subsets, so mapping anything to them would render tofu for common
 * characters. Weights ≥ 750 clamp to ExtraBold. */
export function puHuiTiStyleForWeight(weight: number): string {
  if (weight < 200) return 'Thin'
  if (weight < 350) return 'Light'
  if (weight < 450) return 'Regular'
  if (weight < 550) return 'Medium'
  if (weight < 650) return 'SemiBold'
  if (weight < 750) return 'Bold'
  return 'ExtraBold'
}
