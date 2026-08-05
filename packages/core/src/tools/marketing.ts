import {
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_WIDTH,
  createBriefPlaced,
  findBrief,
  getPageContentBounds
} from './marketing/brief'
import { readBrief } from './marketing/brief-edit'
import { setupMaterialType } from './marketing/setup'
import { validateMarketingDesign } from './marketing/validate'
import { defineTool } from './schema'

export { lookTool } from './marketing/look'

export {
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
  appendToBriefAiZone,
  createBrief,
  createBriefPlaced,
  findBrief,
  getPageContentBounds,
  isBrief,
  resolveBriefPlacement
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
    'Set up a marketing design from a material type. Creates the root frame at the design size, instantiates anchor components (brand bar / CTA bar) from the loaded library with declared readonly slots, and returns any library scan warnings. Material types come from the loaded Library .fig — available ids are shown in the system prompt and in the error returned for unknown ids. Call again with the same id to repair missing anchors; a different id creates an additional design alongside existing ones — one document can host multiple designs.',
  params: {
    id: {
      type: 'string',
      description:
        'Material type id from the loaded library, e.g. "wechat_moments", "product_long". Use "custom" with width+height for sizes no preset covers.',
      required: true
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
  execute: (figma, { id, width, height }) =>
    setupMaterialType(
      figma,
      id,
      typeof width === 'number' && typeof height === 'number' ? { width, height } : undefined
    )
})

export const readBriefTool = defineTool({
  name: 'read_brief',
  mutates: false,
  description:
    'Read the 需求单 (design brief) on the current page in one call — content text, material entries (each with imageNodeId for `look`, caption, hasImage), and AI conclusions. Returns { brief: null } when no brief exists — that is a normal state, not an error; proceed without one (or propose creating one if the user is sharing real requirements). Prefer this over find_nodes + describe when looking for the brief.',
  params: {},
  execute: (figma) => {
    const view = readBrief(figma)
    if (!view) return { brief: null }
    return {
      briefId: view.briefId,
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
    "Create an EMPTY 需求单 (design brief) frame on the canvas, placed clear of existing content. Only call this after proposing it to the user and receiving explicit agreement — never create one unprompted. The brief is created empty on purpose: never fill in its content yourself; after creating, tell the user the brief panel opened and ask them to fill in the content zone and add materials there. If a brief already exists, nothing is created and the result is { briefId, created: false } with the existing brief's id — read it with read_brief instead.",
  params: {},
  execute: (figma) => {
    const existing = findBrief(figma)
    if (existing) return { briefId: existing.id, created: false }
    const bounds = getPageContentBounds(figma)
    // No viewport access here: center on existing content (collides → shifts
    // right of it), or at the origin on an empty page.
    const center = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : { x: BRIEF_WIDTH / 2, y: BRIEF_ESTIMATED_HEIGHT / 2 }
    const brief = createBriefPlaced(figma, center)
    return { briefId: brief.id, created: true }
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
