/**
 * T35：27 条 pi 段 i18n key 从 packages/vue/src/i18n/locales/zh-cn/dialogs.json
 * 迁回本 fork seam——绕开上游 dialogs.json 重构反复撞我们自有内容的死循环。
 *
 * 上游 dialogs.json 仅承载 T20/T22 引入前的全局 i18n 文案；pi 后端专属文案
 * 是 fork zone（ownedRoot `src/app/i18n/fork/`），不属于上游合并面。
 *
 * 历史教训：
 * - T31 合并第二轮：上游 messages+zh-cn 覆盖冲掉 26 个 pi* key，按 HEAD 定义
 *   合并回写（commit c0c1f117 实录）
 * - T34 合并第三轮：dialogs.json 冲突类 8 个里 1 个（zh-cn）保留 HEAD pi 段
 * - T35：根治——把 pi 段迁回 fork seam，dialogs.json 还原到上游 88c10770 截止状态
 */
import type { ComponentsJSON } from '@nanostores/i18n'

import type {
  askMessageDefaults,
  chipsMessageDefaults,
  confirmMessageDefaults,
  fontsMessageDefaults,
  imageGenMessageDefaults,
  panelsMessageDefaults,
  piMessageDefaults
} from './en'

const zhCN = {
  rebuild: {
    seamProbe: 'fork i18n 缝已接通'
  },
  chips: {
    chipsMode: '模式',
    chipsProfile: '风格',
    chipsNoProfile: '无风格档案',
    chipsPendingLabel: '将新建：{mode} · {profile}',
    chipsPendingUndo: '撤销新建意图',
    chipsManifestFailed: 'AI 工作室加载失败——选择器已禁用。',
    chipsRetry: '重试'
  },
  panels: {
    contextTriggerLabel: '画布状态',
    contextTriggerDesignLabel: '当前设计区：',
    contextTriggerDesignEmpty: '待新建',
    contextTriggerBriefsLabel: '需求单：',
    contextTriggerBriefsEmpty: '无',
    targetSection: '当前目标',
    targetNoActive: '暂无当前目标设计——拨选模式 / 风格后发送消息即可新建。',
    targetNoBriefBound: '未绑定需求单',
    designsSection: '本页设计区',
    designsEmpty: '当前页还没有营销设计区。',
    designsActive: '当前',
    designsSetCurrent: '设为当前',
    designsSetting: '切换中…',
    designsLocateHint: '仅当前页面。点击条目 = 画布定位；切换只走显式按钮。',
    designsSwitchFailed: '设为当前失败。',
    briefsSection: '本页需求单',
    briefListEmpty: '当前页还没有需求单。',
    briefContainsActive: '含当前目标',
    briefNew: '新建需求单',
    briefNewPlaceholder: '需求内容（可选）…',
    briefCreate: '创建',
    briefCreateCancel: '取消',
    briefCreateFailed: '新建需求单失败。',
    briefDirtyHint: '有未保存的需求单修改。',
    briefDiscardClose: '丢弃并关闭',
    briefKeepEditing: '继续编辑',
    briefDialogTitle: '需求单',
    briefDialogDescription: '内容与素材的修改写回画布上的需求单——画布是单一事实源。',
    briefOpenFailed: '该需求单结构不完整，无法读取。',
    briefDialogMissing: '该需求单已不在画布上（可能已被删除）。',
    briefContent: '需求内容',
    briefContentPlaceholder:
      '要做什么、给谁看、必须出现的内容、素材怎么用——写得越完整，AI 越少猜。',
    briefMaterials: '素材区',
    briefMaterialCaptionPlaceholder: '备注用途（如：主视觉 / 仅参考风格）…',
    briefMaterialAdd: '上传图片',
    briefMaterialAddSelection: '从画布选区添加（{count}）',
    briefMaterialRemove: '删除素材',
    briefConclusions: 'AI 结论',
    briefDesigns: '关联设计区',
    briefEmptySection: '空',
    briefSaved: '已保存',
    briefSaveFailed: '保存失败',
    briefApplyFailed: '操作失败——请重试。'
  },
  confirm: {
    intentTitle: '以新身份开始新设计？',
    intentCaseALine: '当前方向草稿将作废——新设计区从零开始。',
    intentCaseBKeep: '旧产物原样保留在画布上——不会被改写。',
    intentCaseBNew: '将按选中的模式 / 风格启动新的设计区。',
    intentCaseBMaterials: '需求单素材区自动继承。',
    intentCaseBReferences: '把已生成的图片作为 references 携带',
    intentCaseBRadius: '废弃半径：仅作废旧方向——已产出的一切保留。',
    intentSizeSection: '画布尺寸',
    intentSizeAuto: '自动（AI 决定）',
    intentSizeCustomPlaceholder: '自定义，如 750x 或 750x2000',
    intentSizeInvalid: '尺寸格式：宽x 或 宽x高（如 750x2000）。',
    intentConfirm: '确认并发送',
    intentCancel: '取消',
    intentConfirmedBadge: '已确认',
    intentCancelledBadge: '已取消',
    consentTitle: 'AI 请求切换当前目标设计',
    consentTarget: '目标：{name}',
    consentAgree: '切换过去',
    consentDecline: '保持当前',
    consentAgreedBadge: '已切换',
    consentDeclinedBadge: '已拒绝',
    consentDeclinedLine: '已拒绝切换到 {name}——当前目标不变。',
    consentFailedLine: '切换失败——目标设计可能已被移动或删除。',
    contextSwitchLine: '—— 已切换到「{name}」——'
  },
  ask: {
    askFormTitle: 'AI 向你提问',
    askSubmit: '提交作答',
    askSkip: '跳过表单',
    askSkipPlaceholder: '其他 / 补充说明（可选）…',
    askRequiredHint: '请先作答必填题',
    askOptional: '选答',
    askTextPlaceholder: '输入你的回答…',
    askAnswered: '已作答',
    askSkipped: '已跳过',
    askImageUnavailable: '预览不可用',
    askInvalidDefinition: '表单定义无效，无法作答。'
  },
  imagegen: {
    imageGenTitle: '图像生成',
    imageGenDescription:
      'generate_image 工具的凭证由本地 pi 后端持有（与聊天 LLM 密钥分开）。选择服务商类型，然后填写 Base URL、模型名与 API 密钥。',
    imageGenProvider: '服务商类型',
    imageGenBaseUrl: 'Base URL',
    imageGenBaseUrlPlaceholder: 'https://api.openai.com/v1',
    imageGenModel: '模型',
    imageGenModelPlaceholder: 'gpt-image-1',
    imageGenKeyPlaceholderConfigured: '密钥已保存——输入新密钥以替换',
    imageGenKeyPlaceholderMissing: '粘贴 API 密钥',
    imageGenKeySave: '保存密钥',
    imageGenKeyClear: '清除密钥',
    imageGenConfigured: '已配置',
    imageGenNotConfigured: '未配置',
    imageGenOffline: '无法连接 pi 后端——请用 `bun run dev` 启动开发服务器。'
  },
  fonts: {
    settingsFonts: '字体',
    fontsPanelTitle: '字体白名单',
    fontsPanelDescription:
      '按来源开关字体家族。被关闭的字体视为未安装：从字体选择器消失，文档自动回退到下一可用字体。',
    fontsSearchPlaceholder: '搜索字体…',
    fontsLoading: '字体加载中…',
    fontsEmpty: '没有匹配的字体。',
    fontsEnabledSummary: '已启用 {enabled}/{total} 个家族',
    fontsSourceBundled: '内置',
    fontsSourceCdn: 'CDN 精选',
    fontsSourceCatalog: 'CDN 目录',
    fontsSourceLocal: '系统',
    fontsSourceOnline: '在线',
    fontsLockedHint: '内置字体始终启用——它们是渲染兜底。',
    fontsLocalAccessPrompt: '允许访问系统字体后可在此管理。',
    fontsLocalAllow: '允许访问系统字体',
    fontsVariableBadge: '可变',
    fontsFilterAll: '全部',
    fontsFilterEnabled: '已启用',
    fontsFilterDisabled: '已停用',
    fontsEnableAll: '全部启用',
    fontsDisableAll: '全部停用',
    fontsShowMore: '显示更多（还有 {count} 个）',
    fontsOnlineMaster: '在线字体库',
    fontsCnMaster: '中文网字计划 CDN',
    fontsCnMasterHint: '独立开关——不受在线字体库总开关影响。',
    fontsSourceOffHint: '该来源已停用，其家族从列表与字体选择器中隐藏。',
    fontsUnauditedLicense: '授权：{license}（以包内声明为准，未审计）',
    fontsCatalogHint:
      '中文网字计划全量目录。默认关闭——启用的家族出现在字体选择器中，按字符集按需加载子集分片。'
  },
  pi: {
    modelsDescription: 'Provider、凭据和设计模型由本地 pi 后端管理。',
    catalogRefresh: '刷新',
    catalogOffline: '无法连接 pi 后端——请用 `bun run dev` 启动开发服务器。',
    providerModels: '{count} 个模型',
    keyPlaceholderConfigured: '密钥已保存——输入新密钥以替换',
    keyPlaceholderMissing: '粘贴 API 密钥',
    keySave: '保存密钥',
    keyClear: '清除密钥',
    addProvider: '添加自定义 Provider',
    providerId: 'Provider ID',
    providerBaseUrl: 'Base URL',
    providerApi: 'API 类型',
    providerModelIds: '模型 ID（每行一个）',
    providerSave: '保存 Provider',
    designModel: '设计模型',
    designModelDescription: 'AI 聊天代理使用的模型。凭据来自上方对应的 Provider 条目。',
    designProvider: 'Provider',
    designModelField: '模型',
    designModelSave: '保存',
    designModelDefault: '后端默认（openrouter/free）',
    thinkingLevel: '思考级别',
    thinkingOff: '关闭',
    thinkingMinimal: '最低',
    thinkingLow: '低',
    thinkingMedium: '中',
    thinkingHigh: '高',
    thinkingExtraHigh: '极高'
  }
} satisfies ComponentsJSON

export default zhCN

// T35：PiNamespace 类型基于 en defaults（含 params），与 zh-cn.ts 的 string 字面量解耦——
// 参数化 key（如 providerModels）在 useForkPi() 消费端保留 callable 形态。
export type PiNamespace = typeof piMessageDefaults
export type FontsNamespace = typeof fontsMessageDefaults
export type ImageGenNamespace = typeof imageGenMessageDefaults
export type AskNamespace = typeof askMessageDefaults
export type ChipsNamespace = typeof chipsMessageDefaults
export type PanelsNamespace = typeof panelsMessageDefaults
export type ConfirmNamespace = typeof confirmMessageDefaults
