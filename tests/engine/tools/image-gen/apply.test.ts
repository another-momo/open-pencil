import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

import { createImageFill } from '#core/tools/image-fill'
import { generateOne } from '#core/tools/image-gen/apply'
import type { ImageGenProvider, ImageGenRequest } from '#core/tools/image-gen/providers'

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function setup() {
  const graph = new SceneGraph()
  graph.addPage('Test')
  const figma = new FigmaAPI(graph)
  return { graph, figma }
}

function fakeProvider() {
  const calls: Array<{ req: ImageGenRequest; images?: Uint8Array[] }> = []
  const provider: ImageGenProvider = {
    name: 'fake',
    async generate(req, images) {
      calls.push({ req, images })
      return { bytes: PNG_MAGIC, width: req.width ?? 1024, height: req.height ?? 1024 }
    }
  }
  return { calls, provider }
}

function createImageNode(figma: FigmaAPI, name: string, bytes: Uint8Array) {
  const node = figma.createFrame()
  node.name = name
  node.resize(200, 100)
  node.fills = [createImageFill(figma, bytes)]
  return node
}

describe('generateOne', () => {
  test('target node with IMAGE fill but no references → generations semantics (decoupled)', async () => {
    const { figma } = setup()
    const target = createImageNode(figma, 'target', PNG_MAGIC)
    const { calls, provider } = fakeProvider()

    await generateOne(figma, provider, { id: target.id, prompt: 'replace entirely' })

    expect(calls).toHaveLength(1)
    expect(calls[0].images).toBeUndefined()
  })

  test('references are extracted in declaration order', async () => {
    const { figma } = setup()
    const bytesA = new Uint8Array([1, 2, 3])
    const bytesB = new Uint8Array([4, 5, 6])
    const nodeA = createImageNode(figma, 'A', bytesA)
    const nodeB = createImageNode(figma, 'B', bytesB)
    const { calls, provider } = fakeProvider()

    await generateOne(figma, provider, {
      prompt: 'combine',
      width: 1024,
      height: 1024,
      references: [{ id: nodeB.id }, { id: nodeA.id }]
    })

    expect(calls[0].images?.[0]).toEqual(bytesB)
    expect(calls[0].images?.[1]).toEqual(bytesA)
  })

  test('editing = referencing the target itself; extraction happens before overwrite', async () => {
    const { figma } = setup()
    const oldBytes = new Uint8Array([7, 7, 7])
    const target = createImageNode(figma, 'target', oldBytes)
    const { calls, provider } = fakeProvider()

    const result = await generateOne(figma, provider, {
      id: target.id,
      prompt: 'change the background of [image 1]',
      references: [{ id: target.id }]
    })

    expect(calls[0].images?.[0]).toEqual(oldBytes)
    expect(result.id).toBe(target.id)
    const fills = target.fills as Array<{ type: string }>
    expect(fills[0].type).toBe('IMAGE')
  })

  test('partial extraction failure without prompt markers → succeeds with note', async () => {
    const { figma } = setup()
    const good = createImageNode(figma, 'good', PNG_MAGIC)
    const { provider } = fakeProvider()

    const result = await generateOne(figma, provider, {
      prompt: 'use the references',
      width: 1024,
      height: 1024,
      references: [{ id: good.id }, { id: 'missing-node' }]
    })

    expect(result.note).toContain('1/2')
    expect(result.note).toContain('missing-node')
  })

  test('all references failing without markers → throws', async () => {
    const { figma } = setup()
    const { provider } = fakeProvider()

    await expect(
      generateOne(figma, provider, {
        prompt: 'use the references',
        width: 1024,
        height: 1024,
        references: [{ id: 'missing-a' }, { id: 'missing-b' }]
      })
    ).rejects.toThrow('missing-a')
  })

  test('all references failing on existing nodes without IMAGE fill → hint suggests asImage', async () => {
    const { figma } = setup()
    const layout = figma.createFrame()
    layout.name = 'layout'
    const { provider } = fakeProvider()

    await expect(
      generateOne(figma, provider, {
        prompt: 'background for the layout',
        width: 1024,
        height: 1024,
        references: [{ id: layout.id }]
      })
    ).rejects.toThrow('"asImage":true')
  })

  test('any extraction failure with [image N] markers → throws to avoid misalignment', async () => {
    const { figma } = setup()
    const good = createImageNode(figma, 'good', PNG_MAGIC)
    const { provider } = fakeProvider()

    await expect(
      generateOne(figma, provider, {
        prompt: 'apply the palette of [image 2] to [image 1]',
        width: 1024,
        height: 1024,
        references: [{ id: good.id }, { id: 'missing-node' }]
      })
    ).rejects.toThrow('misalign')
  })

  test('asImage:true renders via figma.exportImage', async () => {
    const { figma } = setup()
    const layout = figma.createFrame()
    layout.name = 'layout'
    layout.resize(400, 300)
    const rendered = new Uint8Array([9, 9, 9])
    figma.exportImage = async () => rendered
    const { calls, provider } = fakeProvider()

    await generateOne(figma, provider, {
      prompt: 'background for [image 1]',
      width: 1024,
      height: 1024,
      references: [{ id: layout.id, asImage: true }]
    })

    expect(calls[0].images?.[0]).toEqual(rendered)
  })

  test('asImage:true without exportImage capability → extraction failure', async () => {
    const { figma } = setup()
    const layout = figma.createFrame()
    layout.name = 'layout'
    const { provider } = fakeProvider()

    await expect(
      generateOne(figma, provider, {
        prompt: 'background',
        width: 1024,
        height: 1024,
        references: [{ id: layout.id, asImage: true }]
      })
    ).rejects.toThrow('Failed to extract all reference')
  })

  test('returns canvas dimensions of the target node', async () => {
    const { figma } = setup()
    const { provider } = fakeProvider()

    const result = await generateOne(figma, provider, {
      prompt: 'poster',
      width: 1088,
      height: 1920
    })

    expect(result.canvasWidth).toBe(1088)
    expect(result.canvasHeight).toBe(1920)
    expect(result.provider).toBe('fake')
  })
})
