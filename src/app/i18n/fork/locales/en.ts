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

/** T54：generate_image 凭证面板（SettingsDialog media 分区；预设下拉 + 单 key 输入）英文默认值 */
export const imageGenMessageDefaults = {
  imageGenTitle: 'Image generation',
  imageGenDescription:
    'Credentials for the generate_image tool, held by the local pi backend (separate from the chat LLM key). Pick a provider preset, then paste its API key.',
  imageGenProvider: 'Provider preset',
  imageGenKeyPlaceholderConfigured: 'Key saved — enter a new key to replace',
  imageGenKeyPlaceholderMissing: 'Paste API key',
  imageGenKeySave: 'Save key',
  imageGenKeyClear: 'Clear key',
  imageGenConfigured: 'Configured',
  imageGenNotConfigured: 'Not configured',
  imageGenOffline: 'pi backend unreachable — start the dev server with `bun run dev`.'
} as const

/** T56：ask_user_question 聊天内表单卡片（AskUserQuestionCard）英文默认值 */
export const askMessageDefaults = {
  askFormTitle: 'The AI is asking a few questions',
  askSubmit: 'Submit answers',
  askSkip: 'Skip this form',
  askSkipPlaceholder: 'Other / additional notes (optional)…',
  askRequiredHint: 'Please answer the required questions first',
  askOptional: 'Optional',
  askTextPlaceholder: 'Type your answer…',
  askAnswered: 'Answered',
  askSkipped: 'Skipped',
  askImageUnavailable: 'Preview unavailable',
  askInvalidDefinition: 'This form definition is invalid and cannot be answered.'
} as const

/** T61：输入条 chips（mode/type/profile 两级数据驱动）+ gallery + manifest 失败条 英文默认值 */
export const chipsMessageDefaults = {
  chipsMode: 'Mode',
  chipsProfile: 'Style',
  chipsNoProfile: 'No style profile',
  chipsPendingBadge: 'New design intent',
  chipsManifestFailed: 'AI studio failed to load — selectors are disabled.',
  chipsRetry: 'Retry',
  chipsDesigns: 'Designs',
  chipsBriefs: 'Briefs',
  chipsGallery: 'Gallery',
  galleryTitle: 'Mode & profile gallery',
  galleryModes: 'Modes',
  galleryProfiles: 'Style profiles',
  galleryEmpty: 'Nothing to show — the studio manifest is empty.',
  galleryReadonlyHint: 'Read-only. Modes and profiles are local files on disk.'
} as const

/** T61：设计列表面板 + 需求单面板（S1 §5 三段结构）英文默认值 */
export const panelsMessageDefaults = {
  designsTitle: 'Designs on this page',
  designsEmpty: 'No marketing designs on this page yet.',
  designsActive: 'Current',
  designsSetCurrent: 'Set as current',
  designsSetting: 'Switching…',
  designsLocateHint:
    'Click an entry to locate it on the canvas — switching only happens via the button.',
  designsSwitchFailed: 'Failed to set the current design.',
  briefsTitle: 'Briefs',
  briefCurrentTarget: 'Current target',
  briefNoActive: 'No active design yet.',
  briefNoBriefBound: 'No brief bound',
  briefListSection: 'All briefs',
  briefListEmpty: 'No briefs in this document yet.',
  briefContainsActive: 'Contains current target',
  briefBack: 'Back',
  briefOpenFailed: 'This brief could not be read (structure incomplete).',
  briefContent: 'Content',
  briefMaterials: 'Materials',
  briefConclusions: 'AI conclusions',
  briefDesigns: 'Linked designs',
  briefEmptySection: 'Empty',
  briefSave: 'Save',
  briefSaved: 'Saved',
  briefSaveFailed: 'Save failed'
} as const

/** T61：新建意图确认卡 + set_active_design 同意卡 英文默认值 */
export const confirmMessageDefaults = {
  intentTitle: 'Start a new design?',
  intentCaseALine: 'The current direction draft will be discarded; a new design area starts fresh.',
  intentCaseBKeep: 'Existing artifacts stay on the canvas — nothing is overwritten.',
  intentCaseBNew: 'A new design area starts with the selected mode / profile.',
  intentCaseBMaterials: 'Brief materials carry over automatically.',
  intentCaseBReferences: 'Include already-generated images as references',
  intentCaseBRadius:
    'Abandonment radius: only the previous direction — everything produced so far is kept.',
  intentConfirm: 'Confirm & send',
  intentCancel: 'Cancel',
  intentConfirmedBadge: 'Confirmed',
  intentCancelledBadge: 'Cancelled',
  consentTitle: 'The AI asks to switch the current design',
  consentTarget: params('Target: {name}'),
  consentAgree: 'Switch to it',
  consentDecline: 'Keep current',
  consentAgreedBadge: 'Switched',
  consentDeclinedBadge: 'Declined',
  consentAgreedLine: params('Current design switched to {name}.'),
  consentDeclinedLine: params('Declined switching to {name} — the current design is unchanged.'),
  consentFailedLine: 'Switch failed — the target design may have been moved or deleted.'
} as const

/** T41：字体白名单设置面板（SettingsDialog fonts 分区）英文默认值；T42：来源开关 + 目录组 + 筛选/折叠/批量 */
export const fontsMessageDefaults = {
  settingsFonts: 'Fonts',
  fontsPanelTitle: 'Font allowlist',
  fontsPanelDescription:
    'Enable or disable font families across all sources. A disabled font is treated as not installed: it disappears from the font picker and documents fall back to the next available font.',
  fontsSearchPlaceholder: 'Search fonts…',
  fontsLoading: 'Loading fonts…',
  fontsEmpty: 'No fonts match your search.',
  fontsEnabledSummary: params('{enabled} of {total} families enabled'),
  fontsSourceBundled: 'Built-in',
  fontsSourceCdn: 'CDN featured',
  fontsSourceCatalog: 'CDN catalog',
  fontsSourceLocal: 'System',
  fontsSourceOnline: 'Online',
  fontsLockedHint: 'Built-in fonts stay always on — they are the rendering fallback.',
  fontsLocalAccessPrompt: 'Allow access to system fonts to manage them here.',
  fontsLocalAllow: 'Allow system fonts',
  fontsVariableBadge: 'Variable',
  fontsFilterAll: 'All',
  fontsFilterEnabled: 'Enabled',
  fontsFilterDisabled: 'Disabled',
  fontsEnableAll: 'Enable all',
  fontsDisableAll: 'Disable all',
  fontsShowMore: params('Show more ({count} remaining)'),
  fontsOnlineMaster: 'Online font libraries',
  fontsCnMaster: 'Chinese Fonts CDN (中文网字计划)',
  fontsCnMasterHint: 'Independent switch — not affected by the online font libraries toggle.',
  fontsSourceOffHint: 'This source is off — its families are hidden from the list and picker.',
  fontsUnauditedLicense: params('License: {license} (per package notice, unaudited)'),
  fontsCatalogHint:
    'Full Chinese Fonts CDN catalog. Off by default — enabled families appear in the picker and load subset pieces on demand.'
} as const
