/**
 * T24 marketing overlay 构建器（纯函数单源，T24-plan D5）；
 * T45（S4 W1 / T-A3）改源：输入来自 studio 注册表（brand/config.yaml 链退役），
 * 注入时机不变。本仓后端单源，前端不复制。
 * T62：material types 段整段 + T24 遗留（setup_material_type fallback 文案）
 * 一并删除——type 机制退役后 overlay 仅余 profile 段。
 *
 * 输出形状（`\n\n` 前缀 Markdown 段；无内容时返回空串）：
 *  `## Active style profile: {id}` + profile 正文仅当显式 picked；
 *  picked 未命中输出 re-pick 提示段（指路聊天输入条的 profile 下拉）
 *
 * 仅运行于后端进程（profile 正文不下发前端，studio/manifest.ts 信任边界）。
 */

import type { StudioRegistry } from './studio/types'

export type StudioStyleProfileEntry = {
  id: string
  markdown: string
}

/**
 * studio 注册表 → overlay 输入适配（纯函数，T45 D-c）：
 * profiles = { id, markdown: body }（正文只进 prompt，不出本模块服务端边界）。
 * profiles 不过滤 deprecated（与 manifest 投影不同）：已被选中的 profile 遭废弃后
 * 仍注入 prompt（前端下拉已隐藏，会话内选择保持有效）——语义决策挂 S2 §5 / T-B10 成文。
 */
export function studioOverlayInput(registry: StudioRegistry): {
  profiles: StudioStyleProfileEntry[]
} {
  const profiles = [...registry.profiles.values()].map((p) => ({ id: p.id, markdown: p.body }))
  return { profiles }
}

export function buildMarketingOverlay({
  profiles,
  pickedProfileId
}: {
  profiles: StudioStyleProfileEntry[]
  pickedProfileId: string | null
}): string {
  const parts: string[] = []

  const profile = pickedProfileId
    ? profiles.find((entry) => entry.id === pickedProfileId)
    : undefined

  if (pickedProfileId && profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  } else if (pickedProfileId) {
    parts.push(
      `## Active style profile: (not in studio registry)\n` +
        `_Profile "${pickedProfileId}" is not present in the loaded studio registry. ` +
        `Ask the user to re-pick a profile that exists, or clear the selection ` +
        `in the chat profile dropdown._`
    )
  }

  return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
}
