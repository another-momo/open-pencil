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
import { computeAllLayouts } from '@open-pencil/core/layout'
import { computeImageHash, SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

const here = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(here, '..', '..', '..', 'public', 'default-library.fig')

/** Entry cards within a page: horizontal row with this gap. */
const ENTRY_GAP = 40
/** Long markdown texts wrap at this width so entries stay inspectable. */
const MARKDOWN_WRAP_WIDTH = 560

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

function makeZonePage(graph: SceneGraph, name: string): SceneNode {
  // x is assigned by layoutLibrary once content sizes are known.
  const page = graph.addPage(name)
  page.x = 0
  page.y = 0
  return page
}

const ENTRY_FILL = { r: 0.96, g: 0.96, b: 0.96, a: 1 }

function makeEntry(graph: SceneGraph, parentId: string, name: string): SceneNode {
  return graph.createNode('FRAME', parentId, {
    name,
    layoutMode: 'VERTICAL',
    itemSpacing: 4,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 16,
    cornerRadius: 8,
    fills: solid(ENTRY_FILL)
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
  }
): void {
  const entry = makeEntry(graph, parentId, type.id)
  kv(graph, entry.id, `id: ${type.id}`)
  kv(graph, entry.id, `label: ${type.label}`)
  kv(graph, entry.id, `size: ${type.size}`)
  kv(graph, entry.id, `description: ${type.description}`)
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

  const typesPage = makeZonePage(graph, 'Types')
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
    description: '小红书种草图，生活化真实感'
  })
  addType(graph, typesPage.id, {
    id: 'ecommerce_detail',
    label: '电商详情页',
    size: '750x',
    description: '电商产品详情长图，卖点清晰有信任感'
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
    description: '产品叙事长图，高级感品质路线'
  })

  const profilesPage = makeZonePage(graph, 'Profiles')
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
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, casual.id, 'applicable_to: wechat_moments, xiaohongshu, dsp_banner')

  // ── Shared backbone fragments for the poster profiles (R0 样板 + R6 对照组) ──
  // The Phase 2.5 mechanics and the legibility contract are style-independent;
  // keeping them in one place prevents recipe drift across profiles. The v0
  // legacy baseline below is a FROZEN control — never route it through these.
  const HERO_PIXELS_FIXED =
    "- Hero pixels are generated at the holder's final size (750×850 = slot 750 + bleed 100). The image API may 16px-align the requested size, so the calm bottom ~100px maps approximately (≈1:1) onto the fade zone — keep it calm regardless."

  /** Title-band contract with the tonal pairing rule (2026-08-11 端午冒烟: 白字×浅平静底 ≈1.1:1 事故的根因修复). */
  function titleBandFixed(band: string): string {
    return `- Hero title legibility comes from the IMAGE's own tonal design: ${band} must sit on a calm, low-detail region of the hero image, requested in the generation prompt. Pair the tones deliberately and state the pick in the image prompt — a calm LIGHT band takes a dark-ink title, a deep/saturated band takes a white title. Never patch legibility afterwards with plates, scrims, or overlays.`
  }

  const ANTI_HERO_PLATE =
    '- In the HERO slot: no opaque (alpha=1) plates behind the title — no scrim rectangles, no solid bands, no blurred backing cards. Title legibility comes from the image tones, never from patches.'
  const ANTI_SECTION_BLOCK =
    '- In CONTENT sections: no background blocks or card layouts that segment the shared backdrop — visual weight comes from the backdrop. A translucent (alpha < 0.5) readability aid behind dense body text is allowed where the backdrop is busy.'
  const ANTI_OPACITY_RESCUE =
    '- No rescuing an illegible title band by dialing overlay opacity — re-pair the title tone with the band, or regenerate the hero with a calmer, tone-matched title region.'

  const PHASE_25_INTRO =
    'One continuous backdrop under every section. The hero slot is part of the Phase 2 skeleton; this phase only materializes pixels:'
  const PHASE_25_STEP_1 =
    '1. (Phase 2 skeleton) Render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=750, w=canvas width — and design the hero title INSIDE it now, at its final text, size, position, and color (your lockup pick). Pixels are generated AROUND the placed title in step 2, so the title comes first — a title placed after the image is a retrofit. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.'
  /** Step 2 backbone: the call, the composite-reference contract, and the fade-zone band. Style-specific prompt guidance follows it per profile. */
  const PHASE_25_STEP_2_CORE =
    'Call `generate_image` with `width: 750, height: 850`, `id: HeroContent.id`, and `references: [{"id": HeroContent.id, "composite": true}]` — 850 = hero slot (750) + bleed (100), the holder\'s final display size (the API may 16px-align it — compose for approximately what is shown). [image 1] is the composite render of your HeroContent — it covers only the TOP 750px (the slot), so extend the scene calmly through the extra 100px of bleed below it. The reference fixes the placed title\'s position, size, and color: compose AROUND the text, keep the region under it calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white), and paint NO lettering into the image (the text is a position reference only, not content). Keep the bottom ~100px calm — it maps ≈1:1 onto the fade zone.'
  const PHASE_25_STEP_3 =
    "3. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: <design height>, hero_image_from: HeroContent.id })` — one call. The tool moves the image into the BackgroundLayer's HeroImg (extended 100px past the slot so the fade seam hides inside the next section), auto-samples the hero's bottom 100px for the overlay middle stop, leaves HeroContent transparent for the title, and fades the canvas to white at the foot."
  const PHASE_25_STEP_4 =
    "4. Verify with `look`: no visible seam around the hero bottom, no lettering baked into the hero pixels (the title lives in HeroContent text nodes, not in the image), title band legible against the image's own tones. If the band is illegible, first re-pair the tones — switch the title between dark ink and white to match the band the image actually produced; regenerate the hero (step 2) only if neither tone works — and never add plates or scrims. If the hero is regenerated later, re-call `compose_backdrop` with the same arguments — it re-samples and recolors in place."
  const PHASE_25_FOOTER =
    "Do NOT pass `hero_color` in the standard recipe — auto-sampling is the point. (`sample_hero_color` still exists for non-standard edges, e.g. a side-fade design; pass its result as `hero_color` to override.) If `compose_backdrop` returns an error, read it carefully — it usually means the hero image has not been generated yet. Do not invent geometry: the 100px overlap, bleed extension, absolute positioning, and gradient transform are all handled internally. On re-calls you may omit `canvas_height` — it then defaults to the root frame's current height, which is what you want once all sections are rendered and the root has hugged its content."

  // Methodology control group: the pre-R0 watercolor profile, verbatim flat
  // four-piece format (no Fixed/Variable/Anti-identity, no title-band
  // contract, no lockup axis). A/B against watercolor_poster_v1 validates
  // the three-section methodology itself. Do NOT "upgrade" this entry — the
  // round-trip test pins its flat format as the control condition.
  const watercolorLegacy = makeEntry(graph, profilesPage.id, 'watercolor_poster_v0')
  graph.createNode('TEXT', watercolorLegacy.id, {
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
      'One continuous backdrop under every section. The hero slot is part of the Phase 2 skeleton; this phase only materializes pixels:',
      '',
      '1. (Phase 2 skeleton) Render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=750, w=canvas width. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.',
      '2. Call `generate_image` with `width: 750, height: 850` and `id: HeroContent.id` — 850 = hero slot (750) + bleed (100), the FINAL display size of the hero image holder, so what you compose is exactly what is shown (no cover-crop). Watercolor-style prompt; leave the bottom ~100px calm — that band maps 1:1 onto the fade zone.',
      "3. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: <design height>, hero_image_from: HeroContent.id })` — one call. The tool moves the image into the BackgroundLayer's HeroImg (extended 100px past the slot so the fade seam hides inside the next section), auto-samples the hero's bottom 100px for the overlay middle stop, leaves HeroContent transparent for the title, and fades the canvas to white at the foot.",
      '4. Verify with `look`: no visible seam around the hero bottom, title area legible. If the hero is regenerated later, re-call `compose_backdrop` with the same arguments — it re-samples and recolors in place.',
      '',
      'Do NOT pass `hero_color` in the standard recipe — auto-sampling is the point. (`sample_hero_color` still exists for non-standard edges, e.g. a side-fade design; pass its result as `hero_color` to override.) If `compose_backdrop` returns an error, read it carefully — it usually means the hero image has not been generated yet. Do not invent geometry: the 100px overlap, bleed extension, absolute positioning, and gradient transform are all handled internally.',
      '',
      '## Tone',
      'Restrained, atmospheric. Short sentences. No hard-sell phrasing ("限时秒杀", "最后一天"). Decorative elements live inside generated hero images, not as separate transparent overlays stacked on top — AI-generated PNGs do not reliably produce clean alpha channels, so do not plan around transparent brush strokes, ink splashes, or floating calligraphy.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, watercolorLegacy.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  // Poster-quality experiment (docs/plans/tasks/poster-quality-experiment.md T2).
  // Style-only profile, rewritten as the R0 style-system sample (Fixed /
  // Variable / Anti-identity, per docs/research/2026-08-11-poster-quality-
  // methodology-borrow.md). The Phase 2.5 visual-environment workflow lives
  // in this markdown — agents read it directly instead of having it
  // hardcoded into marketing.md.
  const watercolor = makeEntry(graph, profilesPage.id, 'watercolor_poster_v1')
  graph.createNode('TEXT', watercolor.id, {
    fontFamily: FONT,
    text: [
      '# Watercolor poster',
      '',
      'Wash-heavy poster style for long-form images and campaign key visuals. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks.',
      '',
      '## Fixed system (never break)',
      '',
      '- One continuous backdrop under EVERY section. Per-section color blocks are a different style.',
      '- Extreme type contrast: hero title 72–110px on a 750px-wide canvas, stacked in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular. A hero headline stacks size + weight + color + shadow at the same time — single-property hierarchy is for information-dense layouts, not this style.',
      '- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen.',
      titleBandFixed('the title band of your lockup pick (below)'),
      HERO_PIXELS_FIXED,
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- hero lockup: { lower-third (default), center-left, upper-float } — where the staggered title stack sits inside the hero slot. The composite reference (step 2) shows the API exactly where the stack is; the prompt must keep THAT region calm, low-detail, and tuned to the title color.',
      "- palette: auto-sampled from the hero's bottom band by compose_backdrop — never a fixed hex.",
      '- section sequence and density: content-driven, but keep the uneven rhythm.',
      '- motif: the watercolor metaphor follows the brief (a season, a place, a mood) — one motif per design, not a collage.',
      '',
      '## Anti-identity (this style never does)',
      '',
      ANTI_HERO_PLATE,
      ANTI_SECTION_BLOCK,
      "- No single-line or centered hero title slabs — the staggered 2–3 line stack IS this style's headline.",
      '- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.',
      '- No hard-sell phrasing ("限时秒杀", "最后一天").',
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      PHASE_25_STEP_1,
      `2. Pick your hero lockup (Variable system) and place the title stack (step 1). ${PHASE_25_STEP_2_CORE} Watercolor-style prompt: soft layered washes, ONE motif, generous negative space.`,
      PHASE_25_STEP_3,
      PHASE_25_STEP_4,
      '',
      PHASE_25_FOOTER,
      '',
      '## Tone',
      'Restrained, atmospheric. Short sentences.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, watercolor.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  // R6 comparison group (docs/research/2026-08-11-poster-quality-methodology-
  // borrow.md): three profiles sharing the EXACT same Phase 2.5 backbone
  // (HeroContent → generate_image 750×850 → compose_backdrop → look) so A/B
  // results attribute to the style system, not the mechanics. editorial and
  // solid test backbone generality across visual languages; the center-left
  // variant tests whether locked Variable picks produce visibly different
  // layouts from the same system.
  //
  // PROFILE AUTHORING RULE (hard-won — see docs/plans/knowledge/error-
  // catalog.md "注入面污染"): a profile's markdown is the ONLY thing injected
  // into the agent context when the user picks it (library.ts
  // buildMarketingOverlay). It must therefore be fully SELF-CONTAINED:
  // never reference another profile ("read X first" — the reference is
  // unreachable at runtime), never mention experiment scaffolding (control
  // groups, A/B purpose, baseline labels). Experiment design lives in id
  // naming, code comments, and task docs only. generate.test.ts guards the
  // cross-reference half.
  const editorial = makeEntry(graph, profilesPage.id, 'editorial_poster_v1')
  graph.createNode('TEXT', editorial.id, {
    fontFamily: FONT,
    text: [
      '# Editorial poster',
      '',
      'Magazine-cover poster style: typography leads, the hero image is a tonal stage for the headline. Visual weight comes from extreme type scale and disciplined margins, not from decoration.',
      '',
      '## Fixed system (never break)',
      '',
      '- One continuous backdrop under EVERY section. Per-section color blocks are a different style.',
      '- Typography leads: hero title 88–128px on a 750px-wide canvas, stacked over 2–4 short lines with tight line-height (1.0–1.1). Section titles 32–40. Body 20–24, captions 16–18. Weights: hero Black, body Regular.',
      '- Disciplined margins: 56–72px side margins everywhere; exactly ONE element per section may break them.',
      '- Restrained palette: paper white + ink black + ONE accent auto-sampled from the hero image. No second accent.',
      titleBandFixed('the title band of your lockup pick (below)'),
      HERO_PIXELS_FIXED,
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- hero lockup: { upper-left stack (default), lower-third, full-bleed center } — where the stacked headline sits inside the hero slot. The generation prompt must keep THAT region calm, low-detail, and tuned to the title color.',
      '- accent usage: { headline keyword, thin rule, small block } — one accent, one role.',
      '- section sequence and density: content-driven, but keep margin discipline.',
      '- motif: the hero image follows the brief as ONE quiet scene or object with large negative space — never a busy collage.',
      '',
      '## Anti-identity (this style never does)',
      '',
      ANTI_HERO_PLATE,
      ANTI_SECTION_BLOCK,
      '- No watercolor washes, soft gradients, or grain textures in content — editorial is flat ink on paper.',
      '- No centered, symmetric compositions — editorial rhythm is asymmetric.',
      '- No decorative icons, emojis, or sticker-like elements.',
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      PHASE_25_STEP_1,
      `2. Pick your hero lockup (Variable system) and place the headline stack (step 1). ${PHASE_25_STEP_2_CORE} Prompt for a minimal editorial composition: ONE quiet subject, large calm negative space, flat light, no texture noise.`,
      PHASE_25_STEP_3,
      PHASE_25_STEP_4,
      '',
      PHASE_25_FOOTER,
      '',
      '## Tone',
      'Confident, terse, magazine-like. Headlines are short statements, not slogans.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, editorial.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  const solidGeo = makeEntry(graph, profilesPage.id, 'solid_poster_v1')
  graph.createNode('TEXT', solidGeo.id, {
    fontFamily: FONT,
    text: [
      '# Solid geometry poster',
      '',
      'Flat geometric poster style: a few solid-color shapes carry the whole composition. Visual weight comes from scale contrast between one oversized form and quiet type, not from texture or imagery.',
      '',
      '## Fixed system (never break)',
      '',
      '- One continuous backdrop under EVERY section. Per-section color blocks are a different style.',
      '- Flat color only in content: no gradients, no textures, no shadows, no photography. (The tool-made backdrop fade is the one allowed gradient.)',
      '- At most 3 colors per design: white ground, the hero-sampled theme color, ink black.',
      "- Type is quiet in this style: hero title 56–84px, section titles 32–40, body 20–24, captions 16–18 — the oversized SHAPE is the headline's counterpart, so type does not need extreme scale.",
      '- Exactly ONE oversized geometric form in the hero (circle, horizontal band, or quarter-block), occupying 30–60% of the hero area.',
      titleBandFixed('the title band of your lockup pick (below)'),
      HERO_PIXELS_FIXED,
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- hero lockup: { lower-left (default), center, upper-right } — where the title block sits inside the hero slot. The generation prompt must keep THAT region flat, calm, and tuned to the title color.',
      '- hero form: { circle, horizontal band, quarter-block } — one form, one role.',
      '- section sequence and density: content-driven; EVEN spacing is allowed in this style — flat geometry reads as designed rhythm, not as a screen.',
      '- motif: the geometric form abstracts the brief (a sun, a horizon, a gate) — one idea, not a scene.',
      '',
      '## Anti-identity (this style never does)',
      '',
      '- In the HERO slot: no opaque (alpha=1) plates behind the title — the title sits on the flat color of the image itself, never on a patch.',
      '- No gradients, textures, shadows, blurs, or photographic elements in content.',
      '- No more than 3 colors; no second accent "for balance".',
      '- No Light font weights anywhere; no body text below 20px.',
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      PHASE_25_STEP_1,
      `2. Pick your hero lockup (Variable system) and place the title (step 1). ${PHASE_25_STEP_2_CORE} Prompt for a flat vector-style composition: ONE oversized solid-color geometric form on a quiet ground, no gradients, no texture.`,
      PHASE_25_STEP_3,
      PHASE_25_STEP_4,
      '',
      PHASE_25_FOOTER,
      '',
      '## Tone',
      'Direct, clean, optimistic. Short declaratives.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, solidGeo.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  const watercolorCL = makeEntry(graph, profilesPage.id, 'watercolor_poster_v1_center_left')
  graph.createNode('TEXT', watercolorCL.id, {
    fontFamily: FONT,
    text: [
      '# Watercolor poster — center-left recipe',
      '',
      'Wash-heavy poster style for long-form images and campaign key visuals, composed on a center-left lockup: the title block sits vertically centered on the left, counterweighting ONE dominant wash mass right of center. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks.',
      '',
      '## Fixed system (never break)',
      '',
      '- One continuous backdrop under EVERY section. Per-section color blocks are a different style.',
      '- Extreme type contrast: hero title 72–110px on a 750px-wide canvas, stacked in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular. A hero headline stacks size + weight + color + shadow at the same time — single-property hierarchy is for information-dense layouts, not this style.',
      '- Deliberately uneven spacing, biased toward ONE oversized breathing gap right after the hero, before the first dense section. Constant rhythm reads as a screen.',
      titleBandFixed('the center-left title band'),
      HERO_PIXELS_FIXED,
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      "- palette: auto-sampled from the hero's bottom band by compose_backdrop — never a fixed hex.",
      '- motif: ONE dominant wash mass right of center; the title counterweights it on the left — not a symmetrical wash field. The motif itself follows the brief (a season, a place, a mood).',
      '- section sequence and density: content-driven, but keep the uneven rhythm.',
      '',
      '## Anti-identity (this style never does)',
      '',
      ANTI_HERO_PLATE,
      ANTI_SECTION_BLOCK,
      '- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.',
      '- No hard-sell phrasing ("限时秒杀", "最后一天").',
      "- No centered, symmetric hero compositions — the center-left counterweight IS this recipe's composition.",
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      PHASE_25_STEP_1,
      `2. Place the title stack on the center-left (step 1). ${PHASE_25_STEP_2_CORE} Watercolor-style prompt: ONE dominant wash mass right of center, counterweighting the placed title.`,
      PHASE_25_STEP_3,
      PHASE_25_STEP_4,
      '',
      PHASE_25_FOOTER,
      '',
      '## Tone',
      'Restrained, atmospheric. Short sentences.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, watercolorCL.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  // v2 candidate recipe (poster-quality experiment): the same watercolor style
  // as the v1 sample, plus the measured details v1 left open — quantified
  // title shadow, an eyebrow rule, a variable hero height, lockup/line-count
  // compatibility, headline copy guidance, and a final compose_backdrop
  // re-call once the design height has settled. Self-contained per the
  // authoring rule above; A/B against the v1 entry and merge the winner back.
  const watercolorV2 = makeEntry(graph, profilesPage.id, 'watercolor_poster_v2')
  graph.createNode('TEXT', watercolorV2.id, {
    fontFamily: FONT,
    text: [
      '# Watercolor poster',
      '',
      'Wash-heavy poster style for long-form images and campaign key visuals. Visual weight comes from one continuous backdrop running under every section, not from per-section color blocks.',
      '',
      '## Fixed system (never break)',
      '',
      '- One continuous backdrop under EVERY section. Per-section color blocks are a different style.',
      '- Extreme type contrast: hero title 72–110px on a 750px-wide canvas, stacked in 2–3 SHORT STAGGERED lines of 3–5 characters — left-aligned, each line offset horizontally from the one above, tight line-height (1.0–1.15) — never one centered slab filling the width. Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular.',
      '- Title shadow is a white-title privilege: only a white title on a deep/saturated band may carry one (blur 8–16, alpha ≤ 0.3, y-offset 0–4). A dark-ink title on a calm light band takes NO shadow — ink on wash reads by contrast alone.',
      '- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen.',
      titleBandFixed('the title band of your lockup pick (below)'),
      "- Hero pixels are generated at the holder's final size: 750 wide × (your hero height pick + 100px bleed). The image API may 16px-align the requested size and upscale to its pixel floor, so the calm bottom ~100px maps approximately (≈1:1) onto the fade zone — keep it calm regardless.",
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- hero lockup: { lower-third (default), center-left, upper-float } — where the staggered stack sits inside the hero slot. Line budget per lockup: lower-third and center-left take 2–3 lines; upper-float takes AT MOST 2 (a 3-line stack there crowds the top edge). The composite reference (step 2) shows the API exactly where the stack is; the prompt must keep THAT region calm, low-detail, and tuned to the title color.',
      '- hero height: { 750 (default), 600–900 } — shorter for a terse single-motif design, taller when the motif needs room. The hero image is generated at 750 × (pick + 100).',
      '- eyebrow: { none (default), one small line above the stack } — 18–24px, Regular weight, letterspaced, same ink tone as the title. An eyebrow is a caption (a date, a place, a series name), never a second headline.',
      "- palette: auto-sampled from the hero's bottom band by compose_backdrop — never a fixed hex.",
      '- section sequence and density: content-driven, but keep the uneven rhythm.',
      '- motif: the watercolor metaphor follows the brief (a season, a place, a mood) — one motif per design, not a collage.',
      '',
      '## Anti-identity (this style never does)',
      '',
      ANTI_HERO_PLATE,
      ANTI_SECTION_BLOCK,
      "- No single-line or centered hero title slabs — the staggered 2–3 line stack IS this style's headline.",
      '- No shadow on dark-ink titles, and no heavy or blurry shadow on white ones — the shadow ranges above are the whole allowance.',
      '- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.',
      '- No hard-sell phrasing ("限时秒杀", "最后一天").',
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      '1. (Phase 2 skeleton) Render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=<your hero height pick>, w=canvas width — and design the hero title INSIDE it now, at its final text, size, position, and color (your lockup pick, plus the eyebrow line if you took one). Pixels are generated AROUND the placed title in step 2, so the title comes first — a title placed after the image is a retrofit. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.',
      '2. Pick your hero lockup and height (Variable system) and place the title stack (step 1). Call `generate_image` with `width: 750`, `height: <hero height + 100>`, `id: HeroContent.id`, and `references: [{"id": HeroContent.id, "composite": true}]` — the holder\'s final display size (the API may 16px-align it — compose for approximately what is shown). [image 1] is the composite render of your HeroContent — it covers only the TOP <hero height>px (the slot), so extend the scene calmly through the extra 100px of bleed below it. The reference fixes the placed title\'s position, size, and color: compose AROUND the text, keep the region under it calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white), and paint NO lettering into the image (the text is a position reference only, not content). Keep the bottom ~100px calm — it maps ≈1:1 onto the fade zone. Watercolor-style prompt: soft layered washes, ONE motif, generous negative space.',
      PHASE_25_STEP_3,
      PHASE_25_STEP_4,
      '',
      PHASE_25_FOOTER +
        ' Re-call `compose_backdrop` once more after ALL content sections are rendered (omit `canvas_height` — it defaults to the settled root height): the root hugs its content, so the design height only settles then, and the white foot fade must land at the real canvas foot.',
      '',
      '## Tone',
      'Restrained, atmospheric. Short sentences. Headline copy prefers noun phrases and images (a season, a place, a texture) over verb-object slogans; 6–15 characters split across the 2–3 stacked lines.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, watercolorV2.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  // v3 candidate (docs/plans/tasks/pixel-first-hero-pipeline.md): pixel-first
  // pipeline — title color is no longer locked in the skeleton; a reference
  // scaffold (prepare_hero_scaffold) gives the image API the title at its true
  // coordinates, compose_backdrop adopts the scaffold as an external source,
  // and derive_palette turns the sampled band into the full color ticket
  // (title ink + section colors). First Chinese-authored profile (user
  // request, 2026-08-14). Self-contained per the authoring rule above.
  const watercolorV3 = makeEntry(graph, profilesPage.id, 'watercolor_poster_v3')
  graph.createNode('TEXT', watercolorV3.id, {
    fontFamily: FONT,
    text: [
      '# 水彩海报',
      '',
      '水彩叠染风格的长图与活动主视觉。视觉重量来自贯穿所有 section 的连续背景，而不是每个 section 各自的色块。',
      '',
      '## Fixed system（不可违反）',
      '',
      '- 所有 section 共享一个连续背景。给每个 section 各自配底色块是另一种风格。',
      '- 极端字阶对比：750px 宽画布上 hero 标题 72–110px，2–3 行短句错落排布——每行 3–5 字、左对齐、逐行水平错位、行距收紧（1.0–1.15）——绝不用居中大通栏。section 标题 36–48，正文 20–24，注释 16–18。字重：标题 Heavy/Black，正文 Regular。',
      '- 标题阴影是白字特权：只有深底/饱和底上的白字可以带阴影（blur 8–16，alpha ≤ 0.3，y 偏移 0–4）。浅底上的深墨标题不带阴影——墨压水彩靠对比本身。',
      '- 刻意不均的疏密节奏：hero → 大留白 → 密集段 → 紧凑 → 再大留白。恒定节奏读起来像界面。',
      '- 标题可读性来自图像自身的影调设计：标题带必须落在 hero 图的平静低细节区，且影调明确偏浅或偏深（在生图 prompt 里写明你选了哪一种，不要中间调）。最终标题色在 Phase 2.5 由 derive_palette 的 ink 决定——浅底配深字、深底配白字，对比度由工具校验，绝不用色块/底板/蒙层事后补救。',
      '- hero 图按参考画框的最终尺寸生成（750 × hero高度+100）。生图 API 可能按 16px 对齐尺寸，底部 ~100px 平静带与 fade 区近似对应——无论如何保持平静。',
      '',
      '## Variable system（每个设计选定并记录）',
      '',
      '- hero lockup：{ lower-third（默认）, center-left, upper-float }——错落标题组在 hero 槽位里的位置。行数预算：lower-third / center-left 可 2–3 行；upper-float 至多 2 行。参考画框（第 2 步）会把标题组的真实位置展示给生图 AI，prompt 必须让该区域保持平静低细节。',
      '- hero 高度：{ 750（默认）, 600–900 }——意象简单可取矮，意象需要空间可取高。参考画框与生成图均为 750 ×（选定值 + 100）。',
      '- 眉题（eyebrow）：{ 无（默认）, 标题组上方一行小字 }——18–24px、Regular、拉开字距、与标题同色系。眉题是注记（日期/地点/系列名），不是第二个标题。',
      '- 色彩和谐（harmony）：{ analogous, complementary, split-complementary, triadic, monochromatic }——每设计选定一种。derive_palette 用它把 hero 采样色派生成整盘色票；和谐类型即本设计的色彩风格声明。',
      '- section 顺序与密度：由内容决定，但保持不均节奏。',
      '- 意象（motif）：水彩隐喻跟随需求单（一个季节、一个地点、一种情绪）——一图一个意象，不做拼贴。',
      '',
      '## Anti-identity（本风格绝不做）',
      '',
      '- hero 槽位内：标题背后不放不透明（alpha=1）底板——不用蒙层矩形、色带、模糊背卡。标题可读性来自图像影调，不来自补丁。',
      '- 内容 section：不用底色块或卡片布局切割共享背景——视觉重量属于背景。正文密集处若背景太花，允许 alpha < 0.5 的半透明辅助。',
      '- 不用单行/居中标题通栏——错落 2–3 行才是本风格的标题。',
      '- 深墨标题不带阴影；白字阴影不超出上方范围。',
      '- 不在 hero 上叠透明装饰 PNG——AI 生图的 alpha 通道不可靠，装饰元素画进 hero 图内部。',
      '- 不用硬销话术（"限时秒杀""最后一天"）。',
      '- 不用调 overlay 透明度抢救不可读的标题带——由 derive_palette 换 ink 角色，或按更平静的标题带重生 hero。',
      '',
      '## Visual environment setup（Phase 2.5）',
      '',
      '所有 section 共享一个连续背景。hero 槽位属于 Phase 2 骨架；本阶段把像素落实，并从像素派生色彩：',
      '',
      '1.（Phase 2 骨架）渲染透明 Frame `HeroContent` 作为 root 的第一个 flow 子节点（高=你的 hero 高度选择，宽=画布宽），并在其中完成标题排版——文案、字号、位置、字重现在定；**颜色先不定**，临时用深色即可（第 5 步由色票定最终色）。所有内容 section 保持透明填充。**骨架期全部用中性灰阶**（如 #1F2937 / #374151 / #6B7280）——折扣数字、步骤编号、图标等着色元素此时一律不写彩色 hex，第 5 步色票出来后统一刷色。文本类 section 用 hug 高度、靠 padding 承载留白（写死高度必然溢出）；只有图像槽位用固定高度。',
      '2. 调用 `prepare_hero_scaffold({ root_id, hero_bleed: 100 })`——在 root 右侧生成参考画框（750 × hero高度+100，含与真实排版同位置的幽灵文字）。画框留在画布上，不要删除或移动——它是本次生成的现场记录，重生 hero 时复用。',
      '3. 调用 `generate_image`：目标 = 画框 id，`references: [{"id": 画框id, "composite": true}]`。参考图与成品同尺寸、幽灵文字在真实位置——**但生图模型不会自动理会参考图，prompt 必须显式点破它的用法，否则参考图会被忽视**。prompt 必须包含以下语义（措辞可改写，一条都不能少）：① "参考图展示了标题文字在成品画面中的确切位置和大小"；② "围绕文字构图——文字覆盖区保持平静、低细节、影调明确偏浅（或偏深，写明你选了哪种，不要中间调）"；③ "底部 ~100px 为平静淡出区"；④ "画面内不得出现任何文字——参考图中的文字仅是位置参照，不要绘制、不要模仿"。水彩风格：柔和叠染、单一意象、大量留白。',
      '4. 调用 `compose_backdrop({ root_id, canvas_width: 750, hero_image_from: 画框id })`——一次调用。画框图像被收进 BackgroundLayer 的 HeroImg（向下探出 100px，fade 接缝藏进下一个 section），槽位自动 = 画框高 − 100；工具自动采样 hero 底部 100px 作为 overlay 中间 stop，并向画布底部淡出为白。返回的 `hero_color` 即采样色。',
      '5. 调用 `derive_palette({ seed: <第 4 步返回的 hero_color>, harmony: <本设计选定的 harmony> })`——把返回色票落实：hero 标题设为 `ink.onLight`（标题带偏浅时）或 `ink.onDark`（偏深时），以 checks 中对比度过关者为准；**把骨架期的中性灰占位强调元素（折扣数字、步骤编号、图标等）统一刷成色票角色色**——正文 ink.onLight、安静的底 ground/neutrals、accent 克制使用。**配对纪律（违反即隐形字事故）**：浅色底（ground、neutrals[0]）上的文字只用 ink.onLight；深色底（wash、accent、neutrals[2]、hero 图深区）上的文字只用 ink.onDark；绝不要把 ink.onDark 放在浅底上（它与 ground 明度几乎相同），也不要把文字和它的底板刷成同一角色。合法配对以返回的 pairings 表为准，表外不自行组合。note 里的警告必须遵守。',
      '6. `look` 验收：hero 底部无可见接缝、图中无文字、标题带对影调清晰可读。hero 重生时重跑第 2→5 步（画框会刷新幽灵文字，compose 会重新采样，色票随之更新）。全部 section 渲染完成后可再调一次 `compose_backdrop`（省略 canvas_height）让底部淡出落在真实画布底。',
      '',
      '不要给标准配方传 `hero_color`——自动采样就是意义所在。不要编造几何：100px overlap、bleed 延伸、绝对定位、渐变 transform 都由工具内部处理。',
      '',
      '## Tone',
      '克制、有氛围感。短句。标题文案偏好名词性意象（一个季节、一个地点、一种质感）而非动宾口号；6–15 字拆进 2–3 行错落标题。'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, watercolorV3.id, 'applicable_to: product_long, event_poster, xiaohongshu')

  const componentsPage = makeZonePage(graph, 'Components')
  buildBrandBar(graph, componentsPage.id, logoHash)
  buildCtaBar(graph, componentsPage.id)

  const referencesPage = makeZonePage(graph, 'References')
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

  layoutLibrary(graph)

  return graph
}

/**
 * Pages don't auto-layout their children — without explicit positions every
 * entry stacks at (0,0), making the shipped .fig unreadable by hand. Run the
 * real layout engine once (hug sizes become concrete), then place each
 * page's entries SIDE BY SIDE. Pages themselves get no position: the .fig
 * format doesn't persist page coordinates and the app renders one active
 * page at a time, so a page-level offset would have no consumer.
 *
 * Entries go horizontally, not vertically: profile markdown is long, and its
 * true rendered height only exists once the app measures text with real
 * fonts — any height baked in here is an under-estimate, so in a vertical
 * stack the overflow spills onto the entry below. In a horizontal row the
 * overflow extends harmlessly downward.
 */
function layoutLibrary(graph: SceneGraph): void {
  computeAllLayouts(graph)
  for (const page of graph.getPages()) {
    let entryCursorX = 0
    for (const childId of page.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      graph.updateNode(child.id, { x: entryCursorX, y: 0 })
      entryCursorX += child.width + ENTRY_GAP
    }
  }
}

if (import.meta.main) {
  const graph = buildDefaultLibraryGraph()
  const bytes = await exportFigFile(graph)
  await writeFile(OUTPUT, bytes)
  console.log(`Wrote ${OUTPUT} (${(bytes.length / 1024).toFixed(1)} KB)`)
}
