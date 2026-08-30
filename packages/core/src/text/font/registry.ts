/**
 * 字体注册表与白名单（T39，S2 规格 §7）。
 *
 * 白名单语义边界（15 册 D.5「结构性约束而非 prompt 约束」）：
 * - 只管「应用提供/推荐」面——bundled 字体与在线字体 provider 的枚举/加载；
 * - 用户本地系统字体（local 源）不受限——那是用户自己的资产。
 *
 * tier 分级（chinese-font-selector 内化，15 册 D.5）：
 * - T0 = 开源 OFL（铁稳，可再分发）；T1 = 厂商免费商用（厂商保留收回权利，需标注）；
 * - T2 = 慎用/禁用（不入注册表）。
 */

export type FontLicenseTier = 'T0' | 'T1' | 'T2'

export interface FontRegistryEntry {
  family: string
  tier: FontLicenseTier
  license: string
  source: string
  /** bundled 字重样式名（与 BUNDLED_FONTS 键一致）；非 bundled 家族为空 */
  weights: string[]
  /** 授权备注（如 T1 的厂商收回权利警示） */
  note?: string
}

export const FONT_REGISTRY: FontRegistryEntry[] = [
  {
    family: 'Inter',
    tier: 'T0',
    license: 'OFL-1.1',
    source: 'bundled',
    weights: ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']
  },
  {
    family: 'Alibaba PuHuiTi',
    tier: 'T1',
    license: 'Alibaba 普惠体授权（免费商用，厂商保留收回权利）',
    source: 'bundled',
    weights: [
      'Thin',
      'Light',
      'Regular',
      'Medium',
      'SemiBold',
      'Bold',
      'ExtraBold',
      'Heavy',
      'Black'
    ],
    note: 'T1：厂商保留收回免费授权的权利，授权声明需存档（15 册 D.5 治理层）'
  },
  {
    family: 'Noto Naskh Arabic',
    tier: 'T0',
    license: 'OFL-1.1',
    source: 'bundled',
    weights: ['Regular']
  }
]

const bundledAllowlist = new Set(FONT_REGISTRY.map((entry) => entry.family))

export function fontRegistryEntry(family: string): FontRegistryEntry | undefined {
  return FONT_REGISTRY.find((entry) => entry.family === family)
}

/**
 * bundled 家族是否在白名单内。只约束 bundled 面；local/system 与 fallback
 * 专用家族不经此判定（fallback 链由 fallbacks.ts 独立管理）。
 */
export function isBundledFamilyAllowed(family: string): boolean {
  return bundledAllowlist.has(family)
}

/**
 * 在线 provider 枚举过滤：provider 家族默认放行（在线字体是通用能力，
 * 授权治理属用户选择）；本函数为后续「推荐集」收窄预留挂点。
 */
export function isProviderFamilyVisible(_family: string): boolean {
  return true
}
