/**
 * T77 P6：Seedream 兼容 provider（火山方舟 /api/v3/images）——
 * 共用 provider.createProviderCore 核心，仅注入族差异 wire：
 * - background 固定 'opaque'（Seedream 不接受 'auto'——仅 'opaque' /
 *   'transparent'，详见 docs/202609010000-image-gen-provider-review.md
 *   §2 P7 差异表与 §5 兼容性矩阵）
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
 * 注册：provider-types.ts IMAGE_GEN_PROVIDER_TYPES 加 'seedream' 条目；
 * credentials.ts isImageGenProviderType 自动放行；分派见 factory.ts。
 */

import type { ImageGenProvider } from '@open-pencil/core/tools/fork/image-gen/requests'

import { createProviderCore, type ImageGenProviderOptions } from './provider'

export function createSeedreamImageGenProvider(options: ImageGenProviderOptions): ImageGenProvider {
  return createProviderCore(options, {
    name: `seedream(${options.credentials.model})`,
    background: 'opaque',
    extraFields: { watermark: false }
  })
}
