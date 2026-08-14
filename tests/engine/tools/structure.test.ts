import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#tests/helpers/assert'
import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('delete_node', () => {
  test('removes a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    const tool = getTool('delete_node')
    tool.execute(figma, { id: rect.id })

    expect(figma.getNodeById(rect.id)).toBeNull()
  })
})

describe('clone_node', () => {
  test('duplicates a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()
    rect.name = 'Original'
    rect.resize(100, 100)

    const tool = getTool('clone_node')
    const result = tool.execute(figma, { id: rect.id }) as ToolResult

    expect(result.id).not.toBe(rect.id)
    expect(result.name).toBe('Original')
  })
})

describe('rename_node', () => {
  test('renames a node', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    const tool = getTool('rename_node')
    tool.execute(figma, { id: rect.id, name: 'My Rectangle' })

    expect(expectDefined(figma.getNodeById(rect.id), 'renamed rectangle').name).toBe('My Rectangle')
  })
})

describe('reparent_node', () => {
  test('moves node into frame', () => {
    const { figma } = setupToolTest()
    const frame = figma.createFrame()
    frame.resize(300, 300)
    const rect = figma.createRectangle()
    rect.resize(50, 50)

    const tool = getTool('reparent_node')
    tool.execute(figma, { id: rect.id, parent_id: frame.id })

    expect(
      expectDefined(figma.getNodeById(frame.id), 'target frame').children.some(
        (c) => c.id === rect.id
      )
    ).toBe(true)
  })
})

describe('group_nodes', () => {
  test('groups two nodes', () => {
    const { figma } = setupToolTest()
    const r1 = figma.createRectangle()
    r1.resize(50, 50)
    const r2 = figma.createRectangle()
    r2.resize(50, 50)

    const tool = getTool('group_nodes')
    const result = tool.execute(figma, { ids: [r1.id, r2.id] }) as ToolResult

    expect(result.type).toBe('GROUP')
    const group = expectDefined(
      figma.getNodeById(expectDefined(result.id, 'group id')),
      'created group'
    )
    expect(group.children.length).toBe(2)
  })
})

describe('node_replace_with', () => {
  test('replacing an instance child preserves mapping and survives component sync', async () => {
    const { graph, figma } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const component = graph.createNode('COMPONENT', pageId, {
      name: 'CTA',
      width: 200,
      height: 48
    })
    const label = graph.createNode('TEXT', component.id, { name: 'label', text: 'Buy' })
    const instance = expectDefined(graph.createInstance(component.id, pageId))
    const childId = expectDefined(instance.childIds[0])

    const tool = getTool('node_replace_with')
    const result = (await tool.execute(figma, {
      id: childId,
      jsx: '<Text name="label" size={20} color="#00F">Shop now</Text>'
    })) as ToolResult
    const newId = expectDefined(result.id)

    expect(graph.getNode(newId)?.componentId).toBe(label.id)
    const synced = expectDefined(graph.getNode(instance.id))
    expect(synced.overrides[`${newId}:text`]).toBe(true)
    expect(synced.overrides[`${newId}:componentId`]).toBe(true)

    graph.updateNode(label.id, { text: 'Buy today' })
    graph.syncInstances(component.id)

    const after = expectDefined(graph.getNode(instance.id))
    expect(after.childIds).toHaveLength(1)
    expect(graph.getNode(expectDefined(after.childIds[0]))?.text).toBe('Shop now')
  })
})

describe('batch_update', () => {
  test('applies font_weight to text nodes', () => {
    const { graph, figma } = setupToolTest()
    const pageId = graph.getPages()[0].id
    const text = graph.createNode('TEXT', pageId, { name: 'label', text: 'Buy' })

    const result = getTool('batch_update').execute(figma, {
      operations: JSON.stringify([{ id: text.id, props: { font_weight: 800 } }])
    }) as ToolResult

    expect(result.updated).toBe(1)
    expect(graph.getNode(text.id)?.fontWeight).toBe(800)
  })

  test('reports unknown prop keys with the supported list', () => {
    const { figma } = setupToolTest()
    const rect = figma.createRectangle()

    const result = getTool('batch_update').execute(figma, {
      operations: JSON.stringify([{ id: rect.id, props: { fontweight: 800, bogus: 1 } }])
    }) as ToolResult

    expect(result.updated).toBe(0)
    const errors = expectDefined(result.errors, 'batch_update errors') as string[]
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unknown props "fontweight", "bogus"')
    expect(errors[0]).toContain('font_weight')
    expect(errors[0]).toContain('spacing')
  })
})
