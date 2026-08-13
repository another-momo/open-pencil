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
    return `- Hero title legibility comes from the IMAGE's own tonal design: ${band} must sit on a calm, low-detail region of the hero image, requested in the generation prompt. Pair the tones deliberately and state the pick in the image prompt — a calm LIGHT band takes a dark-ink title, a deep/saturated band takes a white title. Never patch legibility afterwards.`
  }

  const ANTI_HERO_PLATE =
    '- In the HERO slot: no opaque (alpha=1) plates behind the title — no scrim rectangles, no solid bands, no blurred backing cards. Title legibility comes from the image tones, never from patches.'
  const ANTI_SECTION_BLOCK =
    '- In CONTENT sections: no background blocks or card layouts that segment the shared backdrop — visual weight comes from the backdrop. A translucent (alpha < 0.5) readability aid behind dense body text is allowed where the backdrop is busy.'
  const ANTI_OPACITY_RESCUE =
    '- No rescuing an illegible title band by dialing overlay opacity — regenerate the hero with a calmer, tone-matched title region instead.'

  const PHASE_25_INTRO =
    'One continuous backdrop under every section. The hero slot is part of the Phase 2 skeleton; this phase only materializes pixels:'
  const PHASE_25_STEP_1 =
    '1. (Phase 2 skeleton) Render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=750, w=canvas width. All content sections have transparent fills — visual weight comes from the shared backdrop, not per-section color blocks.'
  const PHASE_25_STEP_3 =
    "3. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: <design height>, hero_image_from: HeroContent.id })` — one call. The tool moves the image into the BackgroundLayer's HeroImg (extended 100px past the slot so the fade seam hides inside the next section), auto-samples the hero's bottom 100px for the overlay middle stop, leaves HeroContent transparent for the title, and fades the canvas to white at the foot."
  const PHASE_25_STEP_4 =
    "4. Verify with `look`: no visible seam around the hero bottom, title band legible against the image's own tones. If the title band is illegible, regenerate the hero (step 2) with the band tuned to your title color — do NOT add plates or scrims. If the hero is regenerated later, re-call `compose_backdrop` with the same arguments — it re-samples and recolors in place."
  const PHASE_25_FOOTER =
    'Do NOT pass `hero_color` in the standard recipe — auto-sampling is the point. (`sample_hero_color` still exists for non-standard edges, e.g. a side-fade design; pass its result as `hero_color` to override.) If `compose_backdrop` returns an error, read it carefully — it usually means the hero image has not been generated yet. Do not invent geometry: the 100px overlap, bleed extension, absolute positioning, and gradient transform are all handled internally.'

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
      '- Extreme type contrast: hero title 72–110px on a 750px-wide canvas (a 6–8 character title fills a line). Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular. A hero headline stacks size + weight + color + shadow at the same time — single-property hierarchy is for information-dense layouts, not this style.',
      '- Deliberately uneven spacing: hero segment → large breathing space → information-dense segment → tight space → breathing space again. Constant rhythm reads as a screen.',
      titleBandFixed('the title band of your lockup pick (below)'),
      HERO_PIXELS_FIXED,
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- hero lockup: { lower-third (default), center-left, upper-float } — where the title block sits inside the hero slot. The generation prompt must keep THAT region calm, low-detail, and tuned to the title color.',
      "- palette: auto-sampled from the hero's bottom band by compose_backdrop — never a fixed hex.",
      '- section sequence and density: content-driven, but keep the uneven rhythm.',
      '- motif: the watercolor metaphor follows the brief (a season, a place, a mood) — one motif per design, not a collage.',
      '',
      '## Anti-identity (this style never does)',
      '',
      ANTI_HERO_PLATE,
      ANTI_SECTION_BLOCK,
      '- No transparent decorative PNG overlays stacked on the hero — AI-generated PNGs do not reliably produce clean alpha channels; decorative elements live INSIDE the generated hero image.',
      '- No hard-sell phrasing ("限时秒杀", "最后一天").',
      ANTI_OPACITY_RESCUE,
      '',
      '## Visual environment setup (Phase 2.5)',
      PHASE_25_INTRO,
      '',
      PHASE_25_STEP_1,
      "2. Pick your hero lockup (Variable system). Call `generate_image` with `width: 750, height: 850` and `id: HeroContent.id` — 850 = hero slot (750) + bleed (100), the holder's final display size (the API may 16px-align it — compose for approximately what is shown). Watercolor-style prompt; keep the bottom ~100px calm (≈1:1 onto the fade zone) AND keep the title-band region of your lockup pick calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white) — that is where the headline sits.",
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
      "2. Pick your hero lockup (Variable system). Call `generate_image` with `width: 750, height: 850` and `id: HeroContent.id` — 850 = hero slot (750) + bleed (100), the holder's final display size (the API may 16px-align it — compose for approximately what is shown). Prompt for a minimal editorial composition: ONE quiet subject, large calm negative space in your lockup region tuned to the title color (light band for dark ink, deep band for white), flat light, no texture noise; keep the bottom ~100px calm (≈1:1 onto the fade zone).",
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
      "2. Pick your hero lockup (Variable system). Call `generate_image` with `width: 750, height: 850` and `id: HeroContent.id` — 850 = hero slot (750) + bleed (100), the holder's final display size (the API may 16px-align it — compose for approximately what is shown). Prompt for a flat vector-style composition: ONE oversized solid-color geometric form on a quiet ground, a large flat calm region for your lockup pick tuned to the title color (light band for dark ink, deep band for white), no gradients, no texture; keep the bottom ~100px calm (≈1:1 onto the fade zone).",
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
      '- Extreme type contrast: hero title 72–110px on a 750px-wide canvas (a 6–8 character title fills a line). Section titles 36–48. Body 20–24, captions 16–18. Weights: Hero Heavy or Black, body Regular. A hero headline stacks size + weight + color + shadow at the same time — single-property hierarchy is for information-dense layouts, not this style.',
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
      "2. Call `generate_image` with `width: 750, height: 850` and `id: HeroContent.id` — 850 = hero slot (750) + bleed (100), the holder's final display size (the API may 16px-align it — compose for approximately what is shown). Watercolor-style prompt with ONE dominant wash mass right of center; keep the center-left region calm, low-detail, and tuned to the title color (light band for dark ink, deep band for white) — that is where the headline sits — AND keep the bottom ~100px calm (≈1:1 onto the fade zone).",
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

  // First profile wired to the decoration pipeline (distillation-map §11/§12):
  // scene backdrop + white content island + cutout sticker accents. The
  // 促销/活动 category is the launch wedge — this is its R0 sample.
  const promo = makeEntry(graph, profilesPage.id, 'promo_event_v1')
  graph.createNode('TEXT', promo.id, {
    fontFamily: FONT,
    text: [
      '# Promo event poster',
      '',
      'High-energy promotional long image for campaigns and events. A full illustrated scene sets the mood on top; a white rounded content island carries the sections; marker-stroke bands and sticker accents supply the festive texture. Visual weight comes from the scene, the huge display title, and textured accents — never from flat UI blocks.',
      '',
      '## Fixed system (never break)',
      '',
      "- Full-scene illustrated backdrop via the shared backdrop flow (compose_backdrop); sections below the hero live on the illustrated backdrop — never on a single white card spanning the whole design. With 2–3 sections, group them on ONE white rounded content island (corner 24–32px, padding 32–40px) but never bare: each section inside the island is a `RECTANGLE` info block (`cornerRadius` 12–16px, `fills` at 6–10% alpha of the design's accent color, accent chosen from the hero scene). With 4+ sections, skip the white island entirely and let each section be its own mini-island RoundedRectangle on the illustrated backdrop. Section-to-section dividers are 2–4px solid lines at 30% alpha of accent color — NOT cutout assets (cutout is for decoration, not structure).",
      '- Display type leads: hero title 88–128px Alibaba PuHuiTi Heavy/Black, white with dark outline + soft shadow, stacked in 2–3 STAGGERED lines (not centered slabs). Section titles 40–56 heavy. Body 20–24.',
      "- Section titles sit on a marker-brush stroke band from the decoration sheet. Stacking recipe: render the section-title Frame with ONLY the Text child (flex col, justify center); then `reparent_node` the band asset into that frame, `set_layout_child` it to absolute (centered), and keep it as the FIRST child so the text paints on top; size the band by width = title width + ~48px padding and let height follow the asset's native aspect — never stretch it, never a clean rectangle. A clean rounded rect behind a title reads as UI, not promo.",
      '- Key numbers lead: quotas, dates, amounts in accent red, bold, 1.5–2× body size, inline with the text ("前 100 名", "减 50").',
      '- Decoration assets come from the green-screen sheet + cutout pipeline (Phase 2.5). Never request transparent PNGs directly, and never put text inside generated images.',
      '- QR codes, logos, and real product packaging come from user materials — never generate them.',
      '',
      '## Variable system (choose per design; record your picks)',
      '',
      '- scene theme: follows the event (beach / snow / city night / festival market…) — one coherent scene, calm behind the content island.',
      '- accent palette: sampled from the hero scene + one high-saturation accent (red/orange) for numbers and tags.',
      '- sticker vocabulary: pick the sheet contents per event (burst badges / arrows / sparkles / tape labels…), one sheet per design.',
      '- urgency device: { countdown badge, limited-quota tag, deadline tag } — allowed in this style (banned in calmer styles); at most ONE per design.',
      '',
      '## Anti-identity (this style never does)',
      '',
      '- No clean rectangle title bands or default-looking rounded-rect badges — texture or nothing.',
      '- No flat solid section color blocks: the island is white, accents are texture/stickers.',
      '- No text inside generated images (garbled text is the rule, not the exception).',
      '- No AI-generated QR codes, logos, or real product photos.',
      '- No more than 2 sticker types per section, no more than 3 sticker accents per screen — festive, not cluttered.',
      '- No muted minimalism: if the design reads as restrained editorial, it is off-style.',
      '',
      '## Visual environment setup (Phase 2.5)',
      'The hero slot is part of the Phase 2 skeleton; this phase materializes pixels and decoration assets IN ORDER — hero first, then the backdrop, then the decoration assets, then look:',
      '',
      '1. (Phase 2 skeleton) Decide the hero TITLE copy FIRST from the user brief (never TBD, never auto-generated filler) — split it into 2–3 staggered lines per Fixed system. Then render a transparent Frame named `HeroContent` as the first flow child of the root frame, h=750, w=canvas width, and place the staggered hero TITLE text inside it NOW — never in Phase 3: the title must exist before any image is generated so the scene is composed around it. At the same time, write the decoration plan into the skeleton: which sections get a stroke-band title, which accent stickers, and where they go — the sheet in step 4 serves THIS plan. Content sections live on the white content island (rounded 24–32px card) or transparent frames — no per-section color blocks.',
      "2. Generate the hero SCENE with `generate_image` (`width: 750, height: 850`, `id: HeroContent.id`): one coherent promotional scene matching the event theme, bottom ~100px calm (≈1:1 onto the fade zone), and the title band kept calm — the title is already in HeroContent from step 1, so compose AROUND it (name its position in the prompt, e.g. 'keep the lower third calm and low-detail for the title').",
      '3. Call `compose_backdrop({ root_id, canvas_width: 750, canvas_height: <design height>, hero_image_from: HeroContent.id })` — one call: the scene moves into the BackgroundLayer, the bottom band is auto-sampled for the overlay, HeroContent stays transparent for the title.',
      '4. Generate the DECORATION SHEET planned in step 1, with the hero as `references` (the hero is the style anchor for every decoration): one green-screen image (solid #00FF00 background, no shadows, hard edges, 3x3 grid, no text) containing exactly the pieces the plan calls for — e.g. marker-brush stroke banners for the planned section titles, starburst badge, arrow, tape label, sparkle. Then `cutout({ id: <sheet node>, expected: <number of pieces on the sheet> })` — assets come back in reading order with native sizes.',
      '5. Verify with `look`: scene mood correct, no visible seam around the hero bottom, cutout assets look right. If one sticker is wrong, regenerate just the sheet, not the scene.',
      '',
      "Do NOT pass `hero_color` — auto-sampling is the point. Decoration assets are PLACED during Phase 3 section fill, only into whitelisted slots (section-title bands, accent corners, promo tags) — never left parked next to the sheet. If an asset's proportions are wrong for its slot (e.g. the stroke band too square), regenerate that single element with the cutout asset as `references` at the slot's size — never stretch assets.",
      '',
      '## Tone',
      'Loud, generous, festive. Short punchy lines; numbers do the talking.'
    ].join('\n'),
    fontSize: 12,
    width: MARKDOWN_WRAP_WIDTH,
    fills: solid(DARK),
    textAutoResize: 'HEIGHT'
  })
  kv(graph, promo.id, 'applicable_to: product_long, event_poster')

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
