/**
 * Resolve the wire-format size string (`"1080x1080"` / `"750x"`) into the
 * numeric pair the scene graph consumes. `"Wx"` (HUG) yields `height: null`.
 */

import type { ResolvedSize, SizeString } from './types.js'

export function resolveSize(size: SizeString): ResolvedSize {
  const match = size.match(/^(\d+)x(\d+)?$/)
  if (!match) throw new Error(`Invalid size string: "${size}"`)
  const width = Number.parseInt(match[1] ?? '', 10)
  const heightPart = match[2]
  const height = heightPart === undefined || heightPart === '' ? null : Number.parseInt(heightPart, 10)
  if (!Number.isFinite(width) || width <= 0) throw new Error(`Invalid size width: "${size}"`)
  if (height !== null && (!Number.isFinite(height) || height <= 0)) {
    throw new Error(`Invalid size height: "${size}"`)
  }
  return { width, height }
}

/** Convenience for `BrandType` lookups by id. */
export function resolveTypeSize(type: { size: SizeString }): ResolvedSize {
  return resolveSize(type.size)
}