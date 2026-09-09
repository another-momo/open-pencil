import { describe, expect, test } from 'bun:test'

import { getTool, setupToolTest, type ToolResult } from '#tests/helpers/tools'

describe('design-jsx font weight parsing', () => {
  test('parses named weights case-insensitively and preserves numeric weights', async () => {
    const cases = [
      ['thin', 100],
      ['light', 300],
      ['regular', 400],
      ['medium', 500],
      ['SemiBold', 600],
      ['bold', 700],
      ['extrabold', 800],
      ['heavy', 900],
      ['BLACK', 900],
      ['normal', 400],
      ['unknown-weight', 400]
    ] as const

    for (const [weight, expected] of cases) {
      const { figma } = setupToolTest()
      const render = getTool('render')
      const result = (await render.execute(figma, {
        jsx: `<Text weight="${weight}">Hello</Text>`
      })) as ToolResult
      const nodeId = result.id as string
      const node = figma.getNodeById(nodeId) as TextNode
      expect(node?.fontWeight).toBe(expected)
    }

    const { figma } = setupToolTest()
    const render = getTool('render')
    const result = (await render.execute(figma, {
      jsx: '<Text weight={700}>Hello</Text>'
    })) as ToolResult
    const node = figma.getNodeById(result.id as string) as TextNode
    expect(node?.fontWeight).toBe(700)
  })
})
