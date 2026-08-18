/**
 * BrandRepository — SQLite-backed persistence for the user's brand config.
 *
 * Schema (four tables):
 *   brand_default_types  — immutable factory preset, seeded from the shipped YAML
 *   brand_default_profiles — immutable factory preset, seeded from the shipped YAML
 *   brand_user_types    — per-user overrides, may shadow or extend default_types
 *   brand_user_profiles — per-user overrides, may shadow or extend default_profiles
 *   brand_meta          — key/value (default_hash, seed_version, last_import_at, …)
 *
 * Effective read: rows in user_* shadow rows in default_* with the same id.
 * Use `effectiveTypes()` / `effectiveProfiles()` / `effectiveConfig()` to
 * get the merged view the UI and agent consume.
 *
 * The repository owns a single SQLite connection. Open via `openBrandRepository`
 * and close with `.close()`. Tests construct an in-memory database by passing
 * `:memory:` to `openBrandRepository`.
 */

import { mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'

import { Database } from 'bun:sqlite'

import { stringifyBrandYaml } from './loader.js'
import { resolveSize } from './size.js'
import type {
  BrandConfig,
  BrandProfile,
  BrandType,
  EffectiveBrandConfig,
  EffectiveBrandProfile,
  EffectiveBrandType,
  SizeString
} from './types.js'

export interface BrandRepositoryOptions {
  /** SQLite file path or `:memory:` */
  path: string
  /**
   * Default brand config to seed. On first open the factory preset is always
   * seeded; on later opens the default_* tables are reseeded whenever the
   * config's content hash differs from the stored `brand_meta.default_hash`.
   */
  seed?: BrandConfig
}

interface BrandTypeRow {
  id: string
  label: string
  size_w: number
  size_h: number | null
  description: string | null
}

interface BrandProfileRow {
  id: string
  label: string
  applicable_to: string
  markdown: string
}

interface BrandUserTypeRow extends BrandTypeRow {
  updated_at: number
}

interface BrandUserProfileRow extends BrandProfileRow {
  updated_at: number
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS brand_default_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  size_w INTEGER NOT NULL,
  size_h INTEGER,
  description TEXT
);

CREATE TABLE IF NOT EXISTS brand_default_profiles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  applicable_to TEXT NOT NULL,
  markdown TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_user_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  size_w INTEGER NOT NULL,
  size_h INTEGER,
  description TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_user_profiles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  applicable_to TEXT NOT NULL,
  markdown TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`

/**
 * Legacy schema-generation marker reported by `/v1/brand/metadata`. Kept for
 * diagnostics only — it no longer gates reseeding; `default_hash` does.
 */
const SEED_VERSION = '3'

/**
 * Stable content hash of a seed config. Serialized via `stringifyBrandYaml`
 * (the same deterministic serializer used for export), so any edit to the
 * shipped YAML — even a single markdown character — flips the hash. This
 * replaces the old manual SEED_VERSION bump, which was easy to forget and
 * left existing installs stuck on stale factory presets.
 */
function seedContentHash(config: BrandConfig): string {
  return createHash('sha256').update(stringifyBrandYaml(config), 'utf8').digest('hex')
}

export class BrandRepository {
  private readonly db: Database
  /** Filesystem path the DB was opened with (`:memory:` for tests). */
  dbPath = ''

  constructor(db: Database) {
    this.db = db
    db.exec(SCHEMA_SQL)
  }

  close(): void {
    this.db.close()
  }

  /** Read a brand_meta value (e.g. `seed_version`); undefined when unset. */
  metaValue(key: string): string | undefined {
    return this.db
      .query<{ value: string }, [string]>(`SELECT value FROM brand_meta WHERE key = ?`)
      .get(key)?.value
  }

  /**
   * Idempotent seed of the immutable factory preset. Reseeds the default_*
   * tables (in one transaction) whenever the seed config's content hash
   * differs from the stored `brand_meta.default_hash` — first open included.
   * The user layer is never touched.
   */
  seed(config: BrandConfig): void {
    const hash = seedContentHash(config)
    if (this.metaValue('default_hash') === hash) return

    const tx = this.db.transaction(() => {
      this.db.exec('DELETE FROM brand_default_types')
      this.db.exec('DELETE FROM brand_default_profiles')
      const insertType = this.db.prepare(
        `INSERT OR REPLACE INTO brand_default_types (id, label, size_w, size_h, description) VALUES (?, ?, ?, ?, ?)`
      )
      for (const type of config.types) {
        const { width, height } = resolveSize(type.size)
        insertType.run(type.id, type.label, width, height, type.description ?? null)
      }
      const insertProfile = this.db.prepare(
        `INSERT OR REPLACE INTO brand_default_profiles (id, label, applicable_to, markdown) VALUES (?, ?, ?, ?)`
      )
      for (const profile of config.profiles) {
        insertProfile.run(profile.id, profile.label, JSON.stringify(profile.applicable_to), profile.markdown)
      }
      const writeMeta = this.db.prepare(
        `INSERT OR REPLACE INTO brand_meta (key, value) VALUES (?, ?)`
      )
      writeMeta.run('default_hash', hash)
      writeMeta.run('seed_version', SEED_VERSION)
    })
    tx()
  }

  // ---- Effective reads (user overrides shadow defaults) ----

  effectiveTypes(): EffectiveBrandType[] {
    const userRows = this.db
      .query<BrandUserTypeRow, []>(
        `SELECT id, label, size_w, size_h, description, updated_at FROM brand_user_types ORDER BY id`
      )
      .all()
    const defaultRows = this.db
      .query<BrandTypeRow, []>(
        `SELECT id, label, size_w, size_h, description
         FROM brand_default_types
         WHERE id NOT IN (SELECT id FROM brand_user_types)
         ORDER BY id`
      )
      .all()

    return [
      ...userRows.map((row): EffectiveBrandType => ({
        id: row.id,
        label: row.label,
        size: encodeSize(row.size_w, row.size_h),
        description: row.description ?? undefined,
        layer: 'user',
        updated_at: row.updated_at
      })),
      ...defaultRows.map((row): EffectiveBrandType => ({
        id: row.id,
        label: row.label,
        size: encodeSize(row.size_w, row.size_h),
        description: row.description ?? undefined,
        layer: 'default'
      }))
    ]
  }

  effectiveProfiles(): EffectiveBrandProfile[] {
    const userRows = this.db
      .query<BrandUserProfileRow, []>(
        `SELECT id, label, applicable_to, markdown, updated_at FROM brand_user_profiles ORDER BY id`
      )
      .all()
    const defaultRows = this.db
      .query<BrandProfileRow, []>(
        `SELECT id, label, applicable_to, markdown
         FROM brand_default_profiles
         WHERE id NOT IN (SELECT id FROM brand_user_profiles)
         ORDER BY id`
      )
      .all()

    return [
      ...userRows.map((row) => ({
        id: row.id,
        label: row.label,
        applicable_to: JSON.parse(row.applicable_to) as string[],
        markdown: row.markdown,
        layer: 'user' as const,
        updated_at: row.updated_at
      })),
      ...defaultRows.map((row) => ({
        id: row.id,
        label: row.label,
        applicable_to: JSON.parse(row.applicable_to) as string[],
        markdown: row.markdown,
        layer: 'default' as const
      }))
    ]
  }

  effectiveConfig(): EffectiveBrandConfig {
    return {
      schema_version: 1,
      name: this.db
        .query<{ value: string }, []>(`SELECT value FROM brand_meta WHERE key = 'name'`)
        .get()?.value ?? 'OpenPencil Brand',
      types: this.effectiveTypes(),
      profiles: this.effectiveProfiles()
    }
  }

  // ---- User-layer writes ----

  upsertUserType(type: BrandType): void {
    const { width, height } = resolveSize(type.size)
    this.db
      .prepare(
        `INSERT INTO brand_user_types (id, label, size_w, size_h, description, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           size_w = excluded.size_w,
           size_h = excluded.size_h,
           description = excluded.description,
           updated_at = excluded.updated_at`
      )
      .run(type.id, type.label, width, height, type.description ?? null, Date.now())
  }

  upsertUserProfile(profile: BrandProfile): void {
    this.db
      .prepare(
        `INSERT INTO brand_user_profiles (id, label, applicable_to, markdown, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           applicable_to = excluded.applicable_to,
           markdown = excluded.markdown,
           updated_at = excluded.updated_at`
      )
      .run(profile.id, profile.label, JSON.stringify(profile.applicable_to), profile.markdown, Date.now())
  }

  deleteUserType(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM brand_user_types WHERE id = ?`).run(id)
    return result.changes > 0
  }

  deleteUserProfile(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM brand_user_profiles WHERE id = ?`).run(id)
    return result.changes > 0
  }

  /** Reset (clear) the user layer; default_* is untouched. */
  resetUserLayer(): void {
    const tx = this.db.transaction(() => {
      this.db.exec('DELETE FROM brand_user_types')
      this.db.exec('DELETE FROM brand_user_profiles')
    })
    tx()
  }

  /** Replace the entire user layer with the supplied config (whole-file import). */
  importUserLayer(config: BrandConfig): void {
    const tx = this.db.transaction(() => {
      this.db.exec('DELETE FROM brand_user_types')
      this.db.exec('DELETE FROM brand_user_profiles')
      for (const type of config.types) this.upsertUserType(type)
      for (const profile of config.profiles) this.upsertUserProfile(profile)
    })
    tx()
  }

  /** Counts for the `/v1/brand/metadata` endpoint. */
  counts(): { defaultTypes: number; defaultProfiles: number; userTypes: number; userProfiles: number } {
    const VALID_TABLES = new Set([
      'brand_default_types',
      'brand_default_profiles',
      'brand_user_types',
      'brand_user_profiles'
    ])
    const count = (table: string): number => {
      if (!VALID_TABLES.has(table)) return 0
      return this.db.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0
    }
    return {
      defaultTypes: count('brand_default_types'),
      defaultProfiles: count('brand_default_profiles'),
      userTypes: count('brand_user_types'),
      userProfiles: count('brand_user_profiles')
    }
  }
}

export function openBrandRepository(opts: BrandRepositoryOptions): BrandRepository {
  // SQLite opens the file but won't create missing parent directories. For
  // the default `~/.openpencil/brand.db` path the directory may not exist
  // on a fresh install — `mkdirSync(recursive: true)` is the canonical fix.
  // `:memory:` (tests) and explicit overrides skip the mkdir.
  if (opts.path !== ':memory:') {
    try {
      mkdirSync(dirname(opts.path), { recursive: true })
    } catch (error) {
      // Surface a clear error if the parent is not writable (e.g. when HOME
      // points at an unwritable sandbox in some CI environments).
      throw new Error(
        `Cannot create brand config directory at ${dirname(opts.path)}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
  const db = new Database(opts.path, { create: true })
  const repo = new BrandRepository(db)
  repo.dbPath = opts.path
  if (opts.seed) repo.seed(opts.seed)
  return repo
}

function encodeSize(width: number, height: number | null): SizeString {
  return height === null ? `${width}x` : `${width}x${height}`
}