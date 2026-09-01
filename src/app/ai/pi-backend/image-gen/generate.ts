/**
 * T54（Phase 3 W2/T-B3）：AI 可见 generate_image 的后端编排（双段执行）。
 *
 * 拓扑（S3 §4 / 01 B.3 裁决 2）：
 *   AI 工具调用 → 本模块 execute（pi-backend 进程）
 *     1. 凭证读取（credentials store，缺 key → 结构化错误引导设置页配置）
 *     2. parseImageGenRequests（core 纯函数层，尺寸/枚举语义校验）
 *     3. begin 段串行经桥（image_gen_begin：误传保护/参考图提取/目标解析；
 *        串行 = 00 #10 并发放置竞态修复——每次 begin 重读页面 bounds，
 *        后一帧看到前一帧）
 *     4. provider HTTP 并行直发（不经桥；key 不出本进程）
 *     5. commit 段串行经桥（image_gen_commit：覆盖前快照 + 写 IMAGE fill）
 *
 * T66（P4/P5）：工具参数从单 JSON 字符串拆为 schema 化数组（9 字段，
 * additionalProperties: false——字段拼错/类型/嵌套/枚举四类错误由 pi
 * 运行时 schema 校验在 execute 前拒绝并回执模型自纠，pi-ai
 * validateToolArguments 实证）；description 瘦身至 2000 字符内。
 * parseImageGenRequests 保留字符串宽容解析为兼容降级（见 core requests.ts）。
 *
 * 装配形态：createImageGenTool(deps) 工厂返回 pi AgentTool——由主 agent
 * 集成期在 service.ts 装配进 customTools（本任务不改 service.ts/tools.ts）。
 *
 * pi-ai generateImages 扩展槽（路线乙登记）：deps.createProvider 即槽位——
 * 未来以 pi-ai generateImages 实现 ImageGenProvider（契约钉扎见
 * spikes/probes/sp/a1-images-contract.mjs）后经同一 deps 注入；本任务不实现。
 *
 * key 卫生：桥 payload 只含 prompt/尺寸/节点 id/图像 base64；provider 结果
 * 只回画布元数据（无图像字节回 AI，无 key）。
 */

import { defineTool, type AgentToolResult } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

import { decodeBase64, encodeBase64 } from '@open-pencil/core/bytes'
import {
  parseImageGenRequests,
  type ImageGenProvider,
  type ImageGenRequest,
  type ImageGenResult
} from '@open-pencil/core/tools/fork/image-gen/requests'

import { createBridgeCaller, type BridgeCaller } from './bridge-call'
import type { ImageGenCredentials, ImageGenCredentialStore } from './credentials'
import { createImageGenProvider } from './provider'

/** 与 fork/image-gen/tools.ts 的桥端点对齐 */
const BEGIN_TOOL = 'image_gen_begin'
const COMMIT_TOOL = 'image_gen_commit'

/**
 * AI 面向契约文案（双段执行对模型透明）。T66 P5：瘦身至 2000 字符内
 * （测试断言钉扎上限）——参数细节由 schema 自带 description 承担，
 * 本文只保留行为语义（replace/references/批量/验收/缺 key 引导）。
 * 备份机制为内部设施——不向模型暴露页名/容器等落点细节，仅声明
 * 「旧版本自动保留、可作 reference 复用」的功能语义（owner 2026-09-01 裁定）。
 */
export const GENERATE_IMAGE_DESCRIPTION = `Generate or edit images via the configured OpenAI-compatible image API and place them on the canvas as image nodes. Batch: pass multiple items in \`requests\`.

REPLACE vs CREATE: set \`replace_id\` to fill an existing node, replacing its current fill (on Frames the image becomes the frame background with children kept — the standard text-over-image hero and image-swap pattern). Omit it to create a new node (auto-placed right of page content, never overlapping). Replacing never loses an image: the previous version is auto-preserved and stays reusable as a reference.

REFERENCES are the ONLY input-image source: a node contributes its original IMAGE bytes by default (lossless); nodes WITHOUT an IMAGE fill (layout Frames, groups) are rendered automatically. Use {"id":"...","composite":true} for the rendered appearance (children, effects, rounded corners). No references = text-to-image; with references = image-to-image. To EDIT an image, set \`replace_id\` to it AND include its id in \`references\`; to REGENERATE unbiased (retrying a rejected result), set \`replace_id\` but omit the target from \`references\`. Name multiple references [image 1], [image 2], ... in the prompt in order. A reference must not point at another batch item's output — split dependent edits into separate calls.

Generation is SLOW: batch ALL needed images in ONE call — never loop single calls. Any width/height is accepted — 16px-aligned and clipped to API constraints preserving aspect ratio; adjustments are reported in note.

Returns node id metadata only (no image bytes): inspect with \`describe\`, visually accept with \`look\` (right subject, no garbled or wrong-language text); on miss, regenerate with an adjusted prompt (max 2 attempts). Never ask for rendered text in prompts. If the key is missing or the API returns 401, tell the user to add/check the Image Generation API key in AI chat settings (separate from the chat LLM key) — do NOT fall back to eval-drawn gradients.`

export interface ImageGenToolDeps {
  credentials: ImageGenCredentialStore
  /** 桥调用（缺省 createBridgeCaller()）；测试注入 mock */
  callBridge?: BridgeCaller
  /** provider 工厂（缺省 OpenAI 兼容 provider）；pi-ai generateImages 扩展槽/测试 mock */
  createProvider?: (credentials: ImageGenCredentials) => ImageGenProvider
  /** 当次请求的桥目标文档（service 集成期注入，同 tools.ts ToolTargetSource 语义） */
  target?: { documentId?: string }
}

interface BeginPayload {
  id: string
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  replaced: boolean
  images?: string[]
  note?: string
}

interface CommitPayload {
  id?: string
  canvasWidth?: number
  canvasHeight?: number
  snapshot?: { id: string; name: string; version: number }
  error?: string
}

interface ItemResult {
  id: string
  width?: number
  height?: number
  canvasWidth?: number
  canvasHeight?: number
  provider?: string
  snapshot?: { id: string; name: string; version: number }
  note?: string
  error?: string
}

type PipelineItem = {
  req: ImageGenRequest
  begin?: BeginPayload
  images?: Uint8Array[]
  gen?: ImageGenResult
  error?: string
}

function toToolResult(result: Record<string, unknown>): AgentToolResult<Record<string, unknown>> {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    details: result
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** begin 段（串行：每次 begin 重读页面 bounds，00 #10 竞态修复） */
async function runBeginPhase(
  requests: ImageGenRequest[],
  callBridge: BridgeCaller,
  target: { documentId?: string } | undefined
): Promise<PipelineItem[]> {
  const items: PipelineItem[] = []
  for (const req of requests) {
    try {
      const begin = (await callBridge(
        BEGIN_TOOL,
        {
          prompt: req.prompt,
          ...(req.width !== undefined ? { width: req.width } : {}),
          ...(req.height !== undefined ? { height: req.height } : {}),
          ...(req.replaceId ? { replace_id: req.replaceId } : {}),
          ...(req.references ? { references: JSON.stringify(req.references) } : {})
        },
        target
      )) as Partial<BeginPayload> & { error?: string }
      if (begin.error || !begin.id) {
        items.push({ req, error: begin.error ?? 'image_gen_begin returned no target id' })
        continue
      }
      items.push({
        req,
        begin: begin as BeginPayload,
        images: (begin.images ?? []).map((b64) => decodeBase64(b64))
      })
    } catch (error) {
      items.push({ req, error: toErrorMessage(error) })
    }
  }
  return items
}

/** 生成段（并行：provider HTTP 直发，不经桥） */
async function runGeneratePhase(items: PipelineItem[], provider: ImageGenProvider): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      if (!item.begin) return
      const finalReq: ImageGenRequest = {
        ...item.req,
        width: item.begin.width,
        height: item.begin.height
      }
      try {
        item.gen = await provider.generate(
          finalReq,
          item.images && item.images.length > 0 ? item.images : undefined
        )
      } catch (error) {
        item.error = toErrorMessage(error)
      }
    })
  )
}

/** commit 段（串行经桥：覆盖快照 + 写 fill）→ 逐条结果 */
async function runCommitPhase(
  items: PipelineItem[],
  provider: ImageGenProvider,
  callBridge: BridgeCaller,
  target: { documentId?: string } | undefined
): Promise<ItemResult[]> {
  const results: ItemResult[] = []
  for (const item of items) {
    if (!item.begin) {
      results.push({ id: item.req.replaceId ?? '', error: item.error ?? 'begin failed' })
      continue
    }
    if (item.error || !item.gen) {
      results.push({ id: item.begin.id, error: item.error ?? 'image generation failed' })
      continue
    }
    try {
      const commit = (await callBridge(
        COMMIT_TOOL,
        { id: item.begin.id, image_data: encodeBase64(item.gen.bytes) },
        target
      )) as CommitPayload
      if (commit.error || !commit.id) {
        results.push({
          id: item.begin.id,
          error: commit.error ?? 'image_gen_commit returned no id'
        })
        continue
      }
      results.push({
        id: commit.id,
        width: item.gen.width,
        height: item.gen.height,
        canvasWidth: commit.canvasWidth,
        canvasHeight: commit.canvasHeight,
        provider: provider.name,
        ...(commit.snapshot ? { snapshot: commit.snapshot } : {}),
        ...(item.begin.note ? { note: item.begin.note } : {})
      })
    } catch (error) {
      results.push({ id: item.begin.id, error: toErrorMessage(error) })
    }
  }
  return results
}

/**
 * T66 P4：requests 拆为 schema 化数组（九字段，与 core requests.ts 解析层
 * RawRequest 对齐）。additionalProperties: false 让字段拼错（target_id 等）
 * 在 pi 运行时 schema 校验期即拒绝；width/height 的「新图必填」是条件约束，
 * schema 表达不了，留在 parseImageGenRequests 语义层（错误文案引导补全）。
 */
export const GENERATE_IMAGE_PARAMETERS = Type.Object({
  requests: Type.Array(
    Type.Object(
      {
        prompt: Type.String({
          description: 'Text prompt — never ask for rendered text inside the image'
        }),
        width: Type.Optional(
          Type.Number({ description: 'Image width in pixels (required for new images)' })
        ),
        height: Type.Optional(
          Type.Number({ description: 'Image height in pixels (required for new images)' })
        ),
        quality: Type.Optional(
          Type.Union(
            [
              Type.Literal('auto'),
              Type.Literal('low'),
              Type.Literal('medium'),
              Type.Literal('high')
            ],
            { description: 'Image quality (default: auto for speed)' }
          )
        ),
        output_format: Type.Optional(
          Type.Union([Type.Literal('png'), Type.Literal('jpeg'), Type.Literal('webp')], {
            description: 'Output format (default: png)'
          })
        ),
        output_compression: Type.Optional(
          Type.Number({ description: 'JPEG/WebP compression 0-100 (only with jpeg/webp)' })
        ),
        background: Type.Optional(
          Type.Union([Type.Literal('auto'), Type.Literal('opaque')], {
            description: 'Background mode (default: auto)'
          })
        ),
        replace_id: Type.Optional(
          Type.String({ description: 'Existing node ID to fill (omit = create new node)' })
        ),
        references: Type.Optional(
          Type.Array(
            Type.Object(
              {
                id: Type.String({ description: 'Canvas node ID' }),
                composite: Type.Optional(
                  Type.Boolean({
                    description:
                      'true = rendered appearance (children/effects); default = original image bytes'
                  })
                )
              },
              { additionalProperties: false }
            ),
            { description: 'Input node IDs for image-to-image editing' }
          )
        )
      },
      { additionalProperties: false }
    ),
    { description: 'Generation/edit items — batch ALL needed images in one call' }
  )
})

export function createImageGenTool(deps: ImageGenToolDeps) {
  return defineTool({
    name: 'generate_image',
    label: 'Generate Image',
    description: GENERATE_IMAGE_DESCRIPTION,
    parameters: GENERATE_IMAGE_PARAMETERS,
    async execute(_toolCallId, params): Promise<AgentToolResult<Record<string, unknown>>> {
      const credentials = deps.credentials.get()
      if (!credentials) {
        return toToolResult({
          error:
            'No image-gen provider configured. Add an image-gen API key in settings (separate from the chat LLM key).'
        })
      }
      const providerFactory =
        deps.createProvider ??
        ((creds: ImageGenCredentials) => createImageGenProvider({ credentials: creds }))
      const provider = providerFactory(credentials)
      const callBridge = deps.callBridge ?? createBridgeCaller()

      const parsed = parseImageGenRequests(params.requests)
      if ('error' in parsed) return toToolResult({ error: parsed.error })

      const items = await runBeginPhase(parsed.requests, callBridge, deps.target)
      await runGeneratePhase(items, provider)
      const results = await runCommitPhase(items, provider, callBridge, deps.target)

      const ok = results.filter((result) => result.id && !result.error).length
      return toToolResult({
        generated: ok,
        failed: results.length - ok,
        provider: provider.name,
        ...(parsed.sizeNote ? { note: parsed.sizeNote } : {}),
        ...(parsed.warning ? { warning: parsed.warning } : {}),
        results
      })
    }
  })
}
