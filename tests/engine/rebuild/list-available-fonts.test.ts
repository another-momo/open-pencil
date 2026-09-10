/**
 * list_available_fonts 钉扎（2026-09-10 字体专项 review 落地）：
 * - 语义：宿主枚举面聚合——去重、排序、大小写不敏感过滤
 * - 空结果必须带说明 note（无枚举面的运行时返回 []，agent 需要能区分
 *   「没有字体」与「此运行时不提供枚举」）
 * - description 不得退回「system fonts plus bundled fonts」旧文案（2026-06 起
 *   枚举面已含在线/CDN 来源，旧文案失真两年无人发现——本测试即门禁）
 */

import { describe, expect, test } from 'bun:test'

import { listAvailableFonts } from '#core/tools/read/fonts'

import { ALL_TOOLS } from '#tests/helpers/tools'

interface MockFont {
  fontName: { family: string; style: string }
}

function mockFigma(fonts: MockFont[]) {
  return { listAvailableFontsAsync: async () => fonts } as never
}

describe('list_available_fonts', () => {
  test('聚合去重 + 排序（同族多 style 只出现一次）', async () => {
    const result = (await listAvailableFonts.execute(
      mockFigma([
        { fontName: { family: 'Inter', style: 'Bold' } },
        { fontName: { family: 'Ziczac', style: 'Regular' } },
        { fontName: { family: 'Inter', style: 'Regular' } }
      ]),
      {}
    )) as { count: number; fonts: string[] }
    expect(result.fonts).toEqual(['Inter', 'Ziczac'])
    expect(result.count).toBe(2)
  })

  test('family 过滤大小写不敏感', async () => {
    const result = (await listAvailableFonts.execute(
      mockFigma([
        { fontName: { family: 'Inter', style: 'Regular' } },
        { fontName: { family: 'PuHuiTi', style: 'Regular' } }
      ]),
      { family: 'inter' }
    )) as { count: number; fonts: string[] }
    expect(result.fonts).toEqual(['Inter'])
  })

  test('空结果带 note 说明（无枚举面运行时）', async () => {
    const result = (await listAvailableFonts.execute(mockFigma([]), {})) as {
      count: number
      note?: string
    }
    expect(result.count).toBe(0)
    expect(result.note).toContain('may not expose a font list')
  })

  test('description 不退回失真旧文案，且如实反映在线字体来源', () => {
    const tool = ALL_TOOLS.find((t) => t.name === 'list_available_fonts')
    if (!tool) throw new Error('list_available_fonts not in ALL_TOOLS')
    // 2026-04 旧文案声称只有 system + bundled，与 2026-06 起的枚举面不符
    expect(tool.description).not.toContain('system fonts on desktop')
    expect(tool.description).toContain('online')
    // 与 list_fonts 的区分说明保留
    expect(tool.description).toContain('list_fonts')
  })
})
