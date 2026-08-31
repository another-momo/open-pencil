/**
 * 媒体输出工具登记（T55 / S3 §5 通道 A，00 #17 字段化落点）。
 *
 * 旧栈 MEDIA_OUTPUT_TOOLS 常量挂在 core ai-adapter（ToolDef 元数据字段不落
 * schema.ts 上游文件）；rebuild 把登记面放在 pi-backend 侧：本文件成文登记
 * 集合 + 结果判定/转换 helper，mapping.ts 在 tool_execution_end 映射时对
 * 登记工具的桥结果把 base64 图像转 UI 媒体块（AI SDK `file` chunk，data URL
 * 承载），tool-output-available 的 details 剥掉 base64 载荷以免撑爆消息流。
 *
 * 注意：本文件被 mapping.ts 导入，随 Node 端 service.ts 经 vite esbuild 打包，
 * 只允许相对导入与真实包导入（不解析 tsconfig paths）。
 */

import type { UIMessageChunk } from 'ai'

/** 返回结构含 base64 图像的工具名集合（look 为 T55 首个登记者；export_image 为旧栈沿用）。 */
export const MEDIA_OUTPUT_TOOLS: ReadonlySet<string> = new Set(['look', 'export_image'])

/** 登记媒体工具的桥结果形状（look 通道 A 返回结构的媒体子集）。 */
export interface MediaToolOutput {
  base64: string
  mimeType: string
  note?: string
  [key: string]: unknown
}

export function isMediaToolOutput(output: unknown): output is MediaToolOutput {
  return (
    !!output &&
    typeof output === 'object' &&
    'base64' in output &&
    'mimeType' in output &&
    typeof (output as MediaToolOutput).base64 === 'string' &&
    typeof (output as MediaToolOutput).mimeType === 'string'
  )
}

/**
 * details 载荷脱敏：base64 替换为尺寸标记（图像本体走 file chunk），其余
 * 元数据（note/node/exportInfo/...）原样保留给工具卡片与调试面。
 */
export function sanitizeMediaToolOutput(output: MediaToolOutput): Record<string, unknown> {
  const { base64, ...rest } = output
  return { ...rest, base64: `[inlined as file part, ${base64.length} chars]` }
}

/**
 * 登记工具的桥结果 → UIMessageChunk 序列：先 file 媒体块（data URL），后
 * tool-output-available（脱敏 details）。非媒体输出（错误、缺字段）返回
 * null，调用方回退默认文本输出路径。
 */
export function mediaToolOutputChunks(
  toolCallId: string,
  output: unknown
): UIMessageChunk[] | null {
  if (!isMediaToolOutput(output)) return null
  return [
    {
      type: 'file',
      url: `data:${output.mimeType};base64,${output.base64}`,
      mediaType: output.mimeType
    },
    {
      type: 'tool-output-available',
      toolCallId,
      output: sanitizeMediaToolOutput(output),
      providerExecuted: true
    }
  ]
}
