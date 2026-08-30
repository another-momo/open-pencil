/**
 * T42 S1 生成目录契约单测：cn-catalog.ts 是 tools/cn-font-catalog/build.mjs 的
 * 提交产物（运行时零枚举，D-b）。钉住结构契约，防手改/再生成漂移；
 * 重跑管线更新目录后本文件断言须同步复核。
 */
import { describe, expect, test } from 'bun:test'

import { CN_FONT_CATALOG, cnCatalogEntry, isCnCatalogFamily } from '#core/text/font/cn-catalog'
import { FONT_REGISTRY } from '#core/text/font/registry'

describe('CN_FONT_CATALOG 结构契约（T42 S1 生成物）', () => {
  test('必填字段齐全：family/package/version/license/weights 非空，variable 为布尔', () => {
    expect(CN_FONT_CATALOG.length).toBeGreaterThan(0)
    for (const entry of CN_FONT_CATALOG) {
      expect(entry.family.length).toBeGreaterThan(0)
      expect(entry.package.startsWith('@chinese-fonts/')).toBe(true)
      expect(entry.version.length).toBeGreaterThan(0)
      expect(entry.license.length).toBeGreaterThan(0)
      expect(typeof entry.variable).toBe('boolean')
      expect(entry.weights.length).toBeGreaterThan(0)
    }
  })

  test('weights 升序且为正整数；VF 族恰为区间端点两枚', () => {
    for (const entry of CN_FONT_CATALOG) {
      expect(entry.weights).toEqual([...entry.weights].sort((a, b) => a - b))
      for (const weight of entry.weights) {
        expect(Number.isInteger(weight)).toBe(true)
        expect(weight).toBeGreaterThan(0)
      }
      if (entry.variable) expect(entry.weights).toHaveLength(2)
    }
  })

  test('family 全局唯一；cnCatalogEntry/isCnCatalogFamily 命中一致', () => {
    expect(new Set(CN_FONT_CATALOG.map((entry) => entry.family)).size).toBe(CN_FONT_CATALOG.length)
    for (const entry of CN_FONT_CATALOG) {
      expect(cnCatalogEntry(entry.family)).toBe(entry)
      expect(isCnCatalogFamily(entry.family)).toBe(true)
    }
    expect(cnCatalogEntry('Inter')).toBeUndefined()
    expect(isCnCatalogFamily('不存在的字体')).toBe(false)
  })

  test('registry 精选 6 包的家族不入 catalog（精选层优先，D-b 分层）', () => {
    const registryPackages = new Set(
      FONT_REGISTRY.filter((entry) => entry.source === 'cdn').map((entry) => entry.cdn?.package)
    )
    expect(registryPackages.size).toBeGreaterThan(0)
    for (const entry of CN_FONT_CATALOG) {
      expect(registryPackages.has(entry.package)).toBe(false)
    }
  })

  test('registry cdn 家族不被 catalog 遮蔽（isCnCatalogFamily 恒假）', () => {
    for (const entry of FONT_REGISTRY) {
      if (entry.source !== 'cdn') continue
      expect(isCnCatalogFamily(entry.family)).toBe(false)
    }
  })

  test('unpkg 回退族带 base 钉扎（jsdelivr 不可达非 ASCII 目录，S1 探针实录）', () => {
    const withBase = CN_FONT_CATALOG.filter((entry) => entry.base !== undefined)
    // 2026-08-30 构建实录 37 族；只钉 >0 契约，不钉死数目（重跑管线允许漂移）
    expect(withBase.length).toBeGreaterThan(0)
    for (const entry of withBase) {
      expect(entry.base?.startsWith('https://')).toBe(true)
    }
  })

  test('收录族含 VF（小禾简化 VF 区间字重 250-900，xiaohe-simplify@2.0.0）', () => {
    const variable = CN_FONT_CATALOG.filter((entry) => entry.variable)
    expect(variable.length).toBeGreaterThan(0)
    for (const entry of variable) {
      expect(entry.weights[0]).toBeLessThan(entry.weights[1])
    }
  })
})
