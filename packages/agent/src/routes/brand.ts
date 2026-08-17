/**
 * /v1/brand/* HTTP endpoints (P3).
 *
 * Endpoints:
 *   GET    /v1/brand/manifest    — effective (user + default) config
 *   GET    /v1/brand/types       — flat list of effective types
 *   GET    /v1/brand/profiles    — flat list of effective profiles
 *   PUT    /v1/brand/types/:id   — upsert user type
 *   DELETE   /v1/brand/types/:id — remove user type (falls back to default)
 *   PUT    /v1/brand/profiles/:id   — upsert user profile
 *   DELETE   /v1/brand/profiles/:id — remove user profile
 *   POST   /v1/brand/reset       — clear user layer (default preserved)
 *   GET    /v1/brand/export      — merged YAML (download)
 *   POST   /v1/brand/import      — body = YAML, replace user layer
 *   GET    /v1/brand/metadata    — counts + seed_version + db_path
 *
 * Errors are returned as `{ error: { code, message, detail? } }` with the
 * appropriate HTTP status code. The shape mirrors the agent's existing
 * /v1/chat error contract.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'

import {
  parseBrandYaml,
  stringifyBrandYaml,
  type BrandConfig,
  type BrandProfile,
  type BrandRepository,
  type BrandType
} from '../brand/index.js'

export interface BrandRouteDeps {
  repo: BrandRepository
}

const ID_RE = /^[A-Za-z0-9_]+$/

function badRequest(c: Context, code: string, message: string, detail?: unknown) {
  return c.json({ error: { code, message, ...(detail !== undefined ? { detail } : {}) } }, 400)
}

function notFound(c: Context, message: string) {
  return c.json({ error: { code: 'not_found', message } }, 404)
}

function conflict(c: Context, message: string) {
  return c.json({ error: { code: 'conflict', message } }, 409)
}

function serverError(c: Context, message: string) {
  return c.json({ error: { code: 'server_error', message } }, 500)
}

function validateType(input: unknown): BrandType | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'body must be an object' }
  const obj = input as Record<string, unknown>
  if (typeof obj.id !== 'string' || !ID_RE.test(obj.id)) {
    return { error: 'id must match /^[A-Za-z0-9_]+$/' }
  }
  if (typeof obj.label !== 'string' || obj.label.length === 0) {
    return { error: 'label must be a non-empty string' }
  }
  if (typeof obj.size !== 'string' || !/^\d+x(\d+)?$/.test(obj.size)) {
    return { error: 'size must look like "1080x1080" or "750x"' }
  }
  const out: BrandType = {
    id: obj.id,
    label: obj.label,
    size: obj.size as `${number}x${number}` | `${number}x`
  }
  if (typeof obj.description === 'string') out.description = obj.description
  return out
}

function validateProfile(input: unknown): BrandProfile | { error: string } {
  if (!input || typeof input !== 'object') return { error: 'body must be an object' }
  const obj = input as Record<string, unknown>
  if (typeof obj.id !== 'string' || !ID_RE.test(obj.id)) {
    return { error: 'id must match /^[A-Za-z0-9_]+$/' }
  }
  if (typeof obj.label !== 'string' || obj.label.length === 0) {
    return { error: 'label must be a non-empty string' }
  }
  if (!Array.isArray(obj.applicable_to) || !obj.applicable_to.every((entry) => typeof entry === 'string')) {
    return { error: 'applicable_to must be a string[]' }
  }
  if (typeof obj.markdown !== 'string' || obj.markdown.length === 0) {
    return { error: 'markdown must be a non-empty string' }
  }
  return {
    id: obj.id,
    label: obj.label,
    applicable_to: obj.applicable_to as string[],
    markdown: obj.markdown
  }
}

export function brandRoute(deps: BrandRouteDeps): Hono {
  const app = new Hono()
  const { repo } = deps

  app.get('/manifest', (c) => c.json(repo.effectiveConfig()))

  app.get('/types', (c) => c.json({ types: repo.effectiveTypes() }))

  app.get('/profiles', (c) => c.json({ profiles: repo.effectiveProfiles() }))

  app.put('/types/:id', async (c) => {
    const id = c.req.param('id')
    if (!ID_RE.test(id)) return badRequest(c, 'invalid_id', 'id must match /^[A-Za-z0-9_]+$/')
    let body: unknown
    try {
      body = await c.req.json()
    } catch (e) {
      return badRequest(c, 'invalid_json', e instanceof Error ? e.message : String(e))
    }
    if (!body || typeof body !== 'object') return badRequest(c, 'invalid_body', 'body must be an object')
    const merged = { ...(body as Record<string, unknown>), id }
    const parsed = validateType(merged)
    if ('error' in parsed) return badRequest(c, 'invalid_type', parsed.error)
    repo.upsertUserType(parsed)
    return c.json({ type: repo.effectiveTypes().find((entry) => entry.id === id) })
  })

  app.delete('/types/:id', (c) => {
    const id = c.req.param('id')
    const removed = repo.deleteUserType(id)
    if (!removed) {
      // Either there was no user override (default is immutable) or id is unknown.
      const exists = repo.effectiveTypes().some((entry) => entry.id === id)
      if (!exists) return notFound(c, `type "${id}" not found`)
      return conflict(c, `type "${id}" is part of the default brand and cannot be deleted; only overridden`)
    }
    return c.json({ ok: true })
  })

  app.put('/profiles/:id', async (c) => {
    const id = c.req.param('id')
    if (!ID_RE.test(id)) return badRequest(c, 'invalid_id', 'id must match /^[A-Za-z0-9_]+$/')
    let body: unknown
    try {
      body = await c.req.json()
    } catch (e) {
      return badRequest(c, 'invalid_json', e instanceof Error ? e.message : String(e))
    }
    if (!body || typeof body !== 'object') return badRequest(c, 'invalid_body', 'body must be an object')
    const merged = { ...(body as Record<string, unknown>), id }
    const parsed = validateProfile(merged)
    if ('error' in parsed) return badRequest(c, 'invalid_profile', parsed.error)
    repo.upsertUserProfile(parsed)
    return c.json({ profile: repo.effectiveProfiles().find((entry) => entry.id === id) })
  })

  app.delete('/profiles/:id', (c) => {
    const id = c.req.param('id')
    const removed = repo.deleteUserProfile(id)
    if (!removed) {
      const exists = repo.effectiveProfiles().some((entry) => entry.id === id)
      if (!exists) return notFound(c, `profile "${id}" not found`)
      return conflict(c, `profile "${id}" is part of the default brand and cannot be deleted; only overridden`)
    }
    return c.json({ ok: true })
  })

  app.post('/reset', (c) => {
    repo.resetUserLayer()
    return c.json({ ok: true })
  })

  app.get('/export', (c) => {
    const merged: BrandConfig = {
      schema_version: 1,
      name: repo.effectiveConfig().name,
      types: repo.effectiveTypes().map(({ id, label, size, description }) => ({
        id,
        label,
        size,
        ...(description ? { description } : {})
      })),
      profiles: repo.effectiveProfiles().map(({ id, label, applicable_to, markdown }) => ({
        id,
        label,
        applicable_to,
        markdown
      }))
    }
    const yaml = stringifyBrandYaml(merged)
    return new Response(yaml, {
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="brand-config.yaml"'
      }
    })
  })

  app.post('/import', async (c) => {
    let source: string
    const contentType = c.req.header('content-type') ?? ''
    try {
      if (contentType.includes('application/json')) {
        const body = (await c.req.json()) as { yaml?: string }
        if (typeof body.yaml !== 'string') {
          return badRequest(c, 'invalid_body', 'JSON body must include a "yaml" string field')
        }
        source = body.yaml
      } else {
        source = await c.req.text()
      }
    } catch (e) {
      return badRequest(c, 'invalid_body', e instanceof Error ? e.message : String(e))
    }
    const parsed = parseBrandYaml(source)
    if (!parsed.ok) {
      return badRequest(c, 'invalid_yaml', 'YAML validation failed', parsed.issues)
    }
    try {
      repo.importUserLayer(parsed.config)
    } catch (e) {
      return serverError(c, e instanceof Error ? e.message : String(e))
    }
    return c.json({ ok: true, config: repo.effectiveConfig() })
  })

  app.get('/metadata', (c) =>
    c.json({
      seed_version: repo.metaValue('seed_version') ?? null,
      db_path: repo.dbPath,
      counts: repo.counts()
    })
  )

  return app
}