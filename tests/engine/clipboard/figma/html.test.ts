import { beforeAll, describe, expect, it } from 'bun:test'

import {
  buildFigmaClipboardHTML,
  importClipboardNodes,
  initCodec,
  parseFigmaClipboard,
  SceneGraph
} from '@open-pencil/core'

import { expectDefined } from '#tests/helpers/assert'

function expectFigmaEditableTextDefaults(
  textNode: NonNullable<Awaited<ReturnType<typeof parseFigmaClipboard>>>['nodes'][number]
) {
  expect(textNode.textUserLayoutVersion).toBe(5)
  expect(textNode.textExplicitLayoutVersion).toBe(1)
  expect(textNode.textBidiVersion).toBe(1)
  expect(textNode.textAutoResize).toBe('NONE')
  expect(textNode.lineHeight).toEqual({ value: 100, units: 'PERCENT' })
  expect(textNode.letterSpacing).toEqual({ value: 0, units: 'PIXELS' })
  expect(textNode.fontVariantCommonLigatures).toBe(true)
  expect(textNode.fontVariantContextualLigatures).toBe(true)
  expect(textNode.textDecorationSkipInk).toBe(true)
  expect(textNode.emojiImageSet).toBe('APPLE')
}

describe('buildFigmaClipboardHTML', () => {
  beforeAll(async () => {
    await initCodec()
  })

  it('encodes a simple frame without throwing', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Card',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).toContain('figmeta')
    expect(html).toContain('figma')
  })

  it('encodes text nodes with style runs', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const text = graph.createNode('TEXT', page.id, {
      name: 'Styled',
      x: 0,
      y: 0,
      width: 200,
      height: 24,
      text: 'Hello World',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      styleRuns: [
        { start: 0, length: 5, style: { fontWeight: 700 } },
        { start: 6, length: 5, style: { fontWeight: 400, italic: true } }
      ]
    })

    const html = await buildFigmaClipboardHTML([text], graph)
    expect(html).toContain('figmeta')

    const parsed = await parseFigmaClipboard(html)
    const textNode = parsed?.nodes.find((node) => node.type === 'TEXT')
    if (!textNode) throw new Error('Expected text node')
    expectFigmaEditableTextDefaults(textNode)
    expect(textNode.derivedTextData?.glyphs).toBeDefined()
    expect(textNode.derivedTextData?.baselines?.length).toBeGreaterThan(0)
    expect(textNode.derivedTextData?.logicalIndexToCharacterOffsetMap?.length).toBe(
      text.text.length + 1
    )
    expect(textNode.derivedTextData?.derivedLines).toEqual([{ directionality: 'LTR' }])
  })

  it('encodes fallback derived text metrics when outline fonts are unavailable', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('TEXT', page.id, {
      name: 'Title',
      x: 0,
      y: 0,
      width: 552,
      height: 70,
      text: 'Analytics Overview',
      fontFamily: 'Missing Preview Font',
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 67,
      textAutoResize: 'HEIGHT'
    })

    const html = await buildFigmaClipboardHTML(graph.getChildren(page.id), graph)
    const parsed = await parseFigmaClipboard(html)
    const textNode = parsed?.nodes.find((node) => node.type === 'TEXT')
    const baseline = textNode?.derivedTextData?.baselines?.[0]

    expect(textNode?.textUserLayoutVersion).toBe(5)
    expect(textNode?.textAutoResize).toBe('NONE')
    expect(textNode?.derivedTextData?.glyphs?.length).toBe('Analytics Overview'.length)
    expect(baseline?.width).toBe(552)
    expect(baseline?.lineHeight).toBe(67)
    expect(textNode?.derivedTextData?.layoutSize).toEqual({ x: 552, y: 70 })
  })

  it('encodes auto-layout frames', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Row',
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      paddingTop: 12,
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'Child',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).toContain('figmeta')
  })

  it('roundtrips: encode then decode back', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Analytics Overview',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      cornerRadius: 12
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Title',
      x: 0,
      y: 0,
      width: 260,
      height: 24,
      text: 'Analytics Overview',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 18
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Subtitle',
      x: 0,
      y: 0,
      width: 260,
      height: 40,
      text: 'Track your key metrics and performance indicators in real time.',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 14
    })

    const html = await buildFigmaClipboardHTML([frame], graph)
    expect(html).not.toBeNull()

    const parsed = await parseFigmaClipboard(expectDefined(html, 'Figma clipboard html'))
    const clipboard = expectDefined(parsed, 'Figma clipboard')
    expect(clipboard.nodes.length).toBeGreaterThan(0)

    const graph2 = new SceneGraph()
    const page2 = graph2.getPages()[0]
    const created = importClipboardNodes(clipboard.nodes, graph2, page2.id)
    expect(created).toHaveLength(1)

    const imported = expectDefined(graph2.getNode(created[0]), 'imported clipboard node')
    expect(imported.name).toBe('Analytics Overview')
    expect(imported.cornerRadius).toBe(12)

    const children = graph2.getChildren(imported.id)
    expect(children).toHaveLength(2)
    expect(children[0].text).toBe('Analytics Overview')
    expect(children[1].text).toContain('Track your key metrics')
  })

  it('re-copying previously pasted nodes mints unique guids', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'F1',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    const group = graph.createNode('GROUP', frame.id, { name: 'G' })
    graph.createNode('TEXT', group.id, { name: 'A', text: 'AAA', fontSize: 16 })
    graph.createNode('TEXT', group.id, { name: 'B', text: 'BBB', fontSize: 16, x: 60 })

    // Paste the same clipboard twice: both copies carry identical source.id
    // values (1:100, 1:101, ...) from the first payload
    const html1 = await buildFigmaClipboardHTML([frame], graph)
    const parsed1 = expectDefined(await parseFigmaClipboard(expectDefined(html1)))
    const created1 = importClipboardNodes(parsed1.nodes, graph, page.id)
    const created2 = importClipboardNodes(parsed1.nodes, graph, page.id)
    expect(created1).toHaveLength(1)
    expect(created2).toHaveLength(1)
    const pasted1 = expectDefined(graph.getNode(created1[0]))
    const pasted2 = expectDefined(graph.getNode(created2[0]))
    expect(pasted1.source.id).toBeTruthy()
    expect(pasted1.source.id).toBe(pasted2.source.id)

    // Copying BOTH pasted subtrees: without collision handling their shared
    // source.ids duplicate within the payload and the import drops everything
    const html2 = await buildFigmaClipboardHTML([pasted1, pasted2], graph)
    const parsed2 = expectDefined(await parseFigmaClipboard(expectDefined(html2)))
    const guids = parsed2.nodes.map((nc) => `${nc.guid?.sessionID}:${nc.guid?.localID}`)
    expect(new Set(guids).size).toBe(guids.length)

    const created3 = importClipboardNodes(parsed2.nodes, graph, page.id)
    expect(created3.length).toBeGreaterThan(0)
  })
})
