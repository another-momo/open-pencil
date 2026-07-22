/**
 * Component templates for marketing anchor components.
 *
 * Templates are structured node-tree data (mapping directly to SceneNode
 * fields), not JSX — readonly markers stay inline with their nodes, the
 * data is type-checked, and IMAGE fills can reference registry assets.
 * Materialized into real COMPONENT nodes by builder.ts.
 */

export type TemplateFill = { type: 'SOLID'; color: string } | { type: 'IMAGE'; imageRef: string }

export interface TemplateNode {
  type: 'FRAME' | 'RECTANGLE' | 'TEXT'
  name: string
  /** Marks nodes the AI must not modify (e.g. brand logo, brand name) */
  readonly?: boolean
  width?: number | 'hug' | 'fill'
  height?: number | 'hug' | 'fill'
  layoutMode?: 'HORIZONTAL' | 'VERTICAL'
  itemSpacing?: number
  primaryAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlign?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH'
  /** [vertical, horizontal] */
  padding?: [number, number]
  fills?: TemplateFill[]
  cornerRadius?: number
  characters?: string
  fontSize?: number
  fontWeight?: number
  children?: TemplateNode[]
}

export interface ComponentTemplate {
  id: string
  name: string
  root: TemplateNode
}

const COMPONENT_TEMPLATES: ComponentTemplate[] = [
  {
    id: 'BrandBar',
    name: 'Brand Bar',
    root: {
      type: 'FRAME',
      name: 'BrandBar',
      width: 'fill',
      height: 'hug',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
      counterAxisAlign: 'CENTER',
      padding: [16, 24],
      fills: [{ type: 'SOLID', color: '#FFFFFF' }],
      children: [
        {
          type: 'RECTANGLE',
          name: 'logo',
          width: 40,
          height: 40,
          cornerRadius: 8,
          readonly: true,
          fills: [{ type: 'IMAGE', imageRef: 'brand-logo' }]
        },
        {
          type: 'TEXT',
          name: 'brandName',
          characters: '品牌名',
          fontSize: 20,
          fontWeight: 700,
          readonly: true,
          fills: [{ type: 'SOLID', color: '#1A1A1A' }]
        }
      ]
    }
  },
  {
    id: 'CTABar',
    name: 'CTA Bar',
    root: {
      type: 'FRAME',
      name: 'CTABar',
      width: 'fill',
      height: 'hug',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      primaryAxisAlign: 'SPACE_BETWEEN',
      counterAxisAlign: 'CENTER',
      padding: [20, 24],
      fills: [{ type: 'SOLID', color: '#1A1A1A' }],
      children: [
        {
          type: 'TEXT',
          name: 'ctaText',
          characters: '立即扫码了解更多',
          fontSize: 18,
          fontWeight: 600,
          fills: [{ type: 'SOLID', color: '#FFFFFF' }]
        },
        {
          type: 'RECTANGLE',
          name: 'qrCode',
          width: 64,
          height: 64,
          cornerRadius: 4,
          readonly: true,
          fills: [{ type: 'SOLID', color: '#FFFFFF' }]
        }
      ]
    }
  }
]

export function getComponentTemplate(id: string): ComponentTemplate | undefined {
  return COMPONENT_TEMPLATES.find((template) => template.id === id)
}
