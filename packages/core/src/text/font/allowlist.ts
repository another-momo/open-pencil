/**
 * 字体白名单运行时管控（T41 S4，owner /goal 2026-08-30）。
 *
 * 语义（对 T39 编译期白名单的扩展）：
 * - 管控范围覆盖**全部来源**（bundled / cdn / provider / local 系统字体）的枚举与加载；
 * - 存「被关停」集合——新枚举到的字体默认启用（新装系统字体不需要手动加白）；
 * - **catalog 族（T42，中文网字计划全量目录）默认停用（opt-in，D-c）**：
 *   目录 105 族全量可管理但默认不进 picker，用户显式开启后计入 enabledCatalog；
 * - bundled 家族（registry source==='bundled'）是各处逻辑的兜底选项，**锁定恒开**：
 *   setEnabled 对其为 no-op 并告警（D-d）。
 *
 * 状态机独立于 fonts.ts（行数治理），FontManager 持实例委托接线。
 */

import { isCnCatalogFamily } from '#core/text/font/cn-catalog'
import { isBundledFamilyAllowed } from '#core/text/font/registry'
import { normalizeFontFamily } from '#core/text/font/style'

export class FontFamilyAllowlist {
  private readonly disabled = new Set<string>()
  private readonly enabledCatalog = new Set<string>()
  private revision = 0

  /** bundled 兜底家族锁定恒开（D-d） */
  isLocked(family: string): boolean {
    return isBundledFamilyAllowed(family)
  }

  isEnabled(family: string): boolean {
    if (this.isLocked(family)) return true
    // catalog 族 opt-in（T42 D-c）：只看 enabledCatalog，disabled 集合不参与
    if (isCnCatalogFamily(family)) return this.catalogOverrideHit(family)
    if (this.disabled.has(family)) return false
    const normalized = normalizeFontFamily(family)
    return normalized === family || !this.disabled.has(normalized)
  }

  /** 返回 false = 家族被锁定（bundled），操作未生效 */
  setEnabled(family: string, enabled: boolean): boolean {
    if (this.isLocked(family)) {
      console.warn(`Bundled font "${family}" is locked in the allowlist (fallback role)`)
      return false
    }
    if (isCnCatalogFamily(family)) {
      const next = new Set(this.enabledCatalog)
      if (enabled) next.add(family)
      else next.delete(family)
      return this.commitCatalog(next)
    }
    const next = new Set(this.disabled)
    if (enabled) next.delete(family)
    else next.add(family)
    return this.commit(next)
  }

  /** 全量替换 disabled 集合（持久化恢复/批量导入）；锁定族自动滤除 */
  replaceDisabled(families: Iterable<string>): void {
    const next = new Set<string>()
    for (const family of families) {
      if (!this.isLocked(family)) next.add(family)
    }
    this.commit(next)
  }

  /** 全量替换 catalog 启用集合（持久化恢复）；非 catalog 族自动滤除 */
  replaceEnabledCatalog(families: Iterable<string>): void {
    const next = new Set<string>()
    for (const family of families) {
      if (isCnCatalogFamily(family)) next.add(family)
    }
    this.commitCatalog(next)
  }

  listDisabled(): string[] {
    return [...this.disabled]
  }

  listEnabledCatalog(): string[] {
    return [...this.enabledCatalog]
  }

  /** 失效信号：picker 等一次性缓存消费方监听此计数重建列表（D-h） */
  getRevision(): number {
    return this.revision
  }

  private catalogOverrideHit(family: string): boolean {
    if (this.enabledCatalog.has(family)) return true
    const normalized = normalizeFontFamily(family)
    return normalized !== family && this.enabledCatalog.has(normalized)
  }

  private commit(next: Set<string>): boolean {
    if (next.size === this.disabled.size && [...next].every((f) => this.disabled.has(f))) {
      return true // 无变化（重复开关同态），revision 不空转
    }
    this.disabled.clear()
    for (const family of next) this.disabled.add(family)
    this.revision++
    return true
  }

  private commitCatalog(next: Set<string>): boolean {
    if (
      next.size === this.enabledCatalog.size &&
      [...next].every((f) => this.enabledCatalog.has(f))
    ) {
      return true
    }
    this.enabledCatalog.clear()
    for (const family of next) this.enabledCatalog.add(family)
    this.revision++
    return true
  }
}
