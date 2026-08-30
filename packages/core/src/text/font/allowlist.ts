/**
 * 字体白名单运行时管控（T41 S4，owner /goal 2026-08-30）。
 *
 * 语义（对 T39 编译期白名单的扩展）：
 * - 管控范围覆盖**全部来源**（bundled / cdn / provider / local 系统字体）的枚举与加载；
 * - 存「被关停」集合——新枚举到的字体默认启用（新装系统字体不需要手动加白）；
 * - bundled 家族（registry source==='bundled'）是各处逻辑的兜底选项，**锁定恒开**：
 *   setEnabled 对其为 no-op 并告警（D-d）。
 *
 * 状态机独立于 fonts.ts（行数治理），FontManager 持实例委托接线。
 */

import { isBundledFamilyAllowed } from '#core/text/font/registry'
import { normalizeFontFamily } from '#core/text/font/style'

export class FontFamilyAllowlist {
  private readonly disabled = new Set<string>()
  private revision = 0

  /** bundled 兜底家族锁定恒开（D-d） */
  isLocked(family: string): boolean {
    return isBundledFamilyAllowed(family)
  }

  isEnabled(family: string): boolean {
    if (this.isLocked(family)) return true
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

  listDisabled(): string[] {
    return [...this.disabled]
  }

  /** 失效信号：picker 等一次性缓存消费方监听此计数重建列表（D-h） */
  getRevision(): number {
    return this.revision
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
}
