/**
 * Brand config YAML loader.
 *
 * The default brand config ships at `public/default-brand/config.yaml` and
 * is read either from disk (dev) or from the bundled assets (prod). The
 * loader is purely functional — no I/O side effects beyond reading from the
 * provided source string, so it is unit-testable with fixture strings.
 *
 * Production code paths:
 *   - First boot: read default YAML, seed sqlite via BrandRepository
 *   - Import: parse user-supplied YAML → validate → merge into user layer
 *   - Export: stringify the effective (default + user) view
 */

import { brandConfigSchema } from './schema.js'
import type { BrandConfig } from './types.js'

export interface BrandParseSuccess {
  ok: true
  config: BrandConfig
}

export interface BrandParseFailure {
  ok: false
  /** Aggregated zod issues, line-by-line when zod supplies a path. */
  issues: { path: string; message: string }[]
}

export type BrandParseResult = BrandParseSuccess | BrandParseFailure

/** Parse a YAML document string into a validated BrandConfig. */
export function parseBrandYaml(source: string): BrandParseResult {
  let raw: unknown
  try {
    raw = parseYaml(source)
  } catch (error) {
    return {
      ok: false,
      issues: [{ path: '', message: error instanceof Error ? error.message : String(error) }]
    }
  }

  const parsed = brandConfigSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, config: parsed.data as BrandConfig }
  }

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message
    }))
  }
}

/** Stringify a BrandConfig back to YAML. Round-trip parity is required for export. */
export function stringifyBrandYaml(config: BrandConfig): string {
  return stringifyYaml(config)
}

/**
 * Minimal hand-rolled YAML subset for the brand config format — keeps the
 * dependency surface small (no `yaml` / `js-yaml`). Supports the only
 * constructs the schema emits:
 *   - top-level scalars / arrays / objects
 *   - nested objects with string / number / null leaves
 *   - block strings via the `key: |` marker (used for profile markdown)
 *   - flow-style arrays `[a, b, c]` (used for applicable_to)
 *
 * Anything more exotic (anchors, multi-doc, tags) is intentionally not
 * supported — callers should regenerate the file from the schema.
 */

type YamlScalar = string | number | null | boolean
type YamlNode = YamlScalar | YamlNode[] | { [key: string]: YamlNode }

export function parseYaml(source: string): unknown {
  const lines = source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line, index, all) => !(line.trim() === '' && (index === 0 || all[index - 1]?.trim() === '')))

  if (lines.length === 0) return null

  const first = lines[0] ?? ''
  const firstIndent = leadingSpaces(first)
  const firstTrim = first.trim()
  // Top-level scalar: must not start with `-` and must not contain `:` at indent 0.
  if (firstIndent === 0 && !firstTrim.startsWith('-') && !firstTrim.includes(':')) {
    return parseScalar(firstTrim)
  }

  return parseNode(lines, 0, -1, 'auto')
}

/**
 * State machine driven by indentation. `mode`:
 *   - 'auto': decide array vs object from the first non-blank line at this indent
 *   - 'array': each child must start with `- `
 *   - 'object': each child must be `key:` or `key: value`
 */
function parseNode(lines: string[], start: number, parentIndent: number, mode: 'auto' | 'array' | 'object'): YamlNode {
  const resolved: 'array' | 'object' = (() => {
    if (mode !== 'auto') return mode
    for (let i = start; i < lines.length; i += 1) {
      const raw = lines[i] ?? ''
      const t = raw.trim()
      if (t === '' || t.startsWith('#')) continue
      if (leadingSpaces(raw) <= parentIndent) break
      return t.startsWith('- ') ? 'array' : 'object'
    }
    return 'object'
  })()

  if (resolved === 'array') return parseArray(lines, start, parentIndent)
  return parseObject(lines, start, parentIndent)
}

function parseObject(lines: string[], start: number, parentIndent: number): { [key: string]: YamlNode } {
  const out: { [key: string]: YamlNode } = {}
  let index = start
  while (index < lines.length) {
    const raw = lines[index] ?? ''
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      index += 1
      continue
    }
    const indent = leadingSpaces(raw)
    if (indent <= parentIndent) break
    if (indent > parentIndent + 2) {
      throw new Error(`Unexpected indentation at line ${index + 1}: "${raw}"`)
    }
    const colon = trimmed.indexOf(':')
    if (colon < 0) throw new Error(`Expected "key:" at line ${index + 1}`)
    const key = trimmed.slice(0, colon).trim()
    const rest = trimmed.slice(colon + 1).trim()

    if (rest === '') {
      // `key:` — value is on subsequent indented lines.
      const block = parseNode(lines, index + 1, indent, 'auto')
      out[key] = block
      index = skipConsumed(lines, index + 1, indent)
    } else if (rest === '|') {
      out[key] = consumeBlockScalar(lines, index + 1, indent)
      index = skipConsumed(lines, index + 1, indent)
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      out[key] = parseFlowArray(rest)
      index += 1
    } else {
      out[key] = parseScalar(rest)
      index += 1
    }
  }
  return out
}

function parseArray(lines: string[], start: number, parentIndent: number): YamlNode[] {
  const out: YamlNode[] = []
  let index = start
  while (index < lines.length) {
    const raw = lines[index] ?? ''
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      index += 1
      continue
    }
    const indent = leadingSpaces(raw)
    if (indent <= parentIndent) break
    if (indent > parentIndent + 2) {
      throw new Error(`Unexpected indentation at line ${index + 1}: "${raw}"`)
    }
    if (!trimmed.startsWith('- ')) break
    const payload = trimmed.slice(2)
    if (payload === '') {
      // `-` then nested block on subsequent lines
      const block = parseNode(lines, index + 1, indent, 'auto')
      out.push(block)
      index = skipConsumed(lines, index + 1, indent)
    } else if (payload.includes(':')) {
      // Inline object start, e.g. `- id: foo`
      const colon = payload.indexOf(':')
      const key = payload.slice(0, colon).trim()
      const rest = payload.slice(colon + 1).trim()
      const obj: { [key: string]: YamlNode } = {}
      if (rest === '') {
        const block = parseNode(lines, index + 1, indent, 'auto')
        obj[key] = block
        index = skipConsumed(lines, index + 1, indent)
      } else if (rest === '|') {
        obj[key] = consumeBlockScalar(lines, index + 1, indent)
        index = skipConsumed(lines, index + 1, indent)
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        obj[key] = parseFlowArray(rest)
        index += 1
      } else {
        obj[key] = parseScalar(rest)
        index += 1
      }
      // Possible continuation lines extending the inline object
      while (index < lines.length) {
        const next = lines[index] ?? ''
        const nextTrim = next.trim()
        if (nextTrim === '' || nextTrim.startsWith('#')) {
          index += 1
          continue
        }
        const nextIndent = leadingSpaces(next)
        if (nextIndent !== indent + 2) break
        if (nextTrim.startsWith('- ')) break
        const colon2 = nextTrim.indexOf(':')
        if (colon2 < 0) break
        const k = nextTrim.slice(0, colon2).trim()
        const r = nextTrim.slice(colon2 + 1).trim()
        if (r === '') {
          const block = parseNode(lines, index + 1, nextIndent, 'auto')
          obj[k] = block
          index = skipConsumed(lines, index + 1, nextIndent)
        } else if (r === '|') {
          obj[k] = consumeBlockScalar(lines, index + 1, nextIndent)
          index = skipConsumed(lines, index + 1, nextIndent)
        } else if (r.startsWith('[') && r.endsWith(']')) {
          obj[k] = parseFlowArray(r)
          index += 1
        } else {
          obj[k] = parseScalar(r)
          index += 1
        }
      }
      out.push(obj)
    } else {
      out.push(parseScalar(payload))
      index += 1
    }
  }
  return out
}

/**
 * Skip past all lines whose indent is strictly greater than `blockIndent`,
 * so the parent loop resumes at the next sibling. Used after consuming a
 * nested block.
 */
function skipConsumed(lines: string[], start: number, blockIndent: number): number {
  let index = start
  while (index < lines.length) {
    const raw = lines[index] ?? ''
    const trimmed = raw.trim()
    if (trimmed === '') {
      index += 1
      continue
    }
    if (leadingSpaces(raw) > blockIndent) {
      index += 1
      continue
    }
    break
  }
  return index
}

function consumeBlockScalar(lines: string[], start: number, blockIndent: number): string {
  const buffer: string[] = []
  let index = start
  while (index < lines.length) {
    const raw = lines[index] ?? ''
    if (raw.trim() === '') {
      buffer.push('')
      index += 1
      continue
    }
    if (leadingSpaces(raw) <= blockIndent) break
    buffer.push(raw.slice(blockIndent + 2))
    index += 1
  }
  while (buffer.length > 0 && buffer[buffer.length - 1] === '') buffer.pop()
  return buffer.join('\n')
}

function parseFlowArray(source: string): YamlNode[] {
  const inner = source.slice(1, -1).trim()
  if (inner === '') return []
  return inner.split(',').map((part) => parseScalar(part.trim()))
}

function parseScalar(value: string): YamlScalar {
  if (value === 'null' || value === '~' || value === '') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10)
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value)
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1)
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'")
  return value
}

function leadingSpaces(line: string): number {
  let count = 0
  for (const char of line) {
    if (char === ' ') count += 1
    else break
  }
  return count
}

export function stringifyYaml(value: unknown): string {
  const root = value as { [key: string]: YamlNode }
  const lines: string[] = []
  lines.push(`schema_version: ${root.schema_version}`)
  lines.push(`name: ${quote(root.name as string)}`)
  lines.push('types:')
  for (const entry of (root.types ?? []) as YamlNode[]) {
    lines.push(...stringifyType(entry as { [key: string]: YamlNode }))
  }
  lines.push('profiles:')
  for (const entry of (root.profiles ?? []) as YamlNode[]) {
    lines.push(...stringifyProfile(entry as { [key: string]: YamlNode }))
  }
  return `${lines.join('\n')}\n`
}

function stringifyType(entry: { [key: string]: YamlNode }): string[] {
  const lines: string[] = []
  lines.push(`  - id: ${entry.id}`)
  lines.push(`    label: ${quote(entry.label as string)}`)
  lines.push(`    size: ${entry.size}`)
  const description = entry.description
  if (typeof description === 'string' && description.length > 0) {
    lines.push(`    description: ${quote(description)}`)
  }
  return lines
}

function stringifyProfile(entry: { [key: string]: YamlNode }): string[] {
  const lines: string[] = []
  lines.push(`  - id: ${entry.id}`)
  lines.push(`    label: ${quote(entry.label as string)}`)
  const applicable = (entry.applicable_to as YamlNode[]) ?? []
  lines.push(`    applicable_to: [${applicable.map((id) => String(id)).join(', ')}]`)
  lines.push('    markdown: |')
  for (const chunk of String(entry.markdown).split('\n')) {
    lines.push(`      ${chunk}`)
  }
  return lines
}

function quote(value: string): string {
  if (value === '') return '""'
  if (/^[A-Za-z0-9_ \-\u4e00-\u9fff]+$/.test(value)) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}