/**
 * T92：工具卡片展开输出文本（ChatMessage.vue 折叠卡 <pre> 内容单源）。
 *
 * 对齐老分支 displayOutput 语义：media 输出（base64 + mimeType 字段，look /
 * export_image 通道 A 结果）序列化展示时把 base64 替换为 `[omitted N chars]`
 * 占位——工具卡片给人类看，完整 base64 只是噪音（图像本体已由 file chunk
 * 直渲）。模型通道裁剪见 pi-backend/media-output.ts（sanitize 双函数）。
 *
 * 从 ChatMessage.vue 抽出以便单测（tool-state.ts 同模式先例）。
 */

import { isMediaToolOutput } from '@/app/ai/pi-backend/media-output'

export type ToolOutputDisplayInput = {
  state: string
  errorText?: string
  output?: unknown
}

function hasErrorOutput(output: unknown): output is { error: string } {
  return typeof output === 'object' && output !== null && 'error' in output
}

export function displayToolOutput(part: ToolOutputDisplayInput): string {
  if (part.state === 'output-error' && part.errorText) return part.errorText
  if (part.state === 'output-available' && hasErrorOutput(part.output)) return part.output.error
  const output = part.output
  if (isMediaToolOutput(output)) {
    const { base64, ...rest } = output
    return JSON.stringify({ ...rest, base64: `[omitted ${base64.length} chars]` }, null, 2)
  }
  return JSON.stringify(output, null, 2)
}
