/**
 * T66（Phase 3 W3）：generate_image provider 类型注册表（纯数据，同构——
 * 前端设置面板与后端凭证路由共用；不得引入 node 依赖）。
 *
 * 取代 T54 的 presets.ts（预设表把 baseUrl/model 焊死在代码里，P0 过度设计
 * 已删）：providerType 只决定「端点协议族」（请求/响应形状、鉴权方式），
 * baseUrl/model/apiKey 全部由用户手填并经凭证面落盘。
 *
 * 当前仅 'openai-compatible'（/images/generations + /images/edits，Bearer
 * 鉴权，OpenAI 官方与各类中转/兼容端通用）；为 Seedream 等第二协议族留位
 * （T66 不实现，见仓外 docs/202609010000-image-gen-provider-review.md §5）。
 */

export const IMAGE_GEN_PROVIDER_TYPES = [
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible (/v1/images)'
  }
] as const

export type ImageGenProviderType = (typeof IMAGE_GEN_PROVIDER_TYPES)[number]['id']

export const DEFAULT_IMAGE_GEN_PROVIDER_TYPE: ImageGenProviderType = 'openai-compatible'

export function isImageGenProviderType(value: unknown): value is ImageGenProviderType {
  return IMAGE_GEN_PROVIDER_TYPES.some((entry) => entry.id === value)
}
