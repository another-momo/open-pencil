import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { cloneSubtreeAcrossGraphs } from '#core/tools/marketing/clone'

import { expectDefined } from '#tests/helpers/assert'

function makeSource() {
  const source = new SceneGraph()
  const pageId = source.getPages()[0].id
  return { source, pageId }
}

describe('cloneSubtreeAcrossGraphs', () => {
  test('clones a frame subtree with fresh ids and deep-copied props', () => {
    const { source, pageId } = makeSource()
    const frame = source.createNode('FRAME', pageId, { name: 'ref', width: 100, height: 200 })
    const text = source.createNode('TEXT', frame.id, { name: 'title', text: '你好' })
    source.updateNode(text.id, { fontSize: 24 })

    const target = new SceneGraph()
    const targetPageId = target.getPages()[0].id
    const result = cloneSubtreeAcrossGraphs(source, frame.id, target, targetPageId)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    const clone = expectDefined(target.getNode(result.rootId))
    expect(clone.id).not.toBe(frame.id)
    expect(clone.name).toBe('ref')
    expect(clone.width).toBe(100)
    expect(clone.height).toBe(200)
    expect(clone.parentId).toBe(targetPageId)

    const cloneText = expectDefined(target.getNode(clone.childIds[0]))
    expect(cloneText.text).toBe('你好')
    expect(cloneText.fontSize).toBe(24)

    // Deep copy: mutating the clone's fills must not touch the source
    cloneText.fills[0].color = { r: 1, g: 0, b: 0, a: 1 }
    expect(source.getNode(text.id)?.fills[0].color).not.toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })

  test('clones a COMPONENT subtree preserving type and structure', () => {
    const { source, pageId } = makeSource()
    const comp = source.createNode('COMPONENT', pageId, { name: 'BrandBar' })
    source.createNode('RECTANGLE', comp.id, { name: 'logo', width: 40, height: 40 })
    source.createNode('TEXT', comp.id, { name: 'brandName', text: '品牌名' })

    const target = new SceneGraph()
    const result = cloneSubtreeAcrossGraphs(source, comp.id, target, target.getPages()[0].id)
    expect('error' in result).toBe(false)
    if ('error' in result) return

    const clone = expectDefined(target.getNode(result.rootId))
    expect(clone.type).toBe('COMPONENT')
    expect(clone.childIds).toHaveLength(2)
    expect(target.getNode(clone.childIds[0])?.name).toBe('logo')
    expect(target.getNode(clone.childIds[1])?.name).toBe('brandName')
  })

  test('carries image bytes for IMAGE fills using the same content hash', () => {
    const { source, pageId } = makeSource()
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const hash = 'abc123'
    source.images.set(hash, bytes)
    const rect = source.createNode('RECTANGLE', pageId, {
      name: 'img',
      fills: [
        {
          type: 'IMAGE',
          color: { r: 1, g: 1, b: 1, a: 1 },
          imageHash: hash,
          imageScaleMode: 'FILL',
          visible: true,
          opacity: 1
        }
      ]
    })

    const target = new SceneGraph()
    const result = cloneSubtreeAcrossGraphs(source, rect.id, target, target.getPages()[0].id)
    expect('error' in result).toBe(false)

    expect(target.images.get(hash)).toEqual(bytes)
  })

  test('rejects subtrees containing nested instances', () => {
    const { source, pageId } = makeSource()
    const comp = source.createNode('COMPONENT', pageId, { name: 'Base' })
    const frame = source.createNode('FRAME', pageId, { name: 'Host' })
    const instance = source.createInstance(comp.id, frame.id, {})
    expect(instance).toBeDefined()

    const target = new SceneGraph()
    const result = cloneSubtreeAcrossGraphs(source, frame.id, target, target.getPages()[0].id)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('nested instance')
  })

  test('rejects subtrees containing variable-bound nodes', () => {
    const { source, pageId } = makeSource()
    const frame = source.createNode('FRAME', pageId, { name: 'bound' })
    source.updateNode(frame.id, { boundVariables: { fills: 'var-1' } })

    const target = new SceneGraph()
    const result = cloneSubtreeAcrossGraphs(source, frame.id, target, target.getPages()[0].id)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toContain('variable')
  })

  test('strips a dangling componentId from clones so the target graph never sees a broken link', () => {
    const { source, pageId } = makeSource()
    const comp = source.createNode('COMPONENT', pageId, { name: 'MyComp' })
    source.createNode('RECTANGLE', comp.id, { name: 'logo', width: 40, height: 40 })
    // Simulate a node that was copied from an instance at some point and
    // still carries a componentId pointing back into the source graph.
    const orphan = source.createNode('FRAME', pageId, { name: 'hasComponentId' })
    source.updateNode(orphan.id, { componentId: comp.id })

    const target = new SceneGraph()
    const result = cloneSubtreeAcrossGraphs(source, orphan.id, target, target.getPages()[0].id)
    expect('error' in result).toBe(false)
    if ('error' in result) return
    const clone = expectDefined(target.getNode(result.rootId))
    expect(clone.componentId).toBeFalsy()
  })

  test('reports missing source node and target parent', () => {
    const { source } = makeSource()
    const target = new SceneGraph()
    const missing = cloneSubtreeAcrossGraphs(source, 'nope', target, target.getPages()[0].id)
    expect('error' in missing).toBe(true)

    const frame = source.createNode('FRAME', source.getPages()[0].id, { name: 'x' })
    const noParent = cloneSubtreeAcrossGraphs(source, frame.id, target, 'nope')
    expect('error' in noParent).toBe(true)
  })
})
