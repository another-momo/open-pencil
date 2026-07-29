import { listMaterialTypes } from './marketing/material-types'
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
export { listMaterialTypes } from './marketing/material-types'

export const setupMaterialTypeTool = defineTool({
  name: 'setup_material_type',
  mutates: true,
  description:
    'Set up a marketing design from a material type. Creates the root frame at the design size, instantiates anchor components (brand bar / CTA bar) with readonly protection, and returns the material type configuration (section plan, style guide, custom fields) to guide the design. Call again with the same id to repair missing anchors, or with a different id to switch material types. Available types (id — label — match keywords): ' +
    listMaterialTypes()
      .map((type) => `${type.id} (${type.label}: ${type.matchKeywords.join(', ')})`)
      .join(', '),
  params: {
    id: {
      type: 'string',
      description:
        'Material type id, e.g. "wechat_moments", "product_long", "ecommerce_detail". Use "custom" with width+height for sizes no preset covers.',
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

export const validateTool = defineTool({
  name: 'validate',
  description:
    'Check the marketing design for constraint violations: readonly nodes (logo, brand name, QR code) modified or deleted, anchor instances misplaced, section count out of range. Reports violations only — ask the user before fixing. After the user confirms a change was intentional, call again with accept=true to re-baseline.',
  params: {
    accept: {
      type: 'boolean',
      description:
        'Update readonly baselines to current values (use after user confirms intentional change)'
    }
  },
  execute: (figma, { accept }) => validateMarketingDesign(figma, accept === true)
})
