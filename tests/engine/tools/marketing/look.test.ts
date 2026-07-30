import { afterEach, describe, expect, test } from 'bun:test'

import type { FigmaAPI } from '@open-pencil/core'

import { setMarketingState } from '#core/tools/marketing/registry'
import {
  setVisionAnalyzer,
  setVisionCredentials,
  setVisionMode
} from '#core/tools/marketing/vision'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest } from '#tests/helpers/tools'

interface ExportCall {
  nodeIds: string[]
  options: { scale?: number; format?: string; quality?: number }
}

interface LookResult {
  error?: string
  base64?: string
  mimeType?: string
  note?: string
  analysis?: string
  cached?: boolean
  node?: { id: string; name: string; width: number; height: number }
}

function mockExportImage(figma: FigmaAPI, calls: ExportCall[]) {
  figma.exportImage = (nodeIds, options) => {
    calls.push({ nodeIds, options })
    return Promise.resolve(new Uint8Array([137, 80, 78, 71]))
  }
}

async function runLook(figma: FigmaAPI, args: Record<string, unknown>): Promise<LookResult> {
  return (await getTool('look').execute(figma, args)) as LookResult
}

afterEach(() => {
  setVisionMode('A')
  setVisionCredentials(null, '', '')
  setVisionAnalyzer(null)
})

describe('look tool', () => {
  test('errors when exportImage is unavailable', async () => {
    const { figma } = setupToolTest()
    const result = await runLook(figma, {})
    expect(result.error).toContain('not available')
  })

  test('errors without id and without a marketing session', async () => {
    const { figma } = setupToolTest()
    mockExportImage(figma, [])
    const result = await runLook(figma, {})
    expect(result.error).toContain('No id given')
  })

  test('errors for an unknown node id', async () => {
    const { figma } = setupToolTest()
    mockExportImage(figma, [])
    const result = await runLook(figma, { id: '999:999' })
    expect(result.error).toContain('not found')
  })

  test('multiple marketing designs with a stale active root require an explicit id', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const frameA = graph.createNode('FRAME', pageId, { name: 'A' })
    const frameB = graph.createNode('FRAME', pageId, { name: 'B' })
    const design = (rootFrameId: string, materialTypeId: string) => ({
      materialTypeId,
      rootFrameId,
      componentsPageId: 'components',
      anchors: [],
      readonly: new Map()
    })
    setMarketingState(graph, design(frameA.id, 'wechat_moments'))
    setMarketingState(graph, design(frameB.id, 'xiaohongshu'))
    graph.deleteNode(frameB.id)

    const result = await runLook(figma, {})
    expect(result.error).toContain('Multiple marketing designs')
    expect(result.error).toContain(frameA.id)
  })

  test('scales long edge to 1024 and exports JPEG at quality 80', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 4000 })

    const result = await runLook(figma, { id: frame.id })

    expect(result.error).toBeUndefined()
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.base64).toBeTruthy()
    const call = expectDefined(calls[0])
    expect(call.nodeIds).toEqual([frame.id])
    expect(call.options.scale).toBeCloseTo(1024 / 4000, 5)
    expect(call.options.format).toBe('JPG')
    expect(call.options.quality).toBe(80)
    expect(result.note).toContain('exported at 26%')
  })

  test('clamps scale at 0.1 for extremely tall nodes', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Tall', width: 750, height: 20000 })

    await runLook(figma, { id: frame.id })

    expect(expectDefined(calls[0]).options.scale).toBe(0.1)
  })

  test('small nodes export at scale 1', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })

    await runLook(figma, { id: frame.id })

    expect(expectDefined(calls[0]).options.scale).toBe(1)
  })

  test('declares illegible text and lists drill-in child nodes on long designs', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 4000 })
    const section = graph.createNode('FRAME', root.id, { name: 'Hero', width: 750, height: 1000 })
    graph.createNode('TEXT', section.id, { name: 'Headline', text: 'Hi', fontSize: 24 })

    const result = await runLook(figma, { id: root.id })

    expect(result.note).toContain('too small to read')
    expect(result.note).toContain('look at child nodes individually')
    expect(result.note).toContain(`${section.id} (Hero)`)
    expect(result.note).not.toContain('Focus:')
  })

  test('no legibility warning when text stays readable at export scale', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })
    graph.createNode('TEXT', frame.id, { name: 'Body', text: 'Hi', fontSize: 24 })

    const result = await runLook(figma, { id: frame.id })

    expect(result.note).not.toContain('too small to read')
  })

  test('merges focus into the note so it reaches the model with the image', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })

    const result = await runLook(figma, { id: frame.id, focus: 'text readability' })

    expect(result.note).toContain('Focus: text readability.')
  })
})

describe('look tool — vision channel B', () => {
  function setupChannelB(analyzer: (input: { prompt: string }) => Promise<string>) {
    setVisionMode('B')
    setVisionCredentials('sk-test', 'https://vision.example/v1', 'vision-model')
    setVisionAnalyzer(analyzer)
  }

  test('errors when channel B is selected but credentials are incomplete', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })
    setVisionMode('B')
    setVisionCredentials(null, '', '')

    const result = await runLook(figma, { id: frame.id })

    expect(result.error).toContain('channel B')
  })

  test('returns analysis without base64 and passes note + focus to the vision model', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })
    let seenPrompt = ''
    setupChannelB((input) => {
      seenPrompt = input.prompt
      return Promise.resolve('a white mug on a wooden table')
    })

    const result = await runLook(figma, { id: frame.id, focus: 'what does this image show' })

    expect(result.error).toBeUndefined()
    expect(result.analysis).toBe('a white mug on a wooden table')
    expect(result.base64).toBeUndefined()
    expect(result.cached).toBe(false)
    expect(seenPrompt).toContain('Visual inspection of "Card"')
    expect(seenPrompt).toContain('Focus: what does this image show.')
  })

  test('material descriptions are cached by image hash — second look skips the vision call', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const makeImageRect = (name: string) =>
      graph.createNode('RECTANGLE', pageId, {
        name,
        width: 300,
        height: 250,
        fills: [
          {
            type: 'IMAGE',
            imageHash: 'hash-1',
            color: { r: 1, g: 1, b: 1, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
      })
    const rectA = makeImageRect('Material A')
    const rectB = makeImageRect('Material B')
    let visionCalls = 0
    setupChannelB(() => {
      visionCalls++
      return Promise.resolve('description of the material')
    })

    const first = await runLook(figma, { id: rectA.id })
    const second = await runLook(figma, { id: rectB.id })

    expect(first.cached).toBe(false)
    expect(visionCalls).toBe(1)
    expect(second.cached).toBe(true)
    expect(second.analysis).toBe('description of the material')
    expect(calls).toHaveLength(1)
  })
})
