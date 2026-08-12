import type { SceneNode } from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'
import { createImageFill } from '#core/tools/image-fill'
import { libraryReferenceId } from '#core/tools/marketing/restore'

import { isInImageHistory, snapshotBeforeOverwrite, type HistorySnapshot } from './history'
import type { ImageGenProvider, ImageGenReference, ImageGenRequest } from './providers'
import { normalizeSize } from './requests'

export interface ImageGenExecuteResult {
  id: string
  width: number
  height: number
  canvasWidth: number
  canvasHeight: number
  provider: string
  snapshot?: HistorySnapshot
  note?: string
  error?: string
}

const IMAGE_MARKER_RE = /\[image\s+\d+\]/i

function allReferencesFailedError(figma: FigmaAPI, skipped: string[]): Error {
  // Distinguish "node not found" from "node exists but could not provide
  // pixels" — the latter means no IMAGE fill AND no render capability here.
  const unrenderable = skipped.filter((id) => figma.getNodeById(id) !== null)
  let hint = ''
  if (unrenderable.length > 0) {
    const plural = unrenderable.length > 1
    hint = ` — tip: ${plural ? 'these nodes have' : 'this node has'} no IMAGE fill and could not be rendered as a reference (exportImage is unavailable in this environment)`
  }
  return new Error(`Failed to extract all reference image(s): ${skipped.join(', ')}${hint}`)
}

function visibleImageHash(node: SceneNode): string | undefined {
  for (const fill of node.fills) {
    if (fill.type === 'IMAGE' && fill.visible && 'imageHash' in fill) {
      return fill.imageHash
    }
  }
  return undefined
}

async function renderNode(figma: FigmaAPI, nodeId: string): Promise<Uint8Array | null> {
  if (!figma.exportImage) return null
  return figma.exportImage([nodeId], { scale: 1, format: 'PNG' })
}

interface ExtractedImage {
  bytes: Uint8Array | null
  /** Just-in-time usage hint surfaced in the result note (no behavior change) */
  teach?: string
}

/**
 * Extraction semantics per node shape:
 * - `composite: true` → always the node's rendered appearance (children,
 *   effects, rounded corners included); redundant on plain image nodes —
 *   said so in `teach`.
 * - IMAGE fill, no flag → the original bytes (lossless); children, if any,
 *   are NOT included — said so in `teach`.
 * - No IMAGE fill → rendering is the only sensible extraction, automatic.
 */
async function extractReferenceImage(
  figma: FigmaAPI,
  ref: ImageGenReference
): Promise<ExtractedImage> {
  const raw = figma.graph.getNode(ref.id)
  if (!raw) return { bytes: null }
  const imageHash = visibleImageHash(raw)

  if (ref.composite) {
    const bytes = await renderNode(figma, ref.id)
    if (imageHash && raw.childIds.length === 0) {
      return {
        bytes,
        teach: `reference ${ref.id} ("${raw.name}") already holds a plain image — drop "composite" to use its lossless original bytes`
      }
    }
    return { bytes }
  }

  if (imageHash) {
    const bytes = figma.graph.images.get(imageHash) ?? null
    if (raw.childIds.length > 0) {
      return {
        bytes,
        teach: `reference ${ref.id} ("${raw.name}") contributed only its image bytes — its ${raw.childIds.length} child node(s) (text/decoration) were NOT included; pass "composite":true to reference the full appearance`
      }
    }
    return { bytes }
  }

  return { bytes: await renderNode(figma, ref.id) }
}

interface ProtectedRedirect {
  note: string
  fallbackSize: { width: number; height: number }
}

/**
 * Soft guard against mistaken overwrite targets: library references are
 * inputs, not outputs; history snapshots are frozen records. Instead of
 * failing the call, the caller falls back to generating a NEW node and
 * leaves the protected node untouched — the note tells the agent what
 * happened. Returns undefined when the target may be overwritten normally.
 */
function protectedRedirect(figma: FigmaAPI, nodeId: string): ProtectedRedirect | undefined {
  const raw = figma.graph.getNode(nodeId)
  if (!raw) return undefined
  let protectedAs: string | undefined
  if (libraryReferenceId(raw)) {
    protectedAs = 'a library reference image'
  } else if (isInImageHistory(figma.graph, raw.id)) {
    protectedAs = 'a generation-history snapshot'
  }
  if (!protectedAs) return undefined
  return {
    note: `Node ${nodeId} ("${raw.name}") is ${protectedAs} and was NOT overwritten — the image was generated as a new canvas node instead, sized like the protected node. To iterate on that image, pass its node id in "references" and omit "replace_id" (or target a normal node).`,
    fallbackSize: { width: Math.round(raw.width), height: Math.round(raw.height) }
  }
}

interface ExtractedReferences {
  images: Uint8Array[]
  note?: string
}

async function extractReferenceImages(
  figma: FigmaAPI,
  references: ImageGenReference[],
  prompt: string
): Promise<ExtractedReferences> {
  const images: Uint8Array[] = []
  const skipped: string[] = []
  const teachings: string[] = []
  for (const ref of references) {
    const { bytes, teach } = await extractReferenceImage(figma, ref)
    if (bytes) images.push(bytes)
    else skipped.push(ref.id)
    if (teach) teachings.push(teach)
  }

  if (references.length > 0) {
    // A prompt with [image N] markers misaligns silently when any image drops
    // out — fail loudly instead of letting the model edit the wrong image.
    if (skipped.length > 0 && IMAGE_MARKER_RE.test(prompt)) {
      throw new Error(
        `Failed to extract reference image(s): ${skipped.join(', ')} — the prompt contains [image N] markers that would misalign; fix the references and retry`
      )
    }
    if (images.length === 0) {
      throw allReferencesFailedError(figma, skipped)
    }
  }
  const noteParts = [
    skipped.length > 0
      ? `Used ${images.length}/${references.length} reference image(s); skipped: ${skipped.join(', ')}`
      : '',
    ...teachings
  ].filter(Boolean)
  const note = noteParts.join(' ') || undefined
  return note ? { images, note } : { images }
}

type NodeProxy = NonNullable<ReturnType<FigmaAPI['getNodeById']>>

interface ResolvedOutput {
  target: NodeProxy
  finalReq: ImageGenRequest
}

/**
 * Resolve the output node: the requested target, or a fresh frame when there
 * is no target (or the target was protected-redirected). Requests without an
 * explicit size inherit the target node's real dimensions for the API size
 * (16px-aligned + constraint-clipped); explicit width/height always win.
 */
function resolveOutputTarget(
  figma: FigmaAPI,
  req: ImageGenRequest,
  redirect: ProtectedRedirect | undefined
): ResolvedOutput {
  let target = req.replaceId && !redirect ? figma.getNodeById(req.replaceId) : null
  if (!target) {
    const fallbackSize = redirect?.fallbackSize
    target = figma.createFrame()
    target.resize(
      req.width ?? fallbackSize?.width ?? 1024,
      req.height ?? fallbackSize?.height ?? 1024
    )
    target.name = req.prompt.slice(0, 40) || 'Generated image'
  }

  let finalReq = req
  if (req.width === undefined || req.height === undefined) {
    const normalized = normalizeSize(Math.round(target.width), Math.round(target.height))
    if (!('error' in normalized)) {
      finalReq = { ...req, width: normalized.width, height: normalized.height }
    }
  }
  return { target, finalReq }
}

/**
 * Generate an image and place it on the canvas.
 *
 * `references` is the ONLY source of input images — the target node
 * (`replace_id`) is just the output destination and never contributes its
 * pixels implicitly:
 * - No `replace_id`: create a new FRAME sized to the request and fill it.
 * - With `replace_id`: overwrite that node's fill (leaf shape or frame background).
 * - To EDIT an existing image, the agent includes the target's own id in
 *   `references`; to REGENERATE without the current image, it leaves it out.
 * - Overwriting a node that has content snapshots the old subtree into the
 *   page's generation-history container first (see ./history).
 * - A protected `replace_id` (library reference / history snapshot) is never
 *   overwritten: the call falls back to creating a NEW node and says so in
 *   the result note.
 */
export async function generateOne(
  figma: FigmaAPI,
  provider: ImageGenProvider,
  req: ImageGenRequest
): Promise<ImageGenExecuteResult> {
  const redirect = req.replaceId ? protectedRedirect(figma, req.replaceId) : undefined

  const { images, note: skippedNote } = await extractReferenceImages(
    figma,
    req.references ?? [],
    req.prompt
  )
  const note = [redirect?.note, skippedNote].filter(Boolean).join(' ') || undefined

  const { target, finalReq } = resolveOutputTarget(figma, req, redirect)

  const gen = await provider.generate(finalReq, images.length > 0 ? images : undefined)

  // Preserve the superseded content BEFORE writing the new fill, so no
  // version is ever lost (and a mistaken target stays recoverable).
  const snapshot = req.replaceId ? snapshotBeforeOverwrite(figma.graph, target.id) : undefined

  target.fills = [createImageFill(figma, gen.bytes)]

  return {
    id: target.id,
    width: gen.width,
    height: gen.height,
    canvasWidth: Math.round(target.width),
    canvasHeight: Math.round(target.height),
    provider: provider.name,
    ...(snapshot ? { snapshot } : {}),
    ...(note ? { note } : {})
  }
}
