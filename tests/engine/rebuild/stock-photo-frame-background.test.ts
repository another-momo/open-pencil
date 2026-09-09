/**
 * stockPhoto 有条件放宽：FRAME 带子节点允许作为图片填充目标（图片进 fills 作背景，
 * 子节点保留）；COMPONENT / INSTANCE 等其余容器维持拒绝。
 */
import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { applyPhoto } from '#core/tools/stock-photo/apply'
import type { StockPhotoProvider } from '#core/tools/stock-photo/providers'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PHOTO_URL = `data:image/png;base64,${PNG_BYTES.toBase64()}`

interface ProviderCall {
  query: string
  options: {
    perPage: number
    orientation: 'landscape' | 'portrait' | 'square'
    targetDim: number
  }
}

function createProvider(calls: ProviderCall[]): StockPhotoProvider {
  return {
    name: 'test',
    async search(query, options) {
      calls.push({ query, options })
      return [
        {
          url: PHOTO_URL,
          width: 1600,
          height: 900,
          photographer: 'Test Photographer',
          sourceId: 'photo-1'
        }
      ]
    }
  }
}

function setup() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  return { graph, page, figma: new FigmaAPI(graph) }
}

describe('stockPhoto frame background', () => {
  test('FRAME with children accepts photo as background fill (children preserved)', async () => {
    const { graph, page, figma } = setup()
    const frame = graph.createNode('FRAME', page.id, {
      name: 'FRAME with content',
      width: 320,
      height: 180,
      x: 10,
      y: 20,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })
    const child = graph.createNode('RECTANGLE', frame.id, { name: 'child-rect' })
    const calls: ProviderCall[] = []

    const result = await applyPhoto(figma, createProvider(calls), {
      id: frame.id,
      query: 'mountain sunset',
      orientation: 'landscape'
    })

    expect(result.error).toBeUndefined()
    expect(result.photo).toMatchObject({ sourceId: 'photo-1', provider: 'test' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      query: 'mountain sunset',
      options: { perPage: 3, orientation: 'landscape', targetDim: 320 }
    })
    expect(frame.fills[0]).toMatchObject({ type: 'IMAGE', imageScaleMode: 'FILL' })
    expect(graph.getNode(child.id)).toBe(child)
    expect(graph.images.size).toBe(1)
  })

  for (const type of ['COMPONENT', 'INSTANCE'] as const) {
    test(`${type} with children still rejected as content container`, async () => {
      const { graph, page, figma } = setup()
      const container = graph.createNode(type, page.id, {
        name: `${type} with content`,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0, g: 0, b: 1, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
      })
      const child = graph.createNode('RECTANGLE', container.id)
      const originalFills = copyFills(container.fills)
      const calls: ProviderCall[] = []

      const result = await applyPhoto(figma, createProvider(calls), {
        id: container.id,
        query: 'should not run'
      })

      expect(result.error).toBe(`"${container.name}" has children — use a leaf image placeholder`)
      expect(calls).toHaveLength(0)
      expect(container.fills).toEqual(originalFills)
      expect(graph.getNode(child.id)).toBe(child)
      expect(graph.images.size).toBe(0)
    })
  }
})
