/**
 * default-library.fig generator (docs/plans/l2-resource-library.md v1 任务 1).
 *
 * Builds the shipped marketing library as a plain .fig — four pages
 * (Types / Profiles / Components / References), each containing plain
 * frames with metadata as `key: value` TEXT children. Run: `bun run generate`
 * in this folder (or `bun tools/marketing-library/src/generate.ts` from the
 * repo root). Output: public/default-library.fig (served as a build-time
 * asset, Q11 — keep it small).
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { exportFigFile } from '@open-pencil/core/io'
import { computeImageHash, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

const here = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(here, '..', '..', '..', 'public', 'default-library.fig')

/** 32x32 solid brand-orange placeholder logo (same bytes as the retired code-side fallback) */
const DEFAULT_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGP4n21KU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAEIbfFsPVWtxAAAAAElFTkSuQmCC'

const FONT = 'Alibaba PuHuiTi'

const GRAY = { r: 0.6, g: 0.6, b: 0.6, a: 1 }
const DARK = { r: 0.1, g: 0.1, b: 0.1, a: 1 }
const WHITE = { r: 1, g: 1, b: 1, a: 1 }

function solid(color: typeof GRAY): SceneNode['fills'] {
  return [{ type: 'SOLID', color, opacity: 1, visible: true }]
}

function kv(graph: SceneGraph, parentId: string, line: string): void {
  graph.createNode('TEXT', parentId, {
    fontFamily: FONT,
    text: line,
    fontSize: 12,
    fills: solid(GRAY),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
}

function makeZonePage(graph: SceneGraph, name: string, x: number): SceneNode {
  const page = graph.addPage(name)
  page.x = x
  page.y = 0
  return page
}

function makeEntry(graph: SceneGraph, parentId: string, name: string): SceneNode {
  return graph.createNode('FRAME', parentId, {
    name,
    layoutMode: 'VERTICAL',
    itemSpacing: 4,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    fills: []
  })
}

function addType(
  graph: SceneGraph,
  parentId: string,
  type: {
    id: string
    label: string
    size: string
    description: string
    anchorFirst?: string
    anchorLast?: string
  }
): void {
  const entry = makeEntry(graph, parentId, type.id)
  kv(graph, entry.id, `id: ${type.id}`)
  kv(graph, entry.id, `label: ${type.label}`)
  kv(graph, entry.id, `size: ${type.size}`)
  kv(graph, entry.id, `description: ${type.description}`)
  kv(graph, entry.id, `anchor_first: ${type.anchorFirst ?? ''}`)
  kv(graph, entry.id, `anchor_last: ${type.anchorLast ?? ''}`)
}

/** Marker texts live inside the component but outside its auto-layout flow */
function markerText(graph: SceneGraph, componentId: string, line: string, below: number): void {
  graph.createNode('TEXT', componentId, {
    fontFamily: FONT,
    text: line,
    fontSize: 10,
    fills: solid(GRAY),
    textAutoResize: 'WIDTH_AND_HEIGHT',
    layoutPositioning: 'ABSOLUTE',
    x: 0,
    y: below
  })
}

function buildBrandBar(graph: SceneGraph, parentId: string, logoHash: string): void {
  const bar = graph.createNode('COMPONENT', parentId, {
    name: 'BrandBar',
    width: 750,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 12,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    counterAxisAlign: 'CENTER',
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 24,
    fills: solid(WHITE)
  })
  markerText(graph, bar.id, 'readonly: logo, brandName', 76)
  graph.createNode('RECTANGLE', bar.id, {
    name: 'logo',
    width: 40,
    height: 40,
    cornerRadius: 8,
    fills: [
      {
        type: 'IMAGE',
        color: { ...WHITE },
        imageHash: logoHash,
        imageScaleMode: 'FILL',
        visible: true,
        opacity: 1
      }
    ]
  })
  graph.createNode('TEXT', bar.id, {
    fontFamily: FONT,
    name: 'brandName',
    text: '品牌名',
    fontSize: 20,
    fontWeight: 700,
    fills: solid(DARK),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
}

function buildCtaBar(graph: SceneGraph, parentId: string): void {
  const bar = graph.createNode('COMPONENT', parentId, {
    name: 'CTABar',
    width: 750,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 24,
    paddingRight: 24,
    fills: solid(DARK)
  })
  markerText(graph, bar.id, 'readonly: qrCode', 110)
  graph.createNode('TEXT', bar.id, {
    fontFamily: FONT,
    name: 'ctaText',
    text: '立即扫码了解更多',
    fontSize: 18,
    fontWeight: 600,
    fills: solid(WHITE),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  graph.createNode('RECTANGLE', bar.id, {
    name: 'qrCode',
    width: 64,
    height: 64,
    cornerRadius: 4,
    fills: solid(WHITE)
  })
}

export function buildDefaultLibraryGraph(): SceneGraph {
  const graph = new SceneGraph()

  // Drop the auto-created 'Page 1' — zone pages (Types / Profiles / Components / References)
  // are the only structural pages in a library .fig and we don't want an empty
  // blank page in the Pages panel.
  const initialPage = graph.getPages()[0]
  if (initialPage) graph.deleteNode(initialPage.id)

  const logoBytes = Uint8Array.fromBase64(DEFAULT_LOGO_BASE64)
  const logoHash = computeImageHash(logoBytes)
  graph.images.set(logoHash, logoBytes)

  const typesPage = makeZonePage(graph, 'Types', 0)
  addType(graph, typesPage.id, {
    id: 'wechat_moments',
    label: '朋友圈广告',
    size: '1080x1080',
    description: '微信朋友圈方形广告图，促销活泼风格'
  })
  addType(graph, typesPage.id, {
    id: 'wechat_article_cover',
    label: '公众号封面',
    size: '900x500',
    description: '微信公众号文章封面横幅，标题醒目'
  })
  addType(graph, typesPage.id, {
    id: 'xiaohongshu',
    label: '小红书图',
    size: '1080x1440',
    description: '小红书种草图，生活化真实感',
    anchorLast: 'BrandBar'
  })
  addType(graph, typesPage.id, {
    id: 'ecommerce_detail',
    label: '电商详情页',
    size: '750x',
    description: '电商产品详情长图，卖点清晰有信任感',
    anchorFirst: 'BrandBar',
    anchorLast: 'CTABar'
  })
  addType(graph, typesPage.id, {
    id: 'event_poster',
    label: '活动海报',
    size: '1080x1920',
    description: '线下活动海报，视觉冲击力优先'
  })
  addType(graph, typesPage.id, {
    id: 'dsp_banner',
    label: 'DSP 广告',
    size: '300x250',
    description: 'DSP 投放 banner（IAB Medium Rectangle），信息极简'
  })
  addType(graph, typesPage.id, {
    id: 'product_long',
    label: '产品长图',
    size: '750x',
    description: '产品叙事长图，高级感品质路线',
    anchorFirst: 'BrandBar',
    anchorLast: 'CTABar'
  })

  const profilesPage = makeZonePage(graph, 'Profiles', 500)
  const casual = makeEntry(graph, profilesPage.id, 'casual_v1')
  graph.createNode('TEXT', casual.id, {
    fontFamily: FONT,
    text: [
      '# 休闲活泼风格',
      '',
      '- 配色：主色 #FF6B35，配白色与深灰，整体明快',
      '- 字体：Alibaba PuHuiTi；标题加粗，正文 Regular',
      '- 语气：年轻、直接、促销感；多用短句和行动词',
      '- 版式：留白充足，卖点用图标 + 短文案成组出现'
    ].join('\n'),
    fontSize: 12,
    fills: solid(DARK),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  kv(graph, casual.id, 'applicable_to: wechat_moments, xiaohongshu, dsp_banner')

  // Poster-quality experiment (docs/plans/tasks/poster-quality-experiment.md T2):
  // carries the expressive type scale, spacing scale and backdrop recipe that
  // base.md's UI-density defaults would otherwise cap. Profile markdown is the
  // highest-priority overlay, so the numbers here override the base scale.
  const festival = makeEntry(graph, profilesPage.id, 'chinese_festival_v1')
  graph.createNode('TEXT', festival.id, {
    fontFamily: FONT,
    text: [
      '# 国风节日长图',
      '',
      '水彩晕染 + 留白的中式节日风格，用于端午/中秋/春节一类的活动长图。整体清淡，靠大面积连续底纹和极端字阶对比撑画面，不靠色块分区。',
      '',
      '## 配色',
      '- 主调 #4A7C3F（竹青），辅 #FDFCF7（宣纸白）、#E8F0E2（淡青）',
      '- 强调色 #C1442E（朱砂）全图只用一处：主标题的一个字，或一枚印章',
      '- 禁用 UI 灰阶（#6B7280 一类）。正文 #3D4A35，弱文字 #7A8A6E',
      '',
      '## 字阶（覆盖 base 的 UI 字阶）',
      '- 主标题 88 / 段标题 40 / 副标题 34 / 正文 24 / 注释 18',
      '- 主标题 Heavy 或 Black，正文 Regular',
      '- 主标题同时叠加字号、字重、颜色、阴影——不受 base"一次只改一个属性"限制',
      '- 750 宽画布下，主标题 6–8 字应占满一行',
      '',
      '## 间距（覆盖 base 的 4px 栅格上限）',
      '- 段间 96–160，段内组间 32–48，组内 12–20',
      '- 节奏必须不均匀：hero 段后留大白，信息密集段收紧',
      '',
      '## 背景层（先于任何内容层完成）',
      '1. 全画布 BaseWash 竖向渐变兜底（#E8F0E2 → #FDFCF7）',
      '2. 分 3 段生图，相邻段重叠约 1/5 画布高度',
      '3. 每处接缝用 alpha 渐变蒙版羽化，不留硬边',
      '4. 顶层全画布 #4A7C3F blendMode="hue" opacity 0.2 统一色调',
      '配方见 system prompt 的 Composition primitives 段。',
      '',
      '## 标题处理',
      '主标题下方垫一枚 AI 生成的透明底粗毛笔笔触（淡青），文字压在其上，并带 shadow 提可读性。',
      '笔触生图 prompt 片段："中国风水墨粗毛笔笔触，淡绿色，透明背景，横向一笔，边缘飞白"',
      '',
      '## 分隔',
      '不用分隔线。段与段靠底纹深浅变化和留白区分。段标题用小色块或印章形状标记，不用整行色条。',
      '',
      '## 装饰元素（生图 prompt 片段）',
      '- 竹叶："中国风水彩竹叶，淡绿，透明背景，几片散落"',
      '- 飞白："水墨飞白笔触，米黄与淡绿，透明背景"',
      '- 印章："中式朱砂印章，方形，留白边，透明背景"',
      '- 云纹："简约中式祥云纹样，线稿，淡青色，透明背景"',
      '装饰绕开文字可读区，允许压在图片边缘并跨越段界。',
      '',
      '## 语气',
      '克制、有文化感；短句；不堆感叹号；不写"限时秒杀"一类硬促销词。'
    ].join('\n'),
    fontSize: 12,
    fills: solid(DARK),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  kv(graph, festival.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  const componentsPage = makeZonePage(graph, 'Components', 1000)
  buildBrandBar(graph, componentsPage.id, logoHash)
  buildCtaBar(graph, componentsPage.id)

  const referencesPage = makeZonePage(graph, 'References', 1500)
  const ref = graph.createNode('FRAME', referencesPage.id, {
    name: 'ref-product-long-001',
    width: 375,
    height: 200,
    fills: solid({ r: 0.95, g: 0.95, b: 0.95, a: 1 })
  })
  graph.createNode('TEXT', ref.id, {
    fontFamily: FONT,
    text: '示例参考：高端产品长图（深底金字）',
    fontSize: 14,
    x: 16,
    y: 16,
    fills: solid(DARK),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  markerText(graph, ref.id, 'applicable_to: product_long', 160)
  markerText(graph, ref.id, 'tag: luxury_v1', 180)

  return graph
}

if (import.meta.main) {
  const graph = buildDefaultLibraryGraph()
  const bytes = await exportFigFile(graph)
  await writeFile(OUTPUT, bytes)
  console.log(`Wrote ${OUTPUT} (${(bytes.length / 1024).toFixed(1)} KB)`)
}
