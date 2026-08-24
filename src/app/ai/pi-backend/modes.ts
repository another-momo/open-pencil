/**
 * T24 AgentMode 注册表（T24-plan D1/D2 四层抽象的代码化身）：
 *
 *   AgentMode（本表，建会话期烘焙：base prompt + 工具集位）
 *     → 工作流段（per-run 注入，before_agent_start）
 *     → style profile overlay（per-run 注入，同钩子）
 *
 * 每个模式声明：
 *  - basePromptPath：建会话时经 DefaultResourceLoader.systemPrompt 烘焙的基底
 *  - workflowSegmentPath：可选；存在则每 run 注入到 base 之后、overlay 之前
 *  - acceptsProfile：是否接受 style profile overlay（false 时钩子不注入任何内容）
 *
 * 工具集位：初版两模式同享现有 open-pencil 工具集（tools.ts 26 件）；
 * 营销工具（setup_material_type/generate_image 等，C3a）落地时在此分流。
 *
 * 仅运行于独立后端进程；只允许相对导入与 node/依赖包导入（同 service.ts 纪律）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { PiChatMode } from './chat-mode'

export type PiModeDefinition = {
  id: PiChatMode
  /** 相对 rootDir 的 base prompt 路径（建会话期烘焙） */
  basePromptPath: string
  /** 相对 rootDir 的工作流段路径（per-run 注入；空 = 该模式无工作流段） */
  workflowSegmentPath?: string
  /** 是否接受 style profile overlay（per-run） */
  acceptsProfile: boolean
}

export const PI_CHAT_MODES: Record<PiChatMode, PiModeDefinition> = {
  ui: {
    id: 'ui',
    // 现 system-prompt.md 原样（T24-plan D2：不拆不改，byte 级零漂移）
    basePromptPath: 'src/app/ai/chat/system-prompt.md',
    acceptsProfile: false
  },
  marketing: {
    id: 'marketing',
    basePromptPath: 'src/app/ai/pi-backend/prompts/system-prompt-base.md',
    workflowSegmentPath: 'src/app/ai/pi-backend/prompts/system-prompt-marketing.md',
    acceptsProfile: true
  }
}

export function isPiChatMode(value: unknown): value is PiChatMode {
  return value === 'ui' || value === 'marketing'
}

/** 模式段文本缓存：每路径读盘一次（后端进程生命周期内不变） */
const segmentCache = new Map<string, string>()

export function loadModeSegment(rootDir: string, relativePath: string): string {
  const cached = segmentCache.get(relativePath)
  if (cached !== undefined) return cached
  const text = readFileSync(join(rootDir, relativePath), 'utf8')
  segmentCache.set(relativePath, text)
  return text
}
