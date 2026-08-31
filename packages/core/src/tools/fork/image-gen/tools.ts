/**
 * T54（Phase 3 W2/T-B3）：generate_image 落图段 core ToolDef（桥可调）。
 *
 * 双段执行（S3 §4 / 01 B.3 裁决 2）：AI 可见的 generate_image 在 pi-backend
 * 进程执行（provider HTTP 直发、凭证不出后端）；这两个 core 工具是落图段的
 * 桥端点——图像字节经桥进出（base64），凭证永不进桥 payload。
 *
 * 不对 AI 直接暴露语义：描述里注明「internal，由后端 generate_image 管线
 * 编排调用」。可见性最终由注册面决定——IMAGE_GEN_TOOLS 是否进 ALL_TOOLS
 * 是主 agent 集成期决策（本任务只导出，不改 fork/index.ts）。
 */

import { decodeBase64, encodeBase64 } from '#core/bytes'
import { defineTool } from '#core/tools/schema'

import { beginImageGen, commitImageGen } from './apply'
import { parseReferences } from './requests'

export const imageGenBegin = defineTool({
  name: 'image_gen_begin',
  mutates: true,
  description:
    'INTERNAL pipeline segment — called by the pi-backend generate_image orchestrator, not meant for direct AI use. Resolves the output target (creating and auto-placing a new frame when no valid replace target is given), extracts reference images (base64), and reports the final API size. Pair with image_gen_commit after the backend has generated the image bytes.',
  params: {
    prompt: { type: 'string', description: 'Generation prompt', required: true },
    width: { type: 'number', description: 'Requested width (normalized)' },
    height: { type: 'number', description: 'Requested height (normalized)' },
    replace_id: { type: 'string', description: 'Existing node whose fill gets replaced' },
    references: {
      type: 'string',
      description: 'JSON array of node ids or {"id":"...","composite":true} entries'
    }
  },
  execute: async (figma, { prompt, width, height, replace_id, references }) => {
    let rawRefs: unknown
    if (references !== undefined) {
      try {
        rawRefs = JSON.parse(references)
      } catch {
        return { error: 'Invalid JSON in references' }
      }
    }
    const refs = parseReferences(rawRefs)
    if ('error' in refs) return { error: refs.error }
    try {
      const result = await beginImageGen(figma, {
        prompt,
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(replace_id ? { replaceId: replace_id } : {}),
        ...(refs.length > 0 ? { references: refs } : {})
      })
      return {
        id: result.targetId,
        width: result.width,
        height: result.height,
        canvasWidth: result.canvasWidth,
        canvasHeight: result.canvasHeight,
        replaced: result.replaced,
        images: result.images.map((bytes) => encodeBase64(bytes)),
        ...(result.note ? { note: result.note } : {})
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
})

export const imageGenCommit = defineTool({
  name: 'image_gen_commit',
  mutates: true,
  description:
    'INTERNAL pipeline segment — called by the pi-backend generate_image orchestrator, not meant for direct AI use. Writes generated image bytes (base64) into the target node resolved by image_gen_begin, snapshotting the previous image into the page generation-history container first (only IMAGE fills; same-hash dedupe).',
  params: {
    id: { type: 'string', description: 'Target node id from image_gen_begin', required: true },
    image_data: {
      type: 'string',
      description: 'Base64-encoded generated image bytes',
      required: true
    }
  },
  execute: (figma, { id, image_data }) => {
    return commitImageGen(figma, id, decodeBase64(image_data))
  }
})
