/**
 * T41 S4 白名单运行时管控单测（owner /goal：覆盖全来源 + bundled 恒开锁定）。
 * 覆盖：枚举过滤（bundled/cdn/local）/ 四加载门禁 / 锁定拒关 / re-enable 恢复 /
 * fallback 链跳过 / revision 失效信号 / normalize 归一。
 */
import { afterEach, describe, expect, test } from 'bun:test'

import { FontManager, fontRegistryEntry } from '@open-pencil/core/text'

import { fontFallbackEntry } from '#core/text/fallbacks'

/** unifont provider 元数据请求快速回空（避免真实网络/退避重试拖慢单测） */
function fastEmptyFetch(): (url: string) => Promise<Response> {
  return async (url: string) => {
    if (url.endsWith('.woff2')) return new Response('nope', { status: 404 })
    return new Response('[]', { status: 200 })
  }
}

function onlineManager(): FontManager {
  const manager = new FontManager()
  manager.setWebFontFetch(fastEmptyFetch())
  manager.setCnFontPieceCache(null)
  manager.setWebFontListTimeout(50)
  manager.setOnlineFontProviders({ google: true })
  return manager
}

describe('白名单枚举过滤（listFamilyOptions 全来源）', () => {
  test('bundled 锁定族恒在且拒关；cdn 族关停后隐藏、重开恢复', async () => {
    const manager = onlineManager()
    let families = (await manager.listFamilyOptions()).map((option) => option.family)
    expect(families).toContain('Inter')
    expect(families).toContain('LXGW WenKai')

    // bundled 锁定（D-d）：setEnabled 返回 false，枚举仍在
    expect(manager.setFontFamilyEnabled('Inter', false)).toBe(false)
    expect(manager.isFontFamilyEnabled('Inter')).toBe(true)
    // cdn 关停 → 隐藏
    expect(manager.setFontFamilyEnabled('LXGW WenKai', false)).toBe(true)
    families = (await manager.listFamilyOptions()).map((option) => option.family)
    expect(families).not.toContain('LXGW WenKai')
    expect(families).toContain('Inter')
    // 重开恢复
    manager.setFontFamilyEnabled('LXGW WenKai', true)
    families = (await manager.listFamilyOptions()).map((option) => option.family)
    expect(families).toContain('LXGW WenKai')
  })

  test('local（系统字体）族关停后枚举隐藏', async () => {
    ;(globalThis as typeof globalThis & { window?: unknown }).window = {
      queryLocalFonts: async () => [
        {
          family: 'Local Allowlist Probe',
          fullName: 'Local Allowlist Probe',
          style: 'Regular',
          postscriptName: 'LocalAllowlistProbe'
        }
      ]
    }
    const manager = onlineManager()
    await manager.requestLocalFontAccess()
    expect((await manager.listFamilyOptions()).map((o) => o.family)).toContain(
      'Local Allowlist Probe'
    )

    manager.setFontFamilyEnabled('Local Allowlist Probe', false)
    expect((await manager.listFamilyOptions()).map((o) => o.family)).not.toContain(
      'Local Allowlist Probe'
    )
  })

  test('includeDisabled（管理面板路径）：关停行仍列出，锁定族不受影响', async () => {
    ;(globalThis as typeof globalThis & { window?: unknown }).window = {
      queryLocalFonts: async () => [
        {
          family: 'Local Allowlist Probe',
          fullName: 'Local Allowlist Probe',
          style: 'Regular',
          postscriptName: 'LocalAllowlistProbe'
        }
      ]
    }
    const manager = onlineManager()
    await manager.requestLocalFontAccess()
    manager.setFontFamilyEnabled('LXGW WenKai', false)
    manager.setFontFamilyEnabled('Local Allowlist Probe', false)
    manager.setFontFamilyEnabled('Inter', false) // 锁定族拒关

    const all = (await manager.listFamilyOptions({ includeDisabled: true })).map(
      (option) => option.family
    )
    // 关停行保留（面板可重开），锁定族恒在
    expect(all).toContain('LXGW WenKai')
    expect(all).toContain('Local Allowlist Probe')
    expect(all).toContain('Inter')

    const filtered = (await manager.listFamilyOptions()).map((option) => option.family)
    expect(filtered).not.toContain('LXGW WenKai')
    expect(filtered).not.toContain('Local Allowlist Probe')
    expect(filtered).toContain('Inter')
  })
})

describe('白名单加载门禁（disabled = 视为未安装）', () => {
  test('loadFont / loadLocalFont / loadRemoteFont / loadCachedFont 对关停族一律 null', async () => {
    const manager = onlineManager()
    manager.setFontFamilyEnabled('Gated Fam', false)

    expect(await manager.loadFont('Gated Fam', 'Regular', '中')).toBeNull()
    expect(await manager.loadLocalFont('Gated Fam')).toBeNull()
    expect(await manager.loadRemoteFont('Gated Fam', 'Regular', '中')).toBeNull()
    expect(await manager.loadCachedFont('Gated Fam')).toBeNull()

    manager.setFontFamilyEnabled('Gated Fam', true)
    // 恢复后不再是门禁短路（网络 404 走正常失败路径，同样 null 但来源不同——
    // 用 isFontFamilyEnabled 与 markLoaded 旁证门禁解除）
    expect(manager.isFontFamilyEnabled('Gated Fam')).toBe(true)
    manager.markLoaded('Gated Fam', 'Regular', new ArrayBuffer(8))
    expect(await manager.loadFont('Gated Fam')).not.toBeNull()
  })

  test('回退链跳过被关停的本地回退族', async () => {
    const manager = new FontManager()
    const manifest = fontFallbackEntry('cjk', undefined)
    const [skipped, ...rest] = manifest.localFamilies
    expect(rest.length).toBeGreaterThan(0)

    const served = new ArrayBuffer(8)
    manager.setHostFontLoader(async () => served)
    manager.setFontFamilyEnabled(skipped, false)

    const families = await manager.ensureCJKFallback()
    expect(families).not.toContain(skipped)
    expect(families).toContain(rest[0])
  })
})

describe('FontFamilyAllowlist 语义', () => {
  test('revision 变更单调增、无变化不空转；replaceDisabled 批量恢复并滤除锁定族', () => {
    const manager = new FontManager()
    const base = manager.fontAllowlistRevision()

    manager.setFontFamilyEnabled('Fam A', false)
    const afterDisable = manager.fontAllowlistRevision()
    expect(afterDisable).toBeGreaterThan(base)
    manager.setFontFamilyEnabled('Fam A', false) // 重复同态
    expect(manager.fontAllowlistRevision()).toBe(afterDisable)

    manager.setDisabledFontFamilies(['Fam B', 'Fam C', 'Inter']) // Inter 锁定被滤除
    expect(manager.disabledFontFamilies().sort()).toEqual(['Fam B', 'Fam C'])
    expect(manager.isFontFamilyEnabled('Fam A')).toBe(true) // 批量替换清掉了 Fam A
    expect(manager.isFontFamilyEnabled('Fam B')).toBe(false)
    expect(manager.isFontFamilyEnabled('Inter')).toBe(true)
  })

  test('normalize 归一：关停基名连带 "X Variable" 后缀形态', () => {
    const manager = new FontManager()
    manager.setFontFamilyEnabled('Roboto Flex', false)
    expect(manager.isFontFamilyEnabled('Roboto Flex Variable')).toBe(false)
    expect(manager.isFontFamilyEnabled('Roboto Flex')).toBe(false)
  })
})

describe('注册表 VF 标记（D-b 收口登记）', () => {
  test('syst（Source Han Serif CN VF）回注册表：cdn 来源 + variable 标记 + T0 OFL', () => {
    const entry = fontRegistryEntry('Source Han Serif CN VF')
    expect(entry?.source).toBe('cdn')
    expect(entry?.variable).toBe(true)
    expect(entry?.tier).toBe('T0')
    expect(entry?.cdn?.package).toBe('@chinese-fonts/syst')
  })
})

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window
})
