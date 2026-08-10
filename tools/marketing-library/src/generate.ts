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

  // Poster-quality experiment (docs/plans/tasks/poster-quality-experiment.md T2).
  // Style-only profile. The Phase 2.5 visual-environment workflow lives in
  // this markdown under "## Visual environment setup (Phase 2.5)" — agents
  // read it directly instead of having it hardcoded into marketing.md.
  const watercolor = makeEntry(graph, profilesPage.id, 'watercolor_poster_v1')
  graph.createNode('TEXT', watercolor.id, {
    fontFamily: FONT,
    text: [
      '# Watercolor poster',
      '',
      'Wash-heavy poster style for long-form images and campaign key visuals. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks. Title sits on the image with strong contrast (heavy weight + shadow), not on top of transparent decorative layers.',
      '',
      '## Type scale',
      'Extreme contrast. Hero title 72–110px on a 750px-wide canvas (a 6–8 character title fills a line). Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular. A hero headline stacks size + weight + color + shadow at the same time — single-property hierarchy is for information-dense layouts, not this style.',
      '',
      '## Spacing rhythm',
      'Deliberately uneven. Hero segment → large breathing space → information-dense segment → tight space → breathing space again. Variance in section spacing carries visual weight; constant rhythm reads as a screen.',
      '',
      '## Visual environment setup (Phase 2.5)',
      'Use the `compose_backdrop` tool to build the Background Layer for this style. Typical sequence:',
      '',
      '1. Render an empty Frame named `HeroImg` at the top of the root frame (h=500, w=canvas width). This is the hero placeholder.',
      '2. Call `generate_image` against the HeroImg id with a watercolor-style prompt that leaves the bottom ~100px calm (so the overlay\'s fade-in is smooth).',
      '3. Call `sample_hero_color({ id: heroImg.id, direction: "bottom", band_size: 100 })` — this returns the hex of the hero\'s bottom band.',
      '4. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: 2120, hero_height: 500, hero_color: <hex> })`. The tool builds the Background Layer Frame with BaseWash + HeroImg placeholder + BackdropOverlay, places it as the first child of root, and sets the overlay\'s middle stop to the sampled hex.',
      '5. Verify with `look`: the hero should fade smoothly into the overlay\'s middle color with no visible seam at the hero bottom. Content sections painted later will sit on top of the overlay\'s white bottom.',
      '',
      'If `compose_backdrop` returns an error, read it carefully — it usually means a node id was wrong or the hero image has not been generated yet. Do not invent geometry: the tool handles 100px overlap, `position="absolute"`, the 8-digit hex alpha trick, and the gradient transform internally.',
      '',
      '## Tone',
      'Restrained, atmospheric. Short sentences. No hard-sell phrasing ("限时秒杀", "最后一天"). Decorative elements live inside generated hero images, not as separate transparent overlays stacked on top — AI-generated PNGs do not reliably produce clean alpha channels, so do not plan around transparent brush strokes, ink splashes, or floating calligraphy.'
    ].join('\n'),
    fontSize: 12,
    fills: solid(DARK),
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  kv(graph, watercolor.id, 'applicable_to: product_long, event_poster, xiaohongshu')

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
