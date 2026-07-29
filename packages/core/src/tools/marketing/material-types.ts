/**
 * Material type registry for the marketing agent mode.
 *
 * A material type maps user intent ("做一张朋友圈广告") to a concrete
 * configuration: design size, anchor components, structural constraints,
 * section plan and style guide. Configs are pure data so they can later
 * be externalized to JSON.
 */

export interface MaterialTypeSize {
  width: number
  /** null = variable height (long images grow with content) */
  height: number | null
}

export interface AnchorComponentRef {
  /** ComponentTemplate id (see component-templates.ts) */
  template: string
  position: 'top' | 'bottom'
}

export interface StructuralConstraints {
  /** Expected anchor placement in the root frame's child list */
  anchors: { template: string; position: 'first' | 'last' }[]
  minSections: number
  maxSections: number
}

export interface SectionPlanItem {
  id: string
  /** Share of total height, percent */
  weight: number
  contentGuide: string
}

export interface StyleGuide {
  colors: string[]
  fonts: string[]
  keywords: string[]
}

export interface MaterialTypeConfig {
  id: string
  label: string
  /** Keywords the AI matches against the user request to infer this type */
  matchKeywords: string[]
  size: MaterialTypeSize
  anchors: AnchorComponentRef[]
  structure: StructuralConstraints
  sectionPlan: SectionPlanItem[]
  styleGuide: StyleGuide
  /** Material-type-specific extra info, interpreted by the AI generically */
  custom: Record<string, string>
}

const BRAND_CTA_ANCHORS: AnchorComponentRef[] = [
  { template: 'BrandBar', position: 'top' },
  { template: 'CTABar', position: 'bottom' }
]

const BRAND_CTA_STRUCTURE_ANCHORS: StructuralConstraints['anchors'] = [
  { template: 'BrandBar', position: 'first' },
  { template: 'CTABar', position: 'last' }
]

const MATERIAL_TYPES: MaterialTypeConfig[] = [
  {
    id: 'wechat_moments',
    label: '朋友圈广告',
    matchKeywords: ['朋友圈', '朋友圈广告', 'wechat moments'],
    size: { width: 1080, height: 1080 },
    anchors: [],
    structure: { anchors: [], minSections: 2, maxSections: 4 },
    sectionPlan: [
      { id: 'main', weight: 60, contentGuide: '主视觉区域，一张底图 + 品牌名或主标题叠加' },
      { id: 'product', weight: 25, contentGuide: '产品展示区域，含价格标签和简短卖点' },
      { id: 'cta', weight: 15, contentGuide: '行动号召文字 + 品牌标识' }
    ],
    styleGuide: {
      colors: ['#FF6B35', '#FFFFFF', '#1A1A1A'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['促销', '活力', '直接']
    },
    custom: { platform: '微信朋友圈', tone: '活泼年轻' }
  },
  {
    id: 'wechat_article_cover',
    label: '公众号封面',
    matchKeywords: ['公众号', '公众号封面', 'article cover'],
    size: { width: 900, height: 500 },
    anchors: [],
    structure: { anchors: [], minSections: 1, maxSections: 2 },
    sectionPlan: [
      { id: 'main', weight: 100, contentGuide: '单画面：背景图 + 文章标题文字，标题需醒目' }
    ],
    styleGuide: {
      colors: ['#1A1A1A', '#FFFFFF', '#07C160'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['简洁', '标题突出', '可读性']
    },
    custom: { platform: '微信公众号' }
  },
  {
    id: 'xiaohongshu',
    label: '小红书图',
    matchKeywords: ['小红书', 'xiaohongshu', '种草', 'rednote'],
    size: { width: 1080, height: 1440 },
    anchors: [{ template: 'BrandBar', position: 'bottom' }],
    structure: {
      anchors: [{ template: 'BrandBar', position: 'last' }],
      minSections: 2,
      maxSections: 5
    },
    sectionPlan: [
      { id: 'hero', weight: 45, contentGuide: '主视觉区域，生活化场景图 + 标题' },
      { id: 'points', weight: 40, contentGuide: '3-4 个种草要点，每个含小图标 + 短文案' },
      { id: 'tags', weight: 15, contentGuide: '话题标签和行动引导' }
    ],
    styleGuide: {
      colors: ['#FF2442', '#FFFFFF', '#333333'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['生活化', '真实感', '种草']
    },
    custom: { platform: '小红书', tone: '真诚分享' }
  },
  {
    id: 'ecommerce_detail',
    label: '电商详情页',
    matchKeywords: ['电商详情', '详情页', '宝贝详情', 'ecommerce'],
    size: { width: 750, height: null },
    anchors: BRAND_CTA_ANCHORS,
    structure: { anchors: BRAND_CTA_STRUCTURE_ANCHORS, minSections: 3, maxSections: 10 },
    sectionPlan: [
      { id: 'hero', weight: 20, contentGuide: '产品主视觉，大图 + 核心卖点一句话' },
      {
        id: 'selling-points',
        weight: 35,
        contentGuide: '3-5 个核心卖点，每点含配图 + 标题 + 说明'
      },
      { id: 'details', weight: 25, contentGuide: '产品细节展示，材质/工艺/参数' },
      { id: 'proof', weight: 20, contentGuide: '信任背书：评价、销量、资质证书' }
    ],
    styleGuide: {
      colors: ['#FF4400', '#FFFFFF', '#333333'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['促销感', '卖点清晰', '信任感']
    },
    custom: { platform: '电商', featureCount: '3-5个核心卖点' }
  },
  {
    id: 'event_poster',
    label: '活动海报',
    matchKeywords: ['活动海报', '海报', 'event poster'],
    size: { width: 1080, height: 1920 },
    anchors: [],
    structure: { anchors: [], minSections: 2, maxSections: 4 },
    sectionPlan: [
      { id: 'hero', weight: 50, contentGuide: '活动主视觉 + 活动名称，视觉冲击力优先' },
      { id: 'info', weight: 30, contentGuide: '活动时间、地点、议程等关键信息' },
      { id: 'cta', weight: 20, contentGuide: '报名方式 + 二维码区域' }
    ],
    styleGuide: {
      colors: ['#6C5CE7', '#FFFFFF', '#2D3436'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['视觉冲击', '信息清晰', '仪式感']
    },
    custom: { eventType: '线下活动' }
  },
  {
    id: 'dsp_banner',
    label: 'DSP 广告',
    matchKeywords: ['DSP', 'banner', 'banner广告', 'IAB'],
    size: { width: 300, height: 250 },
    anchors: [],
    structure: { anchors: [], minSections: 1, maxSections: 2 },
    sectionPlan: [
      {
        id: 'main',
        weight: 100,
        contentGuide: '单画面：产品图 + 一句话卖点 + CTA 按钮，小尺寸下保持可读'
      }
    ],
    styleGuide: {
      colors: ['#0066FF', '#FFFFFF', '#1A1A1A'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['高对比', '信息极简', 'CTA 醒目']
    },
    custom: { platform: 'DSP 投放', note: 'IAB 标准尺寸，默认 Medium Rectangle 300×250' }
  },
  {
    id: 'product_long',
    label: '产品长图',
    matchKeywords: ['产品长图', '详情长图', '长图', 'product long'],
    size: { width: 750, height: null },
    anchors: BRAND_CTA_ANCHORS,
    structure: { anchors: BRAND_CTA_STRUCTURE_ANCHORS, minSections: 3, maxSections: 8 },
    sectionPlan: [
      { id: 'hero', weight: 25, contentGuide: '产品主视觉 + 一句话定位' },
      { id: 'features', weight: 40, contentGuide: '3-4 个功能亮点，每点含示意图 + 标题 + 短说明' },
      { id: 'scenario', weight: 20, contentGuide: '使用场景展示，代入感' },
      { id: 'specs', weight: 15, contentGuide: '规格参数或服务说明' }
    ],
    styleGuide: {
      colors: ['#0A0A0A', '#FFFFFF', '#C9A96E'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['高级感', '叙事感', '品质']
    },
    custom: { tone: '高端叙事' }
  }
]

export function getMaterialType(id: string): MaterialTypeConfig | undefined {
  return MATERIAL_TYPES.find((type) => type.id === id)
}

/** Escape hatch for sizes no preset covers — generic single-page layout */
export function makeCustomMaterialType(width: number, height: number): MaterialTypeConfig {
  return {
    id: 'custom',
    label: `自定义 ${width}×${height}`,
    matchKeywords: [],
    size: { width, height },
    anchors: [],
    structure: { anchors: [], minSections: 1, maxSections: 10 },
    sectionPlan: [
      { id: 'main', weight: 60, contentGuide: '主视觉区域，一张底图 + 品牌名或主标题叠加' },
      { id: 'content', weight: 25, contentGuide: '内容区域，按主题自由组织' },
      { id: 'cta', weight: 15, contentGuide: '行动号召文字 + 品牌标识' }
    ],
    styleGuide: {
      colors: ['#FF6B35', '#FFFFFF', '#1A1A1A'],
      fonts: ['Alibaba PuHuiTi'],
      keywords: ['清晰', '促销', '直接']
    },
    custom: { note: '用户自定义尺寸，无平台预设约束' }
  }
}

export function listMaterialTypes(): { id: string; label: string; matchKeywords: string[] }[] {
  return MATERIAL_TYPES.map((type) => ({
    id: type.id,
    label: type.label,
    matchKeywords: type.matchKeywords
  }))
}
