/**
 * T54（Phase 3 W2/T-B3）：AI 可见 generate_image 的后端编排（双段执行）。
 *
 * 拓扑（S3 §4 / 01 B.3 裁决 2）：
 *   AI 工具调用 → 本模块 execute（pi-backend 进程）
 *     1. 凭证读取（credentials store，缺 key → 结构化错误引导设置页配置）
 *     2. parseImageGenRequests（core 纯函数层，尺寸/枚举校验）
 *     3. begin 段串行经桥（image_gen_begin：误传保护/参考图提取/目标解析；
 *        串行 = 00 #10 并发放置竞态修复——每次 begin 重读页面 bounds，
 *        后一帧看到前一帧）
 *     4. provider HTTP 并行直发（不经桥；key 不出本进程）
 *     5. commit 段串行经桥（image_gen_commit：覆盖前快照 + 写 IMAGE fill）
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
import { createDmxImageGenProvider } from './provider-dmx'

/** 与 fork/image-gen/tools.ts 的桥端点对齐 */
const BEGIN_TOOL = 'image_gen_begin'
const COMMIT_TOOL = 'image_gen_commit'

/** 源 image-gen.ts 的 AI 面向契约文案（双段执行对模型透明，语义不变） */
const GENERATE_IMAGE_DESCRIPTION =
  'Generate or edit images via an OpenAI-compatible image API (gpt-image-2) and place them on the canvas as editable image nodes. Pass a JSON array for batch. Each item: {prompt, width, height, quality?, output_format?, output_compression?, replace_id?, references?, background?}. quality: low|medium|high|auto — default to auto for speed; use high only when image quality is critical ("hd" is auto-corrected to "auto"); output_format: png|jpeg|webp; background: auto|opaque. `replace_id` is ONLY the output target — never an input: provide it to fill that node with the generated image, replacing its current fill (works on leaf shapes AND on Frames, where the image becomes the frame background while children are kept — the standard way to build a text-over-image hero, and the standard way to regenerate/swap an existing canvas image); omit it to create a new image node (auto-placed right of existing page content, never overlapping). Replacing an image never loses it: when the target holds an image, the previous version is auto-preserved in the page\'s generation-history container ("历史图片备份", parked right of the root frame), and history entries are reusable as references. When generating a NEW image from references, omit `replace_id` — a reference\'s node id belongs in `references`, never in `replace_id`. `references` is the ONLY source of input images: an array of node ids. Each node contributes its original IMAGE bytes by default (lossless, zero-cost); nodes WITHOUT an IMAGE fill (layout Frames, groups) are rendered automatically. Pass {"id":"...","composite":true} to reference the node\'s rendered appearance instead — children, effects and rounded corners included (e.g. a hero Frame with overlay text). No references → text-to-image; with references → image-to-image. To EDIT an existing image, set `replace_id` to it AND include its node id in `references`; to REGENERATE a fresh replacement without being biased by the current one (e.g. retrying a rejected result), set `replace_id` but leave the target out of `references`. When passing multiple references, refer to them in the prompt as [image 1], [image 2], ... matching the references order. Any width/height is accepted — values are 16px-aligned and clipped to API constraints while preserving aspect ratio; adjustments are reported in note. Within one batch, references must not point at another item\'s output node — split dependent edits into separate calls. Generation is SLOW: batch ALL needed images in ONE call — never loop with repeated single calls. Returns node id metadata only (no image bytes): inspect structure with `describe`, and visually accept the content with `look` (right subject, no garbled or wrong-language text inside the image); if it misses, regenerate with an adjusted prompt (max 2 attempts). Prompts must never ask for rendered text. If the key is missing or the API returns 401, tell the user to add/check the Image Generation API key in AI chat settings (separate from the chat LLM key) — do NOT fall back to eval-drawn gradients; leave placeholder colors as-is.'

export interface ImageGenToolDeps {
  credentials: ImageGenCredentialStore
  /** 桥调用（缺省 createBridgeCaller()）；测试注入 mock */
  callBridge?: BridgeCaller
  /** provider 工厂（缺省 DMX 核心）；pi-ai generateImages 扩展槽/测试 mock */
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

export function createImageGenTool(deps: ImageGenToolDeps) {
  return defineTool({
    name: 'generate_image',
    label: 'Generate Image',
    description: GENERATE_IMAGE_DESCRIPTION,
    parameters: Type.Object({
      requests: Type.String({
        description:
          'JSON array: [{"prompt":"product hero shot","width":1080,"height":1080},{"prompt":"banner bg","width":1080,"height":500}]'
      })
    }),
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
        ((creds: ImageGenCredentials) => createDmxImageGenProvider({ credentials: creds }))
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
