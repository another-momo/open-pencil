import { afterEach, describe, expect, test } from 'bun:test'

import type { FigmaAPI } from '@open-pencil/core'

import {
  setVisionAnalyzer,
  setVisionCredentials,
  setVisionMode
} from '#core/tools/marketing/vision'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest } from '#tests/helpers/tools'

interface ExportCall {
  nodeIds: string[]
  options: {
    scale?: number
    format?: string
    quality?: number
    renderInContext?: boolean
    clip?: { minX: number; minY: number; maxX: number; maxY: number }
  }
}

interface LookResult {
  error?: string
  base64?: string
  mimeType?: string
  byteLength?: number
  note?: string
  analysis?: string
  channel?: 'A' | 'B'
  node?: { id: string; name: string; width: number; height: number }
  exportInfo?: {
    mode: 'original-bytes' | 'isolated' | 'in-context'
    scale?: number
    upscaled?: boolean
  }
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
    const { graph, figma } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Detail', width: 100, height: 100 })
    const result = await runLook(figma, { id: frame.id })
    expect(result.error).toContain('not available')
  })

  test('errors without an id — the id is always required', async () => {
    const { figma } = setupToolTest()
    mockExportImage(figma, [])
    const result = await runLook(figma, {})
    expect(result.error).toContain('Pass an explicit node id')
  })

  test('errors for an unknown node id', async () => {
    const { figma } = setupToolTest()
    mockExportImage(figma, [])
    const result = await runLook(figma, { id: '999:999' })
    expect(result.error).toContain('not found')
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

    const result = await runLook(figma, { id: frame.id })

    expect(expectDefined(calls[0]).options.scale).toBe(0.1)
    expect(result.note).toContain('Aspect ratio distorted')
  })

  test('small nodes are upscaled to the 512px minimum legible edge', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Card', width: 300, height: 250 })

    const result = await runLook(figma, { id: frame.id })

    expect(expectDefined(calls[0]).options.scale).toBeCloseTo(512 / 300, 5)
    expect(result.note).toContain('Upscaled')
    expect(result.note).not.toContain('Aspect ratio distorted')
    expect(result.exportInfo?.mode).toBe('isolated')
    expect(result.exportInfo?.upscaled).toBe(true)
  })

  test('transparent flow frames export composited in context with a clamped margin clip', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    // No fills — like HeroContent, the frame's content floats on whatever the
    // design paints beneath it; an isolated export would be white-on-white.
    const hero = graph.createNode('FRAME', root.id, {
      name: 'HeroContent',
      width: 750,
      height: 750,
      y: 100
    })

    const result = await runLook(figma, { id: hero.id })

    const call = expectDefined(calls[0])
    expect(call.options.renderInContext).toBe(true)
    // Visual bounds (0,100)-(750,850) + 48px margin, clamped to the root's
    // (0,0)-(750,2000) so the export never shows bare page canvas.
    expect(call.options.clip).toEqual({ minX: 0, minY: 52, maxX: 750, maxY: 898 })
    expect(result.exportInfo?.mode).toBe('in-context')
    expect(result.note).toContain('design context')
  })

  test('near-white text exports in context — it is invisible on a blank export', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    const title = graph.createNode('TEXT', root.id, { name: 'Title', text: '端午', fontSize: 96 })
    graph.updateNode(title.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const result = await runLook(figma, { id: title.id })

    expect(expectDefined(calls[0]).options.renderInContext).toBe(true)
    expect(result.exportInfo?.mode).toBe('in-context')
  })

  test('faint low-opacity gray text counts as near-white (opacity folds into luminance)', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    // lum(0.85) = 0.85 at opacity 0.4 → effective over white = 1−0.4×0.15 =
    // 0.94 ≥ 0.92 → in-context. The raw fill color alone (0.85 < 0.92) would
    // NOT have triggered before the opacity fold.
    const faint = graph.createNode('TEXT', root.id, { name: 'Ghost', text: '淡', fontSize: 40 })
    graph.updateNode(faint.id, {
      fills: [
        { type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85, a: 1 }, opacity: 0.4, visible: true }
      ]
    })
    // Same color at full opacity → 0.85 < 0.92 → stays isolated.
    const solidGray = graph.createNode('TEXT', root.id, {
      name: 'SolidGray',
      text: '实',
      fontSize: 40,
      y: 100
    })
    graph.updateNode(solidGray.id, {
      fills: [
        { type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85, a: 1 }, opacity: 1, visible: true }
      ]
    })

    const faintResult = await runLook(figma, { id: faint.id })
    const solidResult = await runLook(figma, { id: solidGray.id })

    expect(faintResult.exportInfo?.mode).toBe('in-context')
    expect(solidResult.exportInfo?.mode).toBe('isolated')
  })

  test('frames with their own visible fill keep the isolated export', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    const card = graph.createNode('FRAME', root.id, {
      name: 'Card',
      width: 600,
      height: 400,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.3, a: 1 }, opacity: 1, visible: true }]
    })

    const result = await runLook(figma, { id: card.id })

    expect(expectDefined(calls[0]).options.renderInContext).toBeUndefined()
    expect(result.exportInfo?.mode).toBe('isolated')
    expect(result.note).not.toContain('design context')
  })

  test('upscaling can clear the small-text legibility warning', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    const card = graph.createNode('FRAME', root.id, {
      name: 'Card',
      width: 300,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('TEXT', card.id, { name: 'Body', text: 'x', fontSize: 8 })

    const result = await runLook(figma, { id: card.id })

    // scale = 512/300 ≈ 1.71 → the 8px text renders at ~14px, above the 12px floor.
    expect(result.note).toContain('Upscaled')
    expect(result.note).not.toContain('too small to read')
  })

  test('upscale is capped at ×4 for very small nodes', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 2000 })
    const badge = graph.createNode('FRAME', root.id, {
      name: 'Badge',
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.3, a: 1 }, opacity: 1, visible: true }]
    })

    const result = await runLook(figma, { id: badge.id })

    expect(expectDefined(calls[0]).options.scale).toBe(4)
    expect(result.note).toContain('capped at ×4')
  })

  test('image-bearing nodes bypass rendering and return the original bytes', async () => {
    const { graph, figma } = setupToolTest()
    // No exportImage mock on purpose — the original-bytes path must not need it
    const pageId = graph.getPages()[0].id
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4])
    const { hash } = figma.createImage(pngBytes)
    const rect = graph.createNode('RECTANGLE', pageId, { name: 'Photo', width: 143, height: 143 })
    graph.updateNode(rect.id, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const result = await runLook(figma, { id: rect.id, focus: 'what does this image show' })

    expect(result.error).toBeUndefined()
    expect(result.channel).toBe('A')
    expect(result.mimeType).toBe('image/png')
    expect(result.byteLength).toBe(pngBytes.length)
    expect(result.note).toContain('Original image bytes')
    expect(result.note).toContain('possibly cropped')
  })

  test('channel B also receives the original bytes for image-bearing nodes', async () => {
    const { graph, figma } = setupToolTest()
    // No exportImage mock — channel B must analyze the original bytes directly
    const pageId = graph.getPages()[0].id
    const { hash } = figma.createImage(new Uint8Array([0xff, 0xd8, 9, 8, 7]))
    const rect = graph.createNode('RECTANGLE', pageId, { name: 'Photo', width: 143, height: 143 })
    graph.updateNode(rect.id, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true
        }
      ]
    })
    let seenPrompt = ''
    let seenMime = ''
    setVisionMode('B')
    setVisionCredentials('sk-test', 'https://vision.example/v1', 'vision-model')
    setVisionAnalyzer((input) => {
      seenPrompt = input.prompt
      seenMime = input.mimeType
      return Promise.resolve('a portrait product shot')
    })

    const result = await runLook(figma, { id: rect.id })

    expect(result.analysis).toBe('a portrait product shot')
    expect(seenMime).toBe('image/jpeg')
    expect(seenPrompt).toContain('Original image bytes')
  })

  test('nodes with mixed fills still render via exportImage', async () => {
    const { graph, figma } = setupToolTest()
    const calls: ExportCall[] = []
    mockExportImage(figma, calls)
    const pageId = graph.getPages()[0].id
    const { hash } = figma.createImage(new Uint8Array([0xff, 0xd8, 1, 2]))
    const rect = graph.createNode('RECTANGLE', pageId, { name: 'Mix', width: 100, height: 100 })
    graph.updateNode(rect.id, {
      fills: [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true },
        {
          type: 'IMAGE',
          imageHash: hash,
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 1,
          visible: true
        }
      ]
    })

    const result = await runLook(figma, { id: rect.id })

    expect(expectDefined(calls[0]).nodeIds).toEqual([rect.id])
    expect(result.mimeType).toBe('image/jpeg')
  })

  test('declares illegible text and lists drill-in child nodes on long designs', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 4000 })
    const section = graph.createNode('FRAME', root.id, { name: 'Hero', width: 750, height: 1000 })
    const headline = graph.createNode('TEXT', section.id, {
      name: 'Headline',
      text: 'Hi',
      fontSize: 24
    })

    const result = await runLook(figma, { id: root.id })

    expect(result.note).toContain('too small to read')
    expect(result.note).toContain('look at these text nodes individually')
    expect(result.note).toContain(`${headline.id} (Headline)`)
    expect(result.note).not.toContain('Focus:')
  })

  test('drill targets are count-limited and names are trimmed', async () => {
    const { graph, figma } = setupToolTest()
    mockExportImage(figma, [])
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Detail', width: 750, height: 4000 })
    graph.createNode('TEXT', root.id, {
      name: 'A very long text node name that exceeds the drill-target label limit',
      text: 'x',
      fontSize: 24
    })
    for (let i = 0; i < 6; i++) {
      graph.createNode('TEXT', root.id, { name: `  Line ${i}  `, text: 'x', fontSize: 24 })
    }

    const result = await runLook(figma, { id: root.id })

    expect(result.note).toContain('and 2 more, look specific ids')
    expect(result.note).toContain('that exceeds …')
    expect(result.note).toContain('(Line 0)')
    expect(result.note).not.toContain('(  Line 0  )')
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
    expect(result.channel).toBe('A')
    expect(result.note).not.toContain('locked direction')
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
    expect(result.channel).toBe('B')
    expect(result.note).toContain('Text analysis from the independent vision model.')
    expect(result.note).not.toContain('secondary judgment')
    expect(seenPrompt).toContain('Visual inspection of "Card"')
    expect(seenPrompt).toContain('Focus: what does this image show.')
    // The confidence protocol must reach the vision model: artifacts are
    // declared, never described as design defects.
    expect(seenPrompt).toContain('artifact')
  })

  test('no caching — every look triggers a fresh vision call, even for the same image', async () => {
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
    let visionCalls = 0
    setupChannelB(() => {
      visionCalls++
      return Promise.resolve(`analysis ${visionCalls}`)
    })

    const first = await runLook(figma, { id: rectA.id, focus: 'what does this image show' })
    const second = await runLook(figma, { id: rectA.id, focus: 'is the text garbled' })

    expect(first.analysis).toBe('analysis 1')
    expect(second.analysis).toBe('analysis 2')
    expect(visionCalls).toBe(2)
    expect(calls).toHaveLength(2)
  })
})
