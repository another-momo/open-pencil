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
  // Distinguish "node not found" from "node has no IMAGE fill" — the latter
  // is fixable on the spot with {"id":"...","asImage":true}.
  const noFill = skipped.filter((id) => figma.getNodeById(id) !== null)
  let hint = ''
  if (noFill.length > 0) {
    const plural = noFill.length > 1
    hint = ` — tip: ${plural ? 'these nodes have' : 'this node has'} no IMAGE fill; pass {"id":"<id>","asImage":true} to render ${plural ? 'them' : 'it'} as a reference`
  }
  return new Error(`Failed to extract all reference image(s): ${skipped.join(', ')}${hint}`)
}

async function extractNodeImage(figma: FigmaAPI, nodeId: string): Promise<Uint8Array | null> {
  const node = figma.getNodeById(nodeId)
  if (!node) return null
  const imgFill = node.fills.find((fill) => fill.type === 'IMAGE') as
    | { imageHash?: string }
    | undefined
  if (!imgFill?.imageHash) return null
  return figma.graph.images.get(imgFill.imageHash) ?? null
}

async function extractReferenceImage(
  figma: FigmaAPI,
  ref: ImageGenReference
): Promise<Uint8Array | null> {
  if (ref.asImage) {
    if (!figma.exportImage) return null
    return figma.exportImage([ref.id], { scale: 1, format: 'PNG' })
  }
  return extractNodeImage(figma, ref.id)
}

/**
 * Generate an image and place it on the canvas.
 *
 * `references` is the ONLY source of input images — the target node (`id`) is
 * just the output destination and never contributes its pixels implicitly:
 * - No `id`: create a new FRAME sized to the request and fill it.
 * - With `id`: overwrite that node's fill (leaf shape or frame background).
 * - To EDIT an existing image, the agent includes the target's own id in
 *   `references`; to REGENERATE without the current image, it leaves it out.
 * - Overwriting a node that has content snapshots the old subtree into the
 *   page's generation-history container first (see ./history).
 * - A protected `id` (library reference / history snapshot) is never
 *   overwritten: the call falls back to creating a NEW node and says so in
 *   the result note.
 */
export async function generateOne(
  figma: FigmaAPI,
  provider: ImageGenProvider,
  req: ImageGenRequest
): Promise<ImageGenExecuteResult> {
  let target = req.id ? figma.getNodeById(req.id) : null

  // Soft guard against mistaken overwrite targets: library references are
  // inputs, not outputs; history snapshots are frozen records. Instead of
  // failing the call, fall back to generating a NEW node and leave the
  // protected node untouched — the note tells the agent what happened.
  let protectedNote: string | undefined
  let fallbackSize: { width: number; height: number } | undefined
  if (target && req.id) {
    const raw = figma.graph.getNode(req.id)
    const protectedAs =
      raw && libraryReferenceId(raw)
        ? 'a library reference image'
        : raw && isInImageHistory(figma.graph, raw.id)
          ? 'a generation-history snapshot'
          : undefined
    if (raw && protectedAs) {
      protectedNote = `Node ${req.id} ("${raw.name}") is ${protectedAs} and was NOT overwritten — the image was generated as a new canvas node instead, sized like the protected node. To iterate on that image, pass its id in "references" and omit "id" (or target a normal node).`
      fallbackSize = { width: Math.round(raw.width), height: Math.round(raw.height) }
      target = null
    }
  }

  const references = req.references ?? []
  const images: Uint8Array[] = []
  const skipped: string[] = []
  for (const ref of references) {
    const bytes = await extractReferenceImage(figma, ref)
    if (bytes) images.push(bytes)
    else skipped.push(ref.id)
  }

  if (references.length > 0) {
    // A prompt with [image N] markers misaligns silently when any image drops
    // out — fail loudly instead of letting the model edit the wrong image.
    if (skipped.length > 0 && IMAGE_MARKER_RE.test(req.prompt)) {
      throw new Error(
        `Failed to extract reference image(s): ${skipped.join(', ')} — the prompt contains [image N] markers that would misalign; fix the references and retry`
      )
    }
    if (images.length === 0) {
      throw allReferencesFailedError(figma, skipped)
    }
  }
  const skippedNote =
    skipped.length > 0
      ? `Used ${images.length}/${references.length} reference image(s); skipped: ${skipped.join(', ')}`
      : undefined
  const note = [protectedNote, skippedNote].filter(Boolean).join(' ') || undefined

  let finalReq = req
  if (!target) {
    target = figma.createFrame()
    target.resize(
      req.width ?? fallbackSize?.width ?? 1024,
      req.height ?? fallbackSize?.height ?? 1024
    )
    target.name = req.prompt.slice(0, 40) || 'Generated image'
  }
  if (req.width === undefined || req.height === undefined) {
    // Request without an explicit size: inherit the target node's real
    // dimensions for the API size (16px-aligned + constraint-clipped).
    // Explicit width/height always win.
    const normalized = normalizeSize(Math.round(target.width), Math.round(target.height))
    if (!('error' in normalized)) {
      finalReq = { ...req, width: normalized.width, height: normalized.height }
    }
  }

  const gen = await provider.generate(finalReq, images.length > 0 ? images : undefined)

  // Preserve the superseded content BEFORE writing the new fill, so no
  // version is ever lost (and a mistaken target stays recoverable).
  const snapshot = req.id ? snapshotBeforeOverwrite(figma.graph, target.id) : undefined

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
