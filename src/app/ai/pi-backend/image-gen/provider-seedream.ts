/**
 * T77 P6：Seedream 兼容 provider（火山方舟 /api/v3/images）——
 * 共用 provider.createProviderCore 核心，仅注入族差异 wire：
 * - background 兜底 'opaque'（Seedream 不接受 'auto'——仅 'opaque' /
 *   'transparent'，详见 docs/202609010000-image-gen-provider-review.md
 *   §2 P7 差异表与 §5 兼容性矩阵）。agent 显式 transparent_background=false
 *   也走 'opaque'；true 路径由 generate.ts 检测 transparentSupport==='local'
 *   后改走 prompt 注入 + 后处理，不经本 provider 的 background 字段。
 * - extraFields: { watermark: false }——Seedream 默认开启水印，须显式
 *   关闭；该字段在 core 内部 FormData/JSON 双路径自动展开
 * - 端点协议族与 OpenAI 兼容族同形（/images/generations + /images/edits，
 *   Bearer 鉴权，{data:[{url|b64_json}]} 响应），故无须另写请求/响应解析；
 *   唯一族差异即 wire（背景 + 水印）。
 *
 * 与 OpenAI 兼容族的差异表（据源文档 §2 P6）：
 * | 字段         | OpenAI         | Seedream            | 本 provider 处理 |
 * | watermark      | 不发送          | 默认 true           | 显式 false       |
 * | background     | 'auto'（默认）  | 'opaque'（安全默认）| wire.background  |
 * | output_format  | 'png'（默认）   | 'jpeg'（默认）      | 由 core 透传 req.outputFormat（缺省 png） |
 *
 * transparentSupport='local'：Seedream 不支持原生透明背景，agent 走
 * transparent_background=true 时 generate.ts 检测本字段后改走 prompt
 * 注入 + 后处理路径。
 *
 * 注册：provider-types.ts IMAGE_GEN_PROVIDER_TYPES 加 'seedream' 条目；
 * credentials.ts isImageGenProviderType 自动放行；分派见 factory.ts。
 */

import type { ImageGenProvider } from '@open-pencil/core/tools/fork/image-gen/requests'

import { createProviderCore, type ImageGenProviderOptions } from './provider'

export function createSeedreamImageGenProvider(options: ImageGenProviderOptions): ImageGenProvider {
  const provider = createProviderCore(options, {
    name: `seedream(${options.credentials.model})`,
    background: 'opaque',
    extraFields: { watermark: false }
  })
  // 共用核心硬编码 transparentSupport='api'（OpenAI 兼容路径），Seedream
  // 不支持原生透明——显式覆盖为 'local'，触发 generate.ts 的 prompt 注入 +
  // 后处理路径。该赋值发生在 createProviderCore 返回之后，类型层 narrow 到
  // literal 不影响读取侧（property 非 readonly）。
  return Object.assign(provider, { transparentSupport: 'local' as const })
}
