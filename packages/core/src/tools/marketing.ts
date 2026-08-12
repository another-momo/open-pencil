import type { FigmaAPI } from '#core/figma-api'

import {
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_WIDTH,
  appendToBriefAIZone,
  bindBriefToDesign,
  briefBoundDesignIds,
  createBriefPlaced,
  findBrief,
  getPageContentBounds,
  listBriefs,
  setBriefBindingLabel
} from './marketing/brief'
import { readBrief, updateBriefContent } from './marketing/brief-edit'
import { getMarketingState } from './marketing/registry'
import { setupMaterialType } from './marketing/setup'
import { validateMarketingDesign } from './marketing/validate'
import { defineTool } from './schema'

export { lookTool } from './marketing/look'
export { sampleHeroColorTool } from './marketing/sample-color'
export { composeBackdropTool } from './marketing/compose-backdrop'
export { cutoutTool } from './marketing/cutout'

export {
  BRIEF_BINDING_LABEL_NAME,
  BRIEF_CONCLUSION_GROUP_NAME,
  BRIEF_CONCLUSIONS_NAME,
  BRIEF_CONTENT_GAP,
  BRIEF_EMPTY_HINT_NAME,
  BRIEF_EMPTY_STATE_NAME,
  BRIEF_ENTRY_NAME,
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_NAME,
  BRIEF_WIDTH,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  addBriefMaterialEntry,
  appendToBriefAIZone,
  bindBriefToDesign,
  briefBoundDesignIds,
  createBrief,
  createBriefPlaced,
  findBrief,
  getPageContentBounds,
  isBrief,
  listBriefs,
  resolveBriefPlacement,
  setBriefBindingLabel
} from './marketing/brief'
export {
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from './marketing/brief-edit'
export type { BriefMaterialView, BriefView } from './marketing/brief-edit'
export { getMarketingState } from './marketing/registry'
export { cloneSubtreeAcrossGraphs } from './marketing/clone'
export { listDocumentLibraryNames, markLibraryReference } from './marketing/restore'
export {
  MATERIALS_PAGE_NAME,
  getDefaultLibrary,
  getLibrarySession,
  injectLibraryReferences,
  listInjectedReferenceIds,
  loadLibrary,
  parseLibraryIndex,
  setDefaultLibrary,
  setLibrarySession
} from './marketing/library'
export type { InjectReferencesResult, LibraryIndex, LibrarySession } from './marketing/library'

export const setupMaterialTypeTool = defineTool({
  name: 'setup_material_type',
  mutates: true,
  description:
    'Set up a marketing design from a material type. Creates the root frame at the design size, instantiates anchor components (brand bar / CTA bar) from the loaded library with declared readonly slots, and returns any library scan warnings. Material types come from the loaded Library .fig — available ids are shown in the system prompt and in the error returned for unknown ids. Continue/repair is PAGE-scoped: calling again with the same id on the same page adopts that page\'s design (the result then says adopted: true with its existing child count — confirm with the user whether to continue it or start over); the same id on a different page, or with mode: "new", always creates a fresh design alongside existing ones — one document can host many designs, and adoption never crosses pages.',
  params: {
    id: {
      type: 'string',
      description:
        'Material type id from the loaded library, e.g. "wechat_moments", "product_long". Use "custom" with width+height for sizes no preset covers.',
      required: true
    },
    mode: {
      type: 'string',
      description:
        '"continue" (default) adopts the same-type design on the current page if one exists; "new" always creates a fresh root frame — pass "new" whenever the user asks for a new/separate design rather than continuing the previous one.'
    },
    width: {
      type: 'number',
      description: 'Design width in px (required when id is "custom")'
    },
    height: {
      type: 'number',
      description: 'Design height in px (required when id is "custom")'
    }
  },
  execute: (figma, { id, mode, width, height }) =>
    setupMaterialType(
      figma,
      id,
      typeof width === 'number' && typeof height === 'number' ? { width, height } : undefined,
      mode === 'new' ? 'new' : 'continue'
    )
})

/** Page (CANVAS) name owning a node — for reporting where a bound design lives. */
function pageNameOf(graph: FigmaAPI['graph'], nodeId: string): string | undefined {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'CANVAS') return current.name
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return undefined
}

export const readBriefTool = defineTool({
  name: 'read_brief',
  mutates: false,
  description:
    'Read the 需求单 (design brief) in one call — content text, material entries (each with imageNodeId for `look`, caption, hasImage), AI conclusions, and the designs it is bound to. The brief BOUND to the active design wins when several exist. Returns { brief: null } when no brief exists — that is a normal state, not an error; the marketing workflow then creates one with create_brief. When the page has multiple briefs and none is bound to the active design, the result is { brief: null, ambiguous: true, candidates } — ask the user which brief to use, do NOT create another one. Prefer this over find_nodes + describe when looking for the brief.',
  params: {},
  execute: (figma) => {
    const graph = figma.graph
    const activeRootId = getMarketingState(graph)?.rootFrameId
    const pageBriefs = listBriefs(figma)
    const boundToActive = activeRootId
      ? pageBriefs.find((brief) => briefBoundDesignIds(brief).includes(activeRootId))
      : undefined
    if (pageBriefs.length > 1 && !boundToActive) {
      return {
        brief: null,
        ambiguous: true,
        candidates: pageBriefs.map((brief) => ({
          briefId: brief.id,
          boundDesigns: briefBoundDesignIds(brief)
        })),
        note: 'Multiple 需求单 on this page and none is bound to the active design — ask the user which one to use instead of creating another brief.'
      }
    }
    const view = readBrief(figma, activeRootId)
    if (!view) return { brief: null }
    return {
      briefId: view.briefId,
      boundDesigns: view.boundDesigns.map((rootFrameId) => ({
        rootFrameId,
        name: graph.getNode(rootFrameId)?.name ?? '(deleted)',
        page: pageNameOf(graph, rootFrameId) ?? null
      })),
      content: view.content,
      materials: view.materials.map((material) => ({
        entryId: material.entryId,
        imageNodeId: material.imageNodeId,
        caption: material.caption,
        hasImage: material.imageHash !== null
      })),
      conclusions: view.conclusions
    }
  }
})

export const createBriefTool = defineTool({
  name: 'create_brief',
  mutates: true,
  description:
    "Create a 需求单 (design brief) frame on the canvas, placed clear of existing content. The marketing workflow calls this directly when read_brief reports none exists — no need to ask the user first, and the brief panel does NOT pop up for the user on AI-initiated creation. Pass the user's original request verbatim as initial_content — it is transcribed into the content zone as-is (never embellished, paraphrased, or expanded); beyond that transcription the AI never invents brief content. The brief auto-binds to the active design when one exists. If a brief already exists, nothing is created and the result is { briefId, created: false } with the existing brief's id — read it with read_brief instead.",
  params: {
    initial_content: {
      type: 'string',
      description:
        "The user's original request text, VERBATIM — seeded into the content zone so the brief captures the requirement as the user stated it. Never embellish or expand."
    }
  },
  execute: (figma, { initial_content }) => {
    const existing = findBrief(figma, getMarketingState(figma.graph)?.rootFrameId)
    if (existing) return { briefId: existing.id, created: false }
    const bounds = getPageContentBounds(figma)
    // No viewport access here: center on existing content (collides → shifts
    // right of it), or at the origin on an empty page.
    const center = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : { x: BRIEF_WIDTH / 2, y: BRIEF_ESTIMATED_HEIGHT / 2 }
    const brief = createBriefPlaced(figma, center)
    if (typeof initial_content === 'string' && initial_content.trim()) {
      updateBriefContent(figma, brief.id, initial_content.trim())
    }
    const activeRootId = getMarketingState(figma.graph)?.rootFrameId
    if (activeRootId && figma.graph.getNode(activeRootId)) {
      bindBriefToDesign(figma, brief.id, activeRootId)
      const designName = figma.graph.getNode(activeRootId)?.name
      const pageName = pageNameOf(figma.graph, activeRootId)
      setBriefBindingLabel(figma, brief.id, `关联：${designName} · ${pageName}`)
    }
    return { briefId: brief.id, created: true, ...(activeRootId ? { boundTo: activeRootId } : {}) }
  }
})

export const appendBriefConclusionTool = defineTool({
  name: 'append_brief_conclusion',
  mutates: true,
  description:
    'Append one confirmed conclusion line to the AI结论区 of the 需求单 (design brief) — locked direction, confirmed campaign facts, or a one-line material description. Styling and placement are handled automatically; pass only the conclusion text (one line, no leading "·"). Append-only by design: existing lines cannot be edited or removed. Returns { ok: false } when no brief exists — create one first, or skip recording for this session if the user works without a brief.',
  params: {
    text: {
      type: 'string',
      description: 'One conclusion line, e.g. "方向A：水彩萌趣（嫩绿 #A8D5BA / 米白 #F5EFE0）".',
      required: true
    }
  },
  execute: (figma, { text }) => {
    if (typeof text !== 'string' || !text.trim()) {
      return { ok: false, note: 'Pass the conclusion text.' }
    }
    const activeRootId = getMarketingState(figma.graph)?.rootFrameId
    const brief = findBrief(figma, activeRootId)
    if (!brief) return { ok: false, note: 'No 需求单 exists in this document.' }
    const designName = activeRootId ? figma.graph.getNode(activeRootId)?.name : undefined
    const appended = appendToBriefAIZone(figma, brief.id, text.trim(), designName)
    return appended
      ? { ok: true }
      : { ok: false, note: 'The brief exists but its AI结论区 could not be located.' }
  }
})

export const validateTool = defineTool({
  name: 'validate',
  description:
    'Check the marketing design for structural violations: anchor instances (brand bar / CTA bar) deleted or misplaced. Reports violations only — ask the user before fixing.',
  params: {
    id: {
      type: 'string',
      description: 'Root frame id of the design to validate (returned by setup_material_type).',
      required: true
    }
  },
  execute: (figma, { id }) =>
    typeof id === 'string' && id
      ? validateMarketingDesign(figma, id)
      : {
          valid: false,
          note: 'Pass the design root frame id (returned by setup_material_type).'
        }
})
