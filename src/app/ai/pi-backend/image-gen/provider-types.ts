/**
 * T66（Phase 3 W3）：generate_image provider 类型注册表（纯数据，同构——
 * 前端设置面板与后端凭证路由共用；不得引入 node 依赖）。
 *
 * 取代 T54 的 presets.ts（预设表把 baseUrl/model 焊死在代码里，P0 过度设计
 * 已删）：providerType 只决定「端点协议族」（请求/响应形状、鉴权方式），
 * baseUrl/model/apiKey 全部由用户手填并经凭证面落盘。
 *
 * 当前两族：
 * - 'openai-compatible'（/images/generations + /images/edits，Bearer
 *   鉴权，OpenAI 官方与各类中转/兼容端通用；provider.ts 承载）
 * - 'seedream'（T77 P6：火山方舟 /api/v3/images，与 OpenAI 兼容族同协议
 *   形状，差异为 watermark 默认 true / background 不接受 'auto'；
 *   provider-seedream.ts 承载）
 *
 * T77 P6：数组元素加可选 placeholder 字段（baseUrlPlaceholder /
 * modelPlaceholder）——设置面板按选中族回填默认占位文案（缺省时回退
 * i18n）。ImageGenProviderType 联合改手写字面量以稳定类型层语义
 * （编译器无法验证注册表增删与联合一致性，靠 provider-seedream.test.ts
 * 的注册表钉扎断言兜底）。
 */

export interface ImageGenProviderTypeEntry {
  id: string
  label: string
  /** 设置面板 baseUrl 输入框占位文案；缺省回退 i18n imageGenBaseUrlPlaceholder */
  baseUrlPlaceholder?: string
  /** 设置面板 model 输入框占位文案；缺省回退 i18n imageGenModelPlaceholder */
  modelPlaceholder?: string
}

export const IMAGE_GEN_PROVIDER_TYPES: readonly ImageGenProviderTypeEntry[] = [
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible (/v1/images)'
  },
  {
    id: 'seedream',
    label: 'Seedream-compatible (/api/v3/images)',
    baseUrlPlaceholder: 'https://ark.cn-beijing.volces.com/api/v3',
    modelPlaceholder: 'doubao-seedream-5-0-lite'
  }
]

/**
 * 注册表 id 的字面量联合。手写而非 `(typeof IMAGE_GEN_PROVIDER_TYPES)[number]['id']`
 * 推导——保证类型层稳定，注册表增删条目须同步更新此处。注册表一致性靠
 * provider-seedream.test.ts 钉扎断言兜底（不允许注册表偏离联合）。
 */
export type ImageGenProviderType = 'openai-compatible' | 'seedream'

export const DEFAULT_IMAGE_GEN_PROVIDER_TYPE: ImageGenProviderType = 'openai-compatible'

export function isImageGenProviderType(value: unknown): value is ImageGenProviderType {
  return IMAGE_GEN_PROVIDER_TYPES.some((entry) => entry.id === value)
}
