/**
 * T24 brand manifest 契约（type-only 单源，同 session-summary.ts 先例）：
 * GET /api/pi/brand/manifest 的响应形状，前后端共用。type-shapes 门禁禁止
 * 同构类型重复定义——浏览器侧 import type 构建期擦除。
 *
 * manifest 是种子 YAML 的脱敏投影：profile 的 markdown 正文只进 prompt
 * （后端读取），不下发前端（T24-plan D7 信任边界）。
 */

export type PiBrandMaterialType = {
  id: string
  label: string
  size?: string
  description?: string
}

export type PiBrandStyleProfileSummary = {
  id: string
  label: string
  applicableTo: string[]
}

export type PiBrandManifest = {
  name: string
  types: PiBrandMaterialType[]
  profiles: PiBrandStyleProfileSummary[]
}
