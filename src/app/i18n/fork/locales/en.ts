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

/**
 * T61：输入条 chips（mode/profile 两级数据驱动）+ manifest 失败条 英文默认值。
 * T65：gallery 键删除（组件退役，决策 B3）；pending badge 内容化「将新建：…」
 * + 可撤销（决策 E）；chips 区空槽引导一行（决策 E/B2）。
 */
export const chipsMessageDefaults = {
  chipsMode: 'Mode',
  chipsProfile: 'Style',
  chipsNoProfile: 'No style profile',
  chipsPendingLabel: params('Will create: {mode} · {profile}'),
  chipsPendingUndo: 'Undo the new-design intent',
  chipsEmptyHint: 'No current design — sending a message starts a new one.',
  chipsManifestFailed: 'AI studio failed to load — selectors are disabled.',
  chipsRetry: 'Retry'
} as const

/**
 * T61：设计列表面板 + 需求单面板英文默认值；T65 重写：三合一为画布工作状态
 * 面板（ChatContextBar，决策 B2）——①当前目标卡 ②设计区列表 ③需求单列表 +
 * 详情编辑视图。扫描统一只扫当前页（决策 D4），标题文案明示「当前页面」。
 */
export const panelsMessageDefaults = {
  contextTriggerLabel: 'Canvas state',
  contextTriggerEmpty: 'New design',
  targetSection: 'Current target',
  targetNoActive: 'No active design yet — pick a mode / style and send a message to start one.',
  targetNoBriefBound: 'No brief bound',
  designsSection: 'Designs on this page',
  designsEmpty: 'No marketing designs on this page yet.',
  designsActive: 'Current',
  designsSetCurrent: 'Set as current',
  designsSetting: 'Switching…',
  designsLocateHint:
    'Current page only. Click an entry to locate it on the canvas — switching only happens via the button.',
  designsSwitchFailed: 'Failed to set the current design.',
  briefsSection: 'Briefs on this page',
  briefListEmpty: 'No briefs on this page yet.',
  briefContainsActive: 'Contains current target',
  briefNew: 'New brief',
  briefNewPlaceholder: 'Requirement content (optional)…',
  briefCreate: 'Create',
  briefCreateCancel: 'Cancel',
  briefCreateFailed: 'Failed to create the brief.',
  briefBack: 'Back',
  briefOpenFailed: 'This brief could not be read (structure incomplete).',
  briefContent: 'Content',
  briefMaterials: 'Materials',
  briefConclusions: 'AI conclusions',
  briefDesigns: 'Linked designs',
  briefEmptySection: 'Empty',
  briefSave: 'Save',
  briefSaved: 'Saved',
  briefSaveFailed: 'Save failed',
  briefDirtyHint: 'Unsaved brief edits.',
  briefDiscardClose: 'Discard & close',
  briefDiscardBack: 'Discard & go back',
  briefKeepEditing: 'Keep editing'
} as const

/**
 * T61：新建意图确认卡 + set_active_design 同意卡 英文默认值。
 * T65：确认卡尺寸行（决策 C：预设 chips + 自定义输入）；切换成功回执 =
 * 对话流分割线（决策 D3，consentAgreedLine 随之退役）；卡片降权为系统视觉。
 */
export const confirmMessageDefaults = {
  intentTitle: 'Start a new design?',
  intentCaseALine: 'The current direction draft will be discarded; a new design area starts fresh.',
  intentCaseBKeep: 'Existing artifacts stay on the canvas — nothing is overwritten.',
  intentCaseBNew: 'A new design area starts with the selected mode / profile.',
  intentCaseBMaterials: 'Brief materials carry over automatically.',
  intentCaseBReferences: 'Include already-generated images as references',
  intentCaseBRadius:
    'Abandonment radius: only the previous direction — everything produced so far is kept.',
  intentSizeSection: 'Canvas size',
  intentSizeAuto: 'Auto (AI decides)',
  intentSizeCustomPlaceholder: 'Custom, e.g. 750x or 750x2000',
  intentSizeInvalid: 'Size format: Wx or WxH (e.g. 750x2000).',
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
  consentDeclinedLine: params('Declined switching to {name} — the current design is unchanged.'),
  consentFailedLine: 'Switch failed — the target design may have been moved or deleted.',
  contextSwitchLine: params('—— Switched to {name} ——')
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
