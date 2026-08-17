/**
 * Public surface for the brand config module.
 *
 * Re-exports the YAML loader + zod schema + types. Persistence (SQLite) and
 * HTTP routes are wired up in C4/C5 and will hang additional re-exports off
 * this module — the loader is the only piece C1 introduces.
 */

export { parseBrandYaml, stringifyBrandYaml, parseYaml, stringifyYaml } from './loader.js'
export { brandConfigSchema } from './schema.js'
export type { BrandConfigInput, BrandConfigParsed } from './schema.js'
export type {
  BrandConfig,
  BrandProfile,
  BrandType,
  EffectiveBrandConfig,
  EffectiveBrandProfile,
  EffectiveBrandType,
  BrandLayer,
  ResolvedSize,
  SizeString
} from './types.js'
export { resolveSize, resolveTypeSize } from './size.js'
export { BrandRepository, openBrandRepository } from './repository.js'
export type { BrandRepositoryOptions } from './repository.js'
export { defaultBrandDbPath, loadDefaultBrandConfig } from './default-config.js'