/**
 * T35：fork seam pi 段英文默认值。仿 src/app/i18n/notifications/index.ts 的
 * `notificationMessageDefaults` 模式——fork zone 自带 en 默认值，
 * zh-CN locale pack 在 locales/zh-cn.ts 提供中文覆盖。
 *
 * 历史教训：T21 把 pi 段硬塞进 packages/vue/src/i18n/messages/dialogs.ts
 * 是绕过了 fork seam 的反模式，导致 T31/T34 反复被上游 dialogs.json 撞。
 * T35 撤销 P38/P40，把英文 + 中文都搬到 fork zone（ownedRoot `src/app/i18n/fork/`）。
 */
import { params } from '@nanostores/i18n'

export const piMessageDefaults = {
  modelsDescription:
    'Providers, credentials, and the design model are managed by the local pi backend.',
  catalogRefresh: 'Refresh',
  catalogOffline: 'pi backend unreachable — start the dev server with `bun run dev`.',
  providerModels: params('{count} models'),
  keyPlaceholderConfigured: 'Key saved — enter a new key to replace',
  keyPlaceholderMissing: 'Paste API key',
  keySave: 'Save key',
  keyClear: 'Clear key',
  addProvider: 'Add custom provider',
  providerId: 'Provider ID',
  providerBaseUrl: 'Base URL',
  providerApi: 'API type',
  providerModelIds: 'Model IDs (one per line)',
  providerSave: 'Save provider',
  designModel: 'Design model',
  designModelDescription:
    'Model used by the AI chat agent. Credentials come from the provider entry above.',
  designProvider: 'Provider',
  designModelField: 'Model',
  designModelSave: 'Save',
  designModelDefault: 'Backend default (openrouter/free)',
  thinkingLevel: 'Thinking level',
  thinkingOff: 'Off',
  thinkingMinimal: 'Minimal',
  thinkingLow: 'Low',
  thinkingMedium: 'Medium',
  thinkingHigh: 'High',
  thinkingExtraHigh: 'Extra high'
} as const
