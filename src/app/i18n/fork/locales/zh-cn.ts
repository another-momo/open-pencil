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

import type { piMessageDefaults } from './en'

const zhCN = {
  rebuild: {
    seamProbe: 'fork i18n 缝已接通'
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
