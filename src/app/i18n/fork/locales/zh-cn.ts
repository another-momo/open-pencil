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

import type { fontsMessageDefaults, piMessageDefaults } from './en'

const zhCN = {
  rebuild: {
    seamProbe: 'fork i18n 缝已接通'
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
    fontsSourceCdn: 'CDN',
    fontsSourceLocal: '系统',
    fontsSourceOnline: '在线',
    fontsLockedHint: '内置字体始终启用——它们是渲染兜底。',
    fontsLocalAccessPrompt: '允许访问系统字体后可在此管理。',
    fontsLocalAllow: '允许访问系统字体',
    fontsVariableBadge: '可变'
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
