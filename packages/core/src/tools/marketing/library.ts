/**
 * Library .fig scan/parse layer (docs/plans/l2-resource-library.md §4).
 *
 * A library is a plain .fig with four top-level pages — Types / Profiles /
 * Components / References — located by exact name match, no pluginData.
 * Page entries carry their metadata as plain TEXT children (`key: value`
 * lines; profiles carry one markdown TEXT instead). All parsing happens
 * once at scan time and produces a LibraryIndex plus a warnings list:
 * malformed entries never throw, they are skipped and reported so the
 * agent can tell the user exactly what to fix.
 *
 * LibrarySession keeps the parsed library (graph + index) alive for a
 * working document's marketing session; the default library ships as
 * build-time bytes that the app injects at startup (Q11).
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { computeAllLayouts } from '#core/layout'
import { cloneSubtreeAcrossGraphs } from '#core/tools/marketing/clone'
import { markLibraryReference } from '#core/tools/marketing/restore'

export interface LibraryType {
  id: string
  label: string
  description?: string
  size: { width: number; height: number | null }
  anchors: { template: string; position: 'top' | 'bottom' }[]
  /** Frame id in the library graph */
  nodeId: string
}

export interface LibraryProfile {
  id: string
  markdown: string
  applicableTo: string[]
  nodeId: string
}

export interface LibraryComponent {
  name: string
  /** COMPONENT node id in the library graph */
  nodeId: string
  readonlyNames: string[]
}

export interface LibraryReference {
  id: string
  for?: string
  tags: string[]
  nodeId: string
}

export interface LibraryIndex {
  types: LibraryType[]
  profiles: LibraryProfile[]
  components: LibraryComponent[]
  references: LibraryReference[]
  warnings: string[]
}

export interface LibrarySession {
  name: string
  graph: SceneGraph
  index: LibraryIndex
  /** libraryRefId → documentNodeId — 参考区 injection dedup (§5) */
  refInjections: Map<string, string>
}

const ZONE_TYPES = 'Types'
const ZONE_PROFILES = 'Profiles'
const ZONE_COMPONENTS = 'Components'
const ZONE_REFERENCES = 'References'

const KV_RE = /^([A-Za-z_]+)\s*:\s*(.*)$/
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d*(?:\.\d+)?)$/i

function textChildren(node: SceneNode, graph: SceneGraph): SceneNode[] {
  return node.childIds
    .map((id) => graph.getNode(id))
    .filter((child): child is SceneNode => child?.type === 'TEXT')
}

/** Collect `key: value` lines from every TEXT child (multi-line tolerated) */
function parseKeyValueLines(
  node: SceneNode,
  graph: SceneGraph,
  onDuplicateKey?: (key: string) => void
): Map<string, string[]> {
  const fields = new Map<string, string[]>()
  for (const text of textChildren(node, graph)) {
    for (const line of text.text.split(/\r?\n/)) {
      const match = KV_RE.exec(line.trim())
      if (!match) continue
      const key = match[1].toLowerCase()
      if (fields.has(key)) onDuplicateKey?.(key)
      const list = fields.get(key) ?? []
      list.push(match[2].trim())
      fields.set(key, list)
    }
  }
  return fields
}

function parseSize(raw: string): { width: number; height: number | null } | undefined {
  const match = SIZE_RE.exec(raw.trim())
  if (!match) return undefined
  const width = Number(match[1])
  if (!Number.isFinite(width) || width <= 0) return undefined
  const height = match[2] === '' ? null : Number(match[2])
  if (height !== null && (!Number.isFinite(height) || height <= 0)) return undefined
  return { width, height }
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const TYPE_KEYS = new Set(['id', 'label', 'size', 'description', 'anchor_first', 'anchor_last'])

/**
 * Shared zone-entry iteration with first-wins dedupe. `keyOf` derives the
 * entry's dedupe id; `handle` parses one accepted entry.
 */
function forEachZoneEntry(
  zone: SceneNode,
  graph: SceneGraph,
  index: LibraryIndex,
  keyOf: (frame: SceneNode, fields: Map<string, string[]>) => string,
  handle: (frame: SceneNode, fields: Map<string, string[]>) => void
): void {
  const seen = new Set<string>()
  for (const frameId of zone.childIds) {
    const frame = graph.getNode(frameId)
    if (!frame) continue
    const fields = parseKeyValueLines(frame, graph, (key) =>
      index.warnings.push(`${zone.name}/${frame.name}: duplicate key "${key}" — later lines win`)
    )
    const id = keyOf(frame, fields)
    if (seen.has(id)) {
      index.warnings.push(`${zone.name}/${id}: duplicate id — first entry wins`)
      continue
    }
    seen.add(id)
    handle(frame, fields)
  }
}

function warnUnknownKeys(
  zone: SceneNode,
  frame: SceneNode,
  fields: Map<string, string[]>,
  allowed: ReadonlySet<string>,
  index: LibraryIndex
): void {
  for (const key of fields.keys()) {
    if (!allowed.has(key)) {
      index.warnings.push(`${zone.name}/${frame.name}: unknown key "${key}" ignored`)
    }
  }
}

function parseTypes(zone: SceneNode, graph: SceneGraph, index: LibraryIndex): void {
  forEachZoneEntry(
    zone,
    graph,
    index,
    (frame, fields) => fields.get('id')?.[0] || frame.name,
    (frame, fields) => {
      warnUnknownKeys(zone, frame, fields, TYPE_KEYS, index)
      const id = fields.get('id')?.[0] || frame.name

      const sizeRaw = fields.get('size')?.[0]
      const size = sizeRaw ? parseSize(sizeRaw) : undefined
      if (!size) {
        index.warnings.push(
          `Types/${id}: missing or malformed size (expected e.g. "size: 1080x1080" or "size: 750x" for variable height) — type skipped`
        )
        return
      }

      const anchors: LibraryType['anchors'] = []
      const first = fields.get('anchor_first')?.[0]
      if (first) anchors.push({ template: first, position: 'top' })
      const last = fields.get('anchor_last')?.[0]
      if (last) anchors.push({ template: last, position: 'bottom' })

      const description = fields.get('description')?.[0]
      index.types.push({
        id,
        label: fields.get('label')?.[0] || frame.name,
        ...(description ? { description } : {}),
        size,
        anchors,
        nodeId: frame.id
      })
    }
  )
}

function parseProfiles(zone: SceneNode, graph: SceneGraph, index: LibraryIndex): void {
  forEachZoneEntry(
    zone,
    graph,
    index,
    (frame) => frame.name,
    (frame) => {
      const markdownParts: string[] = []
      let applicableTo: string[] = []
      for (const text of textChildren(frame, graph)) {
        const content = text.text.trim()
        const meta = /^applicable_to\s*:\s*(.*)$/i.exec(content)
        if (meta) applicableTo = splitList(meta[1])
        else if (content.length > 0) markdownParts.push(text.text)
      }

      if (markdownParts.length === 0) {
        index.warnings.push(`Profiles/${frame.name}: no markdown text — profile has no content`)
      }
      index.profiles.push({
        id: frame.name,
        markdown: markdownParts.join('\n\n'),
        applicableTo,
        nodeId: frame.id
      })
    }
  )
}

function parseComponents(zone: SceneNode, graph: SceneGraph, index: LibraryIndex): void {
  forEachZoneEntry(
    zone,
    graph,
    index,
    (frame) => frame.name,
    (frame) => {
      if (frame.type !== 'COMPONENT') {
        index.warnings.push(`Components/${frame.name}: not a COMPONENT node — skipped`)
        return
      }

      let readonlyNames: string[] = []
      for (const text of textChildren(frame, graph)) {
        const marker = /^readonly\s*:\s*(.*)$/i.exec(text.text.trim())
        if (marker) readonlyNames = splitList(marker[1])
      }
      index.components.push({ name: frame.name, nodeId: frame.id, readonlyNames })
    }
  )
}

const REFERENCE_KEYS = new Set(['for', 'tag'])

function parseReferences(zone: SceneNode, graph: SceneGraph, index: LibraryIndex): void {
  forEachZoneEntry(
    zone,
    graph,
    index,
    (frame) => frame.name,
    (frame, fields) => {
      warnUnknownKeys(zone, frame, fields, REFERENCE_KEYS, index)

      const forValue = fields.get('for')?.[0]
      index.references.push({
        id: frame.name,
        ...(forValue ? { for: forValue } : {}),
        tags: (fields.get('tag') ?? []).flatMap(splitList),
        nodeId: frame.id
      })
    }
  )
}

function findZone(graph: SceneGraph, name: string): SceneNode | undefined {
  for (const page of graph.getPages()) {
    if (page.name.trim() === name) return page
  }
  return undefined
}

export function parseLibraryIndex(graph: SceneGraph): LibraryIndex {
  const index: LibraryIndex = {
    types: [],
    profiles: [],
    components: [],
    references: [],
    warnings: []
  }

  const zones: Array<[string, (zone: SceneNode, graph: SceneGraph, index: LibraryIndex) => void]> =
    [
      [ZONE_TYPES, parseTypes],
      [ZONE_PROFILES, parseProfiles],
      [ZONE_COMPONENTS, parseComponents],
      [ZONE_REFERENCES, parseReferences]
    ]
  for (const [name, parse] of zones) {
    const zone = findZone(graph, name)
    if (!zone) {
      index.warnings.push(`Library has no "${name}" page — treated as empty`)
      continue
    }
    parse(zone, graph, index)
  }

  const componentNames = new Set(index.components.map((component) => component.name))
  for (const type of index.types) {
    for (const anchor of type.anchors) {
      if (!componentNames.has(anchor.template)) {
        index.warnings.push(
          `Types/${type.id}: anchor "${anchor.template}" not found in Components page`
        )
      }
    }
  }

  return index
}

/** Parse a Library .fig/.pen file into a detached graph plus its index */
export async function loadLibrary(
  bytes: Uint8Array,
  name: string
): Promise<{ graph: SceneGraph; index: LibraryIndex }> {
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  const { graph } = await io.readDocument({ name, data: bytes })
  computeAllLayouts(graph)
  return { graph, index: parseLibraryIndex(graph) }
}

// --- Session registry (per working document) + default library (Q11) ---

const sessions = new WeakMap<SceneGraph, LibrarySession>()

export function getLibrarySession(graph: SceneGraph): LibrarySession | undefined {
  return sessions.get(graph)
}

export function setLibrarySession(graph: SceneGraph, session: LibrarySession): void {
  sessions.set(graph, session)
}

let defaultLibrary: { bytes: Uint8Array; name: string } | undefined

/** App startup hook: register the shipped default-library.fig bytes */
export function setDefaultLibrary(bytes: Uint8Array, name: string): void {
  defaultLibrary = { bytes, name }
}

export function getDefaultLibrary(): { bytes: Uint8Array; name: string } | undefined {
  return defaultLibrary
}

// --- Reference injection into the 参考区 page (§5) ---

export const MATERIALS_PAGE_NAME = '参考区'

export function ensureMaterialsPage(graph: SceneGraph): string {
  const found = graph.getPages().find((page) => page.name === MATERIALS_PAGE_NAME)
  if (found) return found.id
  return graph.addPage(MATERIALS_PAGE_NAME).id
}

export interface InjectReferencesResult {
  injected: { refId: string; nodeId: string }[]
  errors: string[]
}

/**
 * Clone library references into the document's 参考区 page, deduped via the
 * session's refInjections map (re-inject only after the user deleted the
 * node). Callers wrap this with layout/undo/render concerns.
 */
export function injectLibraryReferences(
  graph: SceneGraph,
  refIds: string[]
): InjectReferencesResult {
  const result: InjectReferencesResult = { injected: [], errors: [] }
  const session = getLibrarySession(graph)
  if (!session) {
    result.errors.push('No library loaded')
    return result
  }

  const pageId = ensureMaterialsPage(graph)
  for (const refId of refIds) {
    const existing = session.refInjections.get(refId)
    if (existing && graph.getNode(existing)) continue

    const reference = session.index.references.find((entry) => entry.id === refId)
    if (!reference) {
      result.errors.push(`Reference "${refId}" not found in library "${session.name}"`)
      continue
    }
    const clone = cloneSubtreeAcrossGraphs(session.graph, reference.nodeId, graph, pageId)
    if ('error' in clone) {
      result.errors.push(clone.error)
      continue
    }
    markLibraryReference(graph, clone.rootId, refId)
    session.refInjections.set(refId, clone.rootId)
    result.injected.push({ refId, nodeId: clone.rootId })
  }
  return result
}
