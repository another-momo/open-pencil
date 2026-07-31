import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import {
  getDefaultLibrary,
  getLibrarySession,
  injectLibraryReferences,
  MATERIALS_PAGE_NAME,
  parseLibraryIndex,
  setDefaultLibrary,
  setLibrarySession
} from '#core/tools/marketing/library'
import { libraryReferenceId } from '#core/tools/marketing/restore'

import { expectDefined } from '#tests/helpers/assert'
import { attachMiniLibrary } from '#tests/helpers/marketing-library'

function kv(graph: SceneGraph, parentId: string, line: string) {
  graph.createNode('TEXT', parentId, { text: line })
}

function makeLibrary() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  const types = graph.createNode('FRAME', pageId, { name: 'Types' })
  const moments = graph.createNode('FRAME', types.id, { name: 'wechat_moments' })
  kv(graph, moments.id, 'id: wechat_moments')
  kv(graph, moments.id, 'label: 朋友圈广告')
  kv(graph, moments.id, 'size: 1080x1080')
  const productLong = graph.createNode('FRAME', types.id, { name: 'product_long' })
  kv(graph, productLong.id, 'label: 产品长图')
  kv(graph, productLong.id, 'size: 750x')
  kv(graph, productLong.id, 'anchor_first: BrandBar')
  kv(graph, productLong.id, 'anchor_last: CTABar')
  kv(graph, productLong.id, 'description: 高端叙事')

  const profiles = graph.createNode('FRAME', pageId, { name: 'Profiles' })
  const casual = graph.createNode('FRAME', profiles.id, { name: 'casual_v1' })
  kv(graph, casual.id, '# 休闲风格\n配色轻松活泼')
  kv(graph, casual.id, 'applicable_to: wechat_moments, product_long')

  const components = graph.createNode('FRAME', pageId, { name: 'Components' })
  const brandBar = graph.createNode('COMPONENT', components.id, { name: 'BrandBar' })
  kv(graph, brandBar.id, 'readonly: logo, brandName')
  graph.createNode('COMPONENT', components.id, { name: 'CTABar' })

  const references = graph.createNode('FRAME', pageId, { name: 'References' })
  const ref = graph.createNode('FRAME', references.id, { name: 'ref-product-long-001' })
  kv(graph, ref.id, 'for: product_long')
  kv(graph, ref.id, 'tag: luxury_v1, casual_v1')

  return { graph, pageId }
}

describe('parseLibraryIndex', () => {
  test('parses all four zones into a LibraryIndex', () => {
    const { graph } = makeLibrary()
    const index = parseLibraryIndex(graph)
    expect(index.warnings).toEqual([])

    expect(index.types).toHaveLength(2)
    const moments = expectDefined(index.types.find((t) => t.id === 'wechat_moments'))
    expect(moments.label).toBe('朋友圈广告')
    expect(moments.size).toEqual({ width: 1080, height: 1080 })
    expect(moments.anchors).toEqual([])

    const productLong = expectDefined(index.types.find((t) => t.id === 'product_long'))
    expect(productLong.size).toEqual({ width: 750, height: null })
    expect(productLong.description).toBe('高端叙事')
    expect(productLong.anchors).toEqual([
      { template: 'BrandBar', position: 'top' },
      { template: 'CTABar', position: 'bottom' }
    ])

    expect(index.profiles).toHaveLength(1)
    expect(index.profiles[0].id).toBe('casual_v1')
    expect(index.profiles[0].markdown).toContain('休闲风格')
    expect(index.profiles[0].applicableTo).toEqual(['wechat_moments', 'product_long'])

    expect(index.components.map((c) => c.name)).toEqual(['BrandBar', 'CTABar'])
    expect(index.components[0].readonlyNames).toEqual(['logo', 'brandName'])
    expect(index.components[1].readonlyNames).toEqual([])

    expect(index.references).toHaveLength(1)
    expect(index.references[0].for).toBe('product_long')
    expect(index.references[0].tags).toEqual(['luxury_v1', 'casual_v1'])
  })

  test('malformed size skips the type with a warning', () => {
    const graph = new SceneGraph()
    const types = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Types' })
    const bad = graph.createNode('FRAME', types.id, { name: 'bad' })
    kv(graph, bad.id, 'size: abc')

    const index = parseLibraryIndex(graph)
    expect(index.types).toHaveLength(0)
    expect(index.warnings.some((w) => w.includes('bad') && w.includes('size'))).toBe(true)
  })

  test('duplicate ids keep the first entry with a warning', () => {
    const graph = new SceneGraph()
    const types = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Types' })
    for (const label of ['一', '二']) {
      const frame = graph.createNode('FRAME', types.id, { name: 'dup' })
      kv(graph, frame.id, `label: ${label}`)
      kv(graph, frame.id, 'size: 100x100')
    }

    const index = parseLibraryIndex(graph)
    expect(index.types).toHaveLength(1)
    expect(index.types[0].label).toBe('一')
    expect(index.warnings.some((w) => w.includes('duplicate'))).toBe(true)
  })

  test('unknown keys and anchor misses produce warnings', () => {
    const graph = new SceneGraph()
    const types = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Types' })
    const frame = graph.createNode('FRAME', types.id, { name: 't' })
    kv(graph, frame.id, 'size: 100x100')
    kv(graph, frame.id, 'bogus: 1')
    kv(graph, frame.id, 'anchor_first: Missing')

    const index = parseLibraryIndex(graph)
    expect(index.warnings.some((w) => w.includes('unknown key "bogus"'))).toBe(true)
    expect(index.warnings.some((w) => w.includes('"Missing" not found in Components'))).toBe(true)
    expect(index.types[0].anchors).toEqual([{ template: 'Missing', position: 'top' }])
  })

  test('missing zones are tolerated with warnings', () => {
    const graph = new SceneGraph()
    const index = parseLibraryIndex(graph)
    expect(index.types).toEqual([])
    expect(index.warnings.filter((w) => w.includes('no "'))).toHaveLength(4)
  })

  test('non-COMPONENT entries in the Components zone are skipped', () => {
    const graph = new SceneGraph()
    const components = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Components' })
    graph.createNode('FRAME', components.id, { name: 'NotAComponent' })

    const index = parseLibraryIndex(graph)
    expect(index.components).toHaveLength(0)
    expect(index.warnings.some((w) => w.includes('not a COMPONENT'))).toBe(true)
  })
})

describe('injectLibraryReferences', () => {
  test('clones a reference onto the 参考区 page with a marker, deduped per session', () => {
    const doc = new SceneGraph()
    attachMiniLibrary(doc)

    const first = injectLibraryReferences(doc, ['ref-product-long-001'])
    expect(first.errors).toEqual([])
    expect(first.injected).toHaveLength(1)

    const nodeId = first.injected[0].nodeId
    const node = expectDefined(doc.getNode(nodeId))
    const page = expectDefined(doc.getPages().find((p) => p.name === MATERIALS_PAGE_NAME))
    expect(node.parentId).toBe(page.id)
    expect(libraryReferenceId(node)).toBe('ref-product-long-001')

    // Second injection of the same reference returns the existing node
    const second = injectLibraryReferences(doc, ['ref-product-long-001'])
    expect(second.injected).toHaveLength(0)

    // After the user deletes it, injection re-clones
    doc.deleteNode(nodeId)
    const third = injectLibraryReferences(doc, ['ref-product-long-001'])
    expect(third.injected).toHaveLength(1)
    expect(third.injected[0].nodeId).not.toBe(nodeId)
  })

  test('unknown reference id and missing session produce errors', () => {
    const doc = new SceneGraph()
    attachMiniLibrary(doc)
    const unknown = injectLibraryReferences(doc, ['nope'])
    expect(unknown.errors[0]).toContain('nope')

    const bare = injectLibraryReferences(new SceneGraph(), ['ref-product-long-001'])
    expect(bare.errors[0]).toContain('No library')
  })
})

describe('library session registry', () => {
  test('session and default library round-trips', () => {
    const { graph, index } = (() => {
      const lib = makeLibrary()
      return { graph: lib.graph, index: parseLibraryIndex(lib.graph) }
    })()
    const doc = new SceneGraph()
    setLibrarySession(doc, { name: 'test.fig', graph, index, refInjections: new Map() })
    expect(getLibrarySession(doc)?.name).toBe('test.fig')
    expect(getLibrarySession(new SceneGraph())).toBeUndefined()

    expect(getDefaultLibrary()).toBeUndefined()
    setDefaultLibrary(new Uint8Array([1]), 'default-library.fig')
    expect(getDefaultLibrary()?.name).toBe('default-library.fig')
  })
})
