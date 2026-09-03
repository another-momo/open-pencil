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
  modelSearchPlaceholder: 'Search models…',
  modelSearchEmpty: 'No models match your search.',
  modelSupportsImage: 'Image input',
  providerSearchPlaceholder: 'Search providers…',
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
  designPickerEmpty: 'No matches.',
  thinkingLevel: 'Thinking level',
  thinkingOff: 'Off',
  thinkingMinimal: 'Minimal',
  thinkingLow: 'Low',
  thinkingMedium: 'Medium',
  thinkingHigh: 'High',
  thinkingExtraHigh: 'Extra high'
} as const

/** T54→T66：generate_image 凭证面板（SettingsDialog media 分区；Provider 类型下拉 + baseUrl/model/key 输入 + 测试连接）英文默认值 */
export const imageGenMessageDefaults = {
  imageGenTitle: 'Image generation',
  imageGenDescription:
    'Credentials for the generate_image tool, held by the local pi backend (separate from the chat LLM key). Pick the provider type, then enter its base URL, model and API key.',
  imageGenProvider: 'Provider type',
  imageGenBaseUrl: 'Base URL',
  imageGenBaseUrlPlaceholder: 'https://api.openai.com/v1',
  imageGenModel: 'Model',
  imageGenModelPlaceholder: 'gpt-image-1',
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
 * + 可撤销（决策 E）。T66：chipsEmptyHint 删除——空槽引导收敛进 ChatContextBar
 * 双段式 trigger（决策①），输入条零状态显示。
 * T70：chipsCaptureSelection / chipsCaptureEmpty——「采集画布选区」按钮 +
 * 空选区轻提示（ChatInput attachment 槽；空选区不产生 token）。
 */
export const chipsMessageDefaults = {
  chipsMode: 'Mode',
  chipsProfile: 'Style',
  chipsNoProfile: 'No style profile',
  chipsPendingLabel: params('Will create: {mode} · {profile}'),
  chipsPendingUndo: 'Undo the new-design intent',
  chipsManifestFailed: 'AI studio failed to load — selectors are disabled.',
  chipsRetry: 'Retry',
  chipsCaptureSelection: 'Capture canvas selection',
  chipsCaptureEmpty: 'Nothing selected on the canvas',
  // T89：skill dropdown trigger + 搜索占位 + 空匹配提示
  chipsSkillChoose: 'Choose a skill',
  chipsSkillSearchPlaceholder: 'Search skills…',
  chipsSkillEmpty: 'No skills match'
} as const

/**
 * T87→T89：settings 面板 Agent 能力分区——单 AppSwitch + 一行 label。
 * T89：删除 title + description 二键（啰嗦），skillLabel 收敛为「进阶能力」。
 */
export const agentCapabilitiesMessageDefaults = {
  agentCapabilitiesSkillLabel: 'Advanced capabilities (read / write / edit / bash / skill)',
  agentCapabilitiesSaving: 'Saving…',
  agentCapabilitiesError: params('Failed to save: {message}')
} as const

/**
 * T61：设计列表面板 + 需求单面板英文默认值；T65 重写：三合一为画布工作状态
 * 面板（ChatContextBar，决策 B2）——①当前目标卡 ②设计区列表 ③需求单列表。
 * 扫描统一只扫当前页（决策 D4），标题文案明示「当前页面」。
 * T66：trigger 双段式状态文案（决策①，「当前设计区：X | 需求单：N」）；
 * 详情编辑迁出 popover 进 ChatBriefDialog 大面板（决策②）——briefBack /
 * briefDiscardBack / briefSave 随 popover 详情视图退役，新增 dialog 素材四能力
 * 键组（上传 / 选区添加 / 删除 / 缩略图 caption）。
 */
export const panelsMessageDefaults = {
  contextTriggerLabel: 'Canvas state',
  contextTriggerDesignLabel: 'Design: ',
  contextTriggerDesignEmpty: 'Not created',
  contextTriggerBriefsLabel: 'Briefs: ',
  contextTriggerBriefsEmpty: 'None',
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
  briefDirtyHint: 'Unsaved brief edits.',
  briefDiscardClose: 'Discard & close',
  briefKeepEditing: 'Keep editing',
  briefDialogTitle: 'Brief',
  briefDialogDescription:
    'Content and materials are written back to the canvas brief — the canvas stays the single source of truth.',
  briefOpenFailed: 'This brief could not be read (structure incomplete).',
  briefDialogMissing: 'This brief is no longer on the canvas (it may have been deleted).',
  briefContent: 'Content',
  briefContentPlaceholder:
    'What to make, who it is for, must-include content, how to use the materials — the more complete, the less the AI has to guess.',
  briefMaterials: 'Materials',
  briefMaterialCaptionPlaceholder: 'Note its use (e.g. hero / style reference only)…',
  briefMaterialAdd: 'Upload image',
  briefMaterialAddSelection: params('Add from selection ({count})'),
  briefMaterialRemove: 'Remove material',
  briefConclusions: 'AI conclusions',
  briefDesigns: 'Linked designs',
  briefEmptySection: 'Empty',
  briefSaved: 'Saved',
  briefSaveFailed: 'Save failed',
  briefApplyFailed: 'Operation failed — please retry.'
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
