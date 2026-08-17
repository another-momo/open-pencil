/**
 * Brand config types — types and profiles consumed by the marketing
 * agent and the BrandConfigPanel.
 *
 * Two layers are represented here as a single shape that downstream
 * consumers (overlay builder, prompt assembly, UI rendering) operate on:
 *   - default_* = immutable factory preset shipped with the editor
 *   - user_*    = per-user overrides (sqlite ~/.openpencil/brand.db)
 *
 * Effective reads return user rows in preference to default rows with the
 * same id. See `repository.ts` for the merge logic.
 *
 * `size.height === null` means HUG (long-image types grow with content).
 * `size` round-trips through the wire format `"WxH"` (or `"Wx"` for HUG).
 */

export type SizeString = `${number}x` | `${number}x${number}`

export interface BrandType {
  id: string
  label: string
  /** Width × Height in CSS pixels. Trailing `x` (e.g. `"750x"`) means HUG height. */
  size: SizeString
  description?: string
}

export interface BrandProfile {
  id: string
  label: string
  /** Material type ids the profile is applicable to (empty array = universal). */
  applicable_to: string[]
  /** Markdown body — injected as system prompt overlay when the profile is active. */
  markdown: string
}

export interface BrandConfig {
  schema_version: 1
  name: string
  types: BrandType[]
  profiles: BrandProfile[]
}

/** Resolved (number-based) size — what the scene graph actually consumes. */
export interface ResolvedSize {
  width: number
  height: number | null
}

/** Source layer for effective reads — surfaced so the UI can label rows. */
export type BrandLayer = 'default' | 'user'

export interface EffectiveBrandType extends BrandType {
  layer: BrandLayer
  updated_at?: number
}

export interface EffectiveBrandProfile extends BrandProfile {
  layer: BrandLayer
  updated_at?: number
}

export interface EffectiveBrandConfig {
  schema_version: 1
  name: string
  types: EffectiveBrandType[]
  profiles: EffectiveBrandProfile[]
}