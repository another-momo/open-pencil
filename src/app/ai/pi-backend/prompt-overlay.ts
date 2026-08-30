/**
 * T24 marketing overlay 构建器（纯函数单源，T24-plan D5）；
 * T45（S4 W1 / T-A3）改源：输入来自 studio 注册表（brand/config.yaml 链退役），
 * 输出形状与注入时机不变。
 * 复刻上游 fork packages/agent/src/prompts/brand-overlay.ts 的输出形状——
 * 上游前后端 byte-mirror 人工对齐是已知脆弱点，本仓后端单源，前端不复制。
 *
 * 输出形状（`\n\n` 前缀 Markdown 段，次序固定）：
 *  1. `## Material types in the current brand` 列表段恒在（空则 fallback
 *     引导 custom——setup_material_type 属 C3a，文案先行对齐上游）
 *  2. `## Active style profile: {id}` + profile 正文仅当显式 picked；
 *     picked 未命中输出 re-pick 提示段（指路聊天输入条的 profile 下拉）
 *
 * 仅运行于后端进程（profile 正文不下发前端，studio/manifest.ts 信任边界）。
 */

import type { StudioRegistry, StudioWorkflowType } from './studio/types'

export type StudioStyleProfileEntry = {
  id: string
  markdown: string
}

/**
 * studio 注册表 → overlay 输入适配（纯函数，T45 D-c）：
 * types = 各注册 workflow 的 types 展平（'none' 与 general 无贡献）；
 * profiles = { id, markdown: body }（正文只进 prompt，不出本模块服务端边界）。
 * profiles 不过滤 deprecated（与 manifest 投影不同）：已被选中的 profile 遭废弃后
 * 仍注入 prompt（前端下拉已隐藏，会话内选择保持有效）——语义决策挂 S2 §5 / T-B10 成文。
 */
export function studioOverlayInput(registry: StudioRegistry): {
  types: StudioWorkflowType[]
  profiles: StudioStyleProfileEntry[]
} {
  const types: StudioWorkflowType[] = []
  for (const workflow of registry.workflows.values()) {
    if (workflow.types !== 'none') types.push(...workflow.types)
  }
  const profiles = [...registry.profiles.values()].map((p) => ({ id: p.id, markdown: p.body }))
  return { types, profiles }
}

export function buildMarketingOverlay({
  types,
  profiles,
  pickedProfileId
}: {
  types: StudioWorkflowType[]
  profiles: StudioStyleProfileEntry[]
  pickedProfileId: string | null
}): string {
  const parts: string[] = []

  if (types.length > 0) {
    const lines = types.map((type) => `- ${type.id} (${type.label}) — ${type.size}`)
    parts.push(`## Material types in the current brand\n${lines.join('\n')}`)
  } else {
    parts.push(
      `## Material types in the current brand\n` +
        `_No material types available. The studio registry may have failed to load, ` +
        `or no registered workflow declares types. Use \`setup_material_type\` with ` +
        `\`materialType: "custom"\` and width+height._`
    )
  }

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

  return `\n\n${parts.join('\n\n')}`
}
