/**
 * T24 marketing overlay 构建器（纯函数单源，T24-plan D5）：
 * 复刻上游 fork packages/agent/src/prompts/brand-overlay.ts 的输出形状——
 * 上游前后端 byte-mirror 人工对齐是已知脆弱点，本仓后端单源，前端不复制。
 *
 * 输出形状（`\n\n` 前缀 Markdown 段，次序固定）：
 *  1. `## Material types in the current brand` 列表段恒在（空则 fallback
 *     引导 custom——setup_material_type 属 C3a，文案先行对齐上游）
 *  2. `## Active style profile: {id}` + profile.markdown 仅当显式 picked；
 *     picked 未命中输出 re-pick 提示段（上游文案提 MarketingConfigBar，本仓
 *     尚无该组件——指路改为聊天输入条的 profile 下拉，C5a 落地时再对齐）
 *
 * 仅运行于后端进程（profile.markdown 不下发前端，brand-manifest.ts）。
 */

import type { PiBrandMaterialType } from './brand/manifest'

export type BrandStyleProfileEntry = {
  id: string
  markdown: string
}

export function buildMarketingOverlay({
  types,
  profiles,
  pickedProfileId
}: {
  types: PiBrandMaterialType[]
  profiles: BrandStyleProfileEntry[]
  pickedProfileId: string | null
}): string {
  const parts: string[] = []

  if (types.length > 0) {
    const lines = types.map(
      (type) => `- ${type.id} (${type.label})${type.description ? `: ${type.description}` : ''}`
    )
    parts.push(`## Material types in the current brand\n${lines.join('\n')}`)
  } else {
    parts.push(
      `## Material types in the current brand\n` +
        `_No material types available. The brand config may have failed to load, ` +
        `or the bound brand config has no Types. Use \`setup_material_type\` with ` +
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
      `## Active style profile: (not in brand config)\n` +
        `_Profile "${pickedProfileId}" is not present in the loaded brand config. ` +
        `Ask the user to re-pick a profile that exists, or clear the selection ` +
        `in the chat profile dropdown._`
    )
  }

  return `\n\n${parts.join('\n\n')}`
}
