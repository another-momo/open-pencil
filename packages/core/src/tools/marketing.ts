import { listMaterialTypes } from './marketing/material-types'
import { setupMaterialType } from './marketing/setup'
import { validateMarketingDesign } from './marketing/validate'
import { defineTool } from './schema'

export { getMarketingState } from './marketing/registry'

export const setupMaterialTypeTool = defineTool({
  name: 'setup_material_type',
  mutates: true,
  description:
    'Set up a marketing design from a material type. Creates the root frame at the design size, instantiates anchor components (brand bar / CTA bar) with readonly protection, and returns the material type configuration (section plan, style guide, custom fields) to guide the design. Call again with the same id to repair missing anchors, or with a different id to switch material types. Available types: ' +
    listMaterialTypes()
      .map((type) => `${type.id} (${type.label})`)
      .join(', '),
  params: {
    id: {
      type: 'string',
      description: 'Material type id, e.g. "wechat_moments", "product_long", "ecommerce_detail"',
      required: true
    }
  },
  execute: (figma, { id }) => setupMaterialType(figma, id)
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
