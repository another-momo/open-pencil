/**
 * T77 P6：provider factory 分派层——按 credentials.providerType 路由至
 * 对应工厂（OpenAI 兼容族 → createImageGenProvider；Seedream 族 →
 * createSeedreamImageGenProvider）。generate.ts 缺省工厂改调此处。
 *
 * 缺省值 = 'openai-compatible'（T66 起注册表唯一稳定族；未知 providerType
 * 兜底同 openai-compatible 而非抛错——既保持向后兼容，也允许未来注册表
 * 扩展时不破坏旧凭证面）。新增族 = 在此处分派 + 注册表加条目 + provider-types
 * 联合扩展；credentials.ts 的 isImageGenProviderType 校验拒绝未登记 id，
 * 故此处分派实际只会收到两个登记值之一。
 *
 * 不持有状态；纯路由。options（fetchImpl/timeoutMs）透传各工厂以便测试注入。
 */

import type { ImageGenCredentials } from './credentials'
import { createImageGenProvider, type ImageGenProviderOptions } from './provider'
import { createSeedreamImageGenProvider } from './provider-seedream'

export function createProviderFor(
  credentials: ImageGenCredentials,
  options: Omit<ImageGenProviderOptions, 'credentials'> = {}
): ReturnType<typeof createImageGenProvider> {
  if (credentials.providerType === 'seedream') {
    return createSeedreamImageGenProvider({ ...options, credentials })
  }
  return createImageGenProvider({ ...options, credentials })
}
