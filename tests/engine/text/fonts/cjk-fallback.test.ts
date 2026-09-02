/**
 * T84：bundled PuHuiTi 前插 CJK 回退链——三连钉：
 * ① bundled 命中时位于 CJK 回退链首位；
 * ② bundled 加载失败时链行为与现状一致（降级到本地/远端，不 throw）；
 * ③ 幂等（二次调用不重复 unshift）。
 *
 * 钉扎路径与 owner 验收三连对应；测试 mock 沿用 allowlist.test.ts fastEmptyFetch 模式。
 */
import { describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core/text'

function recordingProvider(): {
  provider: TypefaceFontProvider
  registrations: string[]
} {
  const registrations: string[] = []
  const provider = {
    registerFont(_data: ArrayBuffer, family: string) {
      registrations.push(family)
    }
  } as TypefaceFontProvider
  return { provider, registrations }
}

/** unifont provider 元数据请求快速回空（避免真实网络/退避重试拖慢单测） */
function fastEmptyFetch(): (url: string) => Promise<Response> {
  return async (url: string) => {
    if (url.endsWith('.woff2')) return new Response('nope', { status: 404 })
    return new Response('[]', { status: 200 })
  }
}

describe('bundled PuHuiTi 前插 CJK 回退链 (T84)', () => {
  test('① bundled 命中时位于 CJK 回退链首位', async () => {
    const manager = new FontManager()
    const { provider, registrations } = recordingProvider()
    manager.attachProvider({} as CanvasKit, provider)
    manager.setWebFontFetch(fastEmptyFetch())
    manager.setCnFontPieceCache(null)
    manager.setWebFontListTimeout(50)

    const families = await manager.ensureCJKFallback()

    expect(families.length).toBeGreaterThan(0)
    expect(families[0]).toBe('Alibaba PuHuiTi')
    expect(registrations).toContain('Alibaba PuHuiTi')
    expect(manager.isLoaded('Alibaba PuHuiTi')).toBe(true)
  })

  test('② bundled 加载失败时链行为与现状一致（降级到本地/远端，不 throw）', async () => {
    const manager = new FontManager()
    const { provider } = recordingProvider()
    manager.attachProvider({} as CanvasKit, provider)
    manager.setWebFontFetch(fastEmptyFetch())
    manager.setCnFontPieceCache(null)
    manager.setWebFontListTimeout(50)

    // 模拟 bundled 端失败：截断 PuHuiTi 加载，但保留其他族 loadFont 行为；
    // 远端走 fastEmptyFetch → 走原链 fallback（保证不 throw 且能返回）。
    const originalLoadFont = manager.loadFont.bind(manager)
    manager.loadFont = (async (family: string, style = 'Regular', characters = '') => {
      if (family === 'Alibaba PuHuiTi') return null
      return originalLoadFont(family, style, characters)
    }) as typeof manager.loadFont

    const families = await manager.ensureCJKFallback()

    expect(Array.isArray(families)).toBe(true)
    expect(families).not.toContain('Alibaba PuHuiTi')
  })

  test('③ 幂等：二次调用不重复 unshift', async () => {
    const manager = new FontManager()
    const { provider } = recordingProvider()
    manager.attachProvider({} as CanvasKit, provider)
    manager.setWebFontFetch(fastEmptyFetch())
    manager.setCnFontPieceCache(null)
    manager.setWebFontListTimeout(50)

    const first = await manager.ensureCJKFallback()
    const second = await manager.ensureCJKFallback()

    expect(first).toBe(second)
    expect(first.filter((family) => family === 'Alibaba PuHuiTi')).toHaveLength(1)
    expect(first[0]).toBe('Alibaba PuHuiTi')
  })

  test('ensureFallbackPack 直调路径（cjk + characters）也保证 bundled 在最前', async () => {
    const manager = new FontManager()
    const { provider } = recordingProvider()
    manager.attachProvider({} as CanvasKit, provider)
    manager.setWebFontFetch(fastEmptyFetch())
    manager.setCnFontPieceCache(null)
    manager.setWebFontListTimeout(50)

    const result = await manager.ensureFallbackPack(['cjk'], '字')

    expect(result.cjk).toBeDefined()
    expect(result.cjk?.[0]).toBe('Alibaba PuHuiTi')
  })

  test('PuHuiTi 是 bundled 锁定族（T41 D-d），前插路径不受 setFontFamilyEnabled 影响', async () => {
    const manager = new FontManager()
    const { provider } = recordingProvider()
    manager.attachProvider({} as CanvasKit, provider)
    manager.setWebFontFetch(fastEmptyFetch())
    manager.setCnFontPieceCache(null)
    manager.setWebFontListTimeout(50)

    expect(manager.isFontFamilyLocked('Alibaba PuHuiTi')).toBe(true)
    expect(manager.setFontFamilyEnabled('Alibaba PuHuiTi', false)).toBe(false)
    const families = await manager.ensureCJKFallback()
    expect(families[0]).toBe('Alibaba PuHuiTi')
  })
})
