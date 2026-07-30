import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import type { Fill, SceneNode } from '@open-pencil/scene-graph'

import { detectIssues } from '#core/tools/describe/issues'

function solidFill(opacity: number, hex: { r: number; g: number; b: number }): Fill {
  return { type: 'SOLID', color: { ...hex, a: 1 }, opacity, visible: true }
}

const WHITE = { r: 1, g: 1, b: 1 }
const NEAR_WHITE = { r: 0.99, g: 0.99, b: 0.99 }

function severityOf(issues: Array<{ severity?: string; message: string }>, match: RegExp) {
  const issue = issues.find((i) => match.test(i.message))
  return issue?.severity
}

describe('describe issue severity classification (lint 降噪)', () => {
  test('near-invisible fill/stroke downgrade to info, not error', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', pageId, {
      name: 'Ghost',
      width: 100,
      height: 100,
      fills: [solidFill(0.1, WHITE)],
      strokes: [{ type: 'SOLID', color: { ...WHITE, a: 1 }, opacity: 0.1, visible: true }]
    } as Partial<SceneNode>)

    const issues = detectIssues(node, 8, graph)
    expect(severityOf(issues, /Near-invisible fill/)).toBe('info')
    expect(severityOf(issues, /Near-invisible stroke/)).toBe('info')
  })

  test('invisible shape (no fill and no stroke) stays error', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', pageId, {
      name: 'Invisible',
      width: 100,
      height: 100,
      fills: [],
      strokes: []
    } as Partial<SceneNode>)

    const issues = detectIssues(node, 8, graph)
    expect(severityOf(issues, /no fill and no stroke/)).toBe('error')
  })

  test('off-grid gap downgrades to info', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('FRAME', pageId, {
      name: 'Stack',
      width: 300,
      height: 300,
      itemSpacing: 20,
      layoutMode: 'VERTICAL'
    } as Partial<SceneNode>)

    const issues = detectIssues(node, 8, graph)
    expect(severityOf(issues, /not on 8px grid/)).toBe('info')
  })

  test('low contrast text downgrades to info', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Card',
      width: 300,
      height: 200,
      fills: [solidFill(1, WHITE)]
    } as Partial<SceneNode>)
    const text = graph.createNode('TEXT', frame.id, {
      name: 'Body',
      text: 'hello',
      fontSize: 14,
      fills: [solidFill(1, NEAR_WHITE)]
    } as Partial<SceneNode>)

    const issues = detectIssues(text, 8, graph)
    expect(severityOf(issues, /Low contrast/)).toBe('info')
  })

  test('author-controlled subpixel position downgrades to info', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', pageId, {
      name: 'Off',
      width: 100,
      height: 100,
      x: 10.5,
      fills: [solidFill(1, WHITE)]
    } as Partial<SceneNode>)

    const issues = detectIssues(node, 8, graph)
    expect(severityOf(issues, /Subpixel position/)).toBe('info')
  })
})
