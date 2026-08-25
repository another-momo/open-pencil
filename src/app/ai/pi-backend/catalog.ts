/**
 * T27 catalog DTO 共享契约（GET /api/pi/catalog 响应形状）。
 *
 * 独立成纯类型模块的原因同 ./session-summary.ts：后端 provider-admin.ts
 * （node:fs）与前端 client.ts（浏览器包）都需要该形状，而 test:type-shapes
 * 禁止两处同构定义（此处曾是「可选性不同的近似双形状」逃逸查重——kimi M-4）；
 * 本文件零运行时 import，浏览器侧 type-only 引用在构建期擦除、不带入 node 依赖。
 *
 * 字段可选性以后端实际序列化为准（provider-admin getCatalog 恒填全量字段；
 * baseUrl 仅在有值时带，auth.type/source 同理）。
 */
export type PiCatalogModel = {
  id: string
  name: string
  api: string
  reasoning: boolean
  input: string[]
  contextWindow: number
  maxTokens: number
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
}

export type PiCatalogProvider = {
  id: string
  name: string
  baseUrl?: string
  auth: { configured: boolean; type?: 'api_key' | 'oauth'; source?: string }
  models: PiCatalogModel[]
}

export type PiCatalog = { providers: PiCatalogProvider[] }
