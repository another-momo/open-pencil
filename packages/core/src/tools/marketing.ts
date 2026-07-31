import { setupMaterialType } from './marketing/setup'
import { validateMarketingDesign } from './marketing/validate'
import { defineTool } from './schema'

export { lookTool } from './marketing/look'

export {
  BRIEF_ENTRY_NAME,
  BRIEF_NAME,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  appendToBriefAiZone,
  createBrief,
  findBrief,
  isBrief
} from './marketing/brief'
export { getMarketingState } from './marketing/registry'
export { getMarketingPrefs, setMarketingPrefs } from './marketing/registry'
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
    'Set up a marketing design from a material type. Creates the root frame at the design size, instantiates anchor components (brand bar / CTA bar) from the loaded library with declared readonly slots, and returns the active profile id plus any library scan warnings. Material types come from the loaded Library .fig — available ids are shown in the system prompt and in the error returned for unknown ids. Call again with the same id to repair missing anchors; a different id creates an additional design alongside existing ones — one document can host multiple designs.',
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
    },
    profile: {
      type: 'string',
      description:
        'Profile id from the loaded library (style guide). Omit to auto-pick the first profile applicable to this type. Pass a different profile and re-setup to switch styles.'
    }
  },
  execute: (figma, { id, width, height, profile }) =>
    setupMaterialType(
      figma,
      id,
      typeof width === 'number' && typeof height === 'number' ? { width, height } : undefined,
      typeof profile === 'string' ? profile : undefined
    )
})

export const validateTool = defineTool({
  name: 'validate',
  description:
    'Check the marketing design for structural violations: anchor instances (brand bar / CTA bar) deleted or misplaced. Reports violations only — ask the user before fixing.',
  params: {
    id: {
      type: 'string',
      description:
        'Root frame id of the design to validate. Omit to use the most recently active design.'
    }
  },
  execute: (figma, { id }) =>
    validateMarketingDesign(figma, typeof id === 'string' ? id : undefined)
})
