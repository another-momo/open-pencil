/**
 * pi 后端自定义工具通用小帮手——把 Record 包成 AgentToolResult（content = 字符串化
 * JSON，details = 原对象；mapping.ts tool-output-available 骑 details 到前端，
 * content 走模型视野）。T56/T85 引入 ask-user-question/read-reference 时同形
 * 复制，jscpd 克隆门禁零容忍，归一此缝。
 *
 * 不引入更复杂的封装——保持「Record→AgentToolResult」的最小语义；
 * 不参数化 content 形式（成功的 read_reference 用 file 原文直接 content，
 * 不用此 helper）。
 */

import type { AgentToolResult } from '@earendil-works/pi-coding-agent'

export function toToolResult(
  result: Record<string, unknown>
): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    details: result
  }
}
