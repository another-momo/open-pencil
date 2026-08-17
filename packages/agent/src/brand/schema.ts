/**
 * zod schema for the brand config YAML format.
 *
 * Validator contract: be loud about malformed entries (line/column via the
 * optional `path`), be lenient about cosmetic fields. The schema is the
 * single source of truth for the import/export wire format.
 *
 * Round-trip invariant: `parseYaml(yamlStringify(parsed))` deep-equals the
 * input. The schema intentionally rejects unknown keys so import paths can
 * warn loudly about typos, but defaults to permissive parsing for the
 * `description` field since it's pure documentation.
 */

import { z } from 'zod'

const SIZE_RE = /^(\d+)x(\d+)?$/

const sizeString = z
  .string()
  .regex(SIZE_RE, 'size must look like "1080x1080" or "750x" (HUG)')
  .transform<`${number}x${number}` | `${number}x`>((value) => value as `${number}x${number}` | `${number}x`)

const brandType = z
  .object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/i, 'id must be alphanumeric or underscore'),
    label: z.string().min(1).max(128),
    size: sizeString,
    description: z.string().max(2000).optional()
  })
  .strict()

const brandProfile = z
  .object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/i, 'id must be alphanumeric or underscore'),
    label: z.string().min(1).max(128),
    applicable_to: z.array(z.string().min(1)).default([]),
    markdown: z.string().min(1)
  })
  .strict()

export const brandConfigSchema = z
  .object({
    schema_version: z.literal(1),
    name: z.string().min(1).max(128),
    // Empty `types:` lines (no children) parse as `{}`; coerce to [] so the
    // emitter's empty-collection output round-trips cleanly.
    types: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(brandType).default([])),
    profiles: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(brandProfile).default([]))
  })
  .strict()
  .superRefine((value, ctx) => {
    const seenTypes = new Set<string>()
    for (const [index, entry] of value.types.entries()) {
      if (seenTypes.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['types', index, 'id'],
          message: `duplicate type id "${entry.id}"`
        })
      }
      seenTypes.add(entry.id)
    }
    const seenProfiles = new Set<string>()
    for (const [index, entry] of value.profiles.entries()) {
      if (seenProfiles.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['profiles', index, 'id'],
          message: `duplicate profile id "${entry.id}"`
        })
      }
      seenProfiles.add(entry.id)
    }
  })

export type BrandConfigInput = z.input<typeof brandConfigSchema>
export type BrandConfigParsed = z.output<typeof brandConfigSchema>