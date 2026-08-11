import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { exportFigFile } from '@open-pencil/core/io'
import { loadLibrary } from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'

import { buildDefaultLibraryGraph } from '../src/generate'

const here = dirname(fileURLToPath(import.meta.url))
const SHIPPED = join(here, '..', '..', '..', 'public', 'default-library.fig')

describe('default-library.fig round-trip', () => {
  test('exports four named pages, one per zone', () => {
    const graph = buildDefaultLibraryGraph()
    const pages = graph
      .getPages()
      .map((page) => page.name)
      .sort()
    expect(pages).toEqual(['Components', 'Profiles', 'References', 'Types'])
  })

  test('exported .fig re-parses into the expected LibraryIndex', async () => {
    const graph = buildDefaultLibraryGraph()
    const bytes = await exportFigFile(graph)
    const { index } = await loadLibrary(bytes, 'default-library.fig')

    expect(index.warnings).toEqual([])

    expect(index.types.map((type) => type.id)).toEqual([
      'wechat_moments',
      'wechat_article_cover',
      'xiaohongshu',
      'ecommerce_detail',
      'event_poster',
      'dsp_banner',
      'product_long'
    ])
    const productLong = expectDefined(index.types.find((type) => type.id === 'product_long'))
    expect(productLong.size).toEqual({ width: 750, height: null })
    // Anchors were removed from the shipped library (the mechanism is being
    // redesigned) — no material type declares any.
    for (const type of index.types) {
      expect(type.anchors).toEqual([])
    }

    expect(index.profiles.map((profile) => profile.id)).toEqual([
      'casual_v1',
      'watercolor_poster_v0',
      'watercolor_poster_v1',
      'editorial_poster_v1',
      'solid_poster_v1',
      'watercolor_poster_v1_center_left'
    ])
    expect(index.profiles[0].label).toBe('休闲活泼风格')
    expect(index.profiles[0].description).toContain('配色')
    expect(index.profiles[0].markdown).toContain('休闲活泼风格')
    expect(index.profiles[0].applicableTo).toContain('xiaohongshu')

    const poster = expectDefined(
      index.profiles.find((profile) => profile.id === 'watercolor_poster_v1')
    )
    expect(poster.label).toBe('Watercolor poster')
    expect(poster.applicableTo).toEqual(['product_long', 'event_poster', 'xiaohongshu'])
    // The profile carries an extreme-contrast type scale and a backdrop recipe
    // that depends on sample_hero_color — if these specifics stop surviving the
    // .fig round-trip the experiment silently degrades to a UI-scale design.
    expect(poster.markdown).toContain('sample_hero_color')
    expect(poster.markdown).toContain('72–110px')
    // The profile delegates backdrop construction to compose_backdrop.
    // If this stops surviving the .fig round-trip the agent loses the
    // pointer to the tool.
    expect(poster.markdown).toContain('compose_backdrop')
    expect(poster.markdown).toContain('Visual environment setup (Phase 2.5)')
    // R0 style-system skeleton (docs/research/2026-08-11-poster-quality-
    // methodology-borrow.md): Fixed / Variable / Anti-identity三段是 profile
    // 契约,丢失即退回"一段 markdown 注释"的旧形态。
    expect(poster.markdown).toContain('## Fixed system')
    expect(poster.markdown).toContain('## Variable system')
    expect(poster.markdown).toContain('## Anti-identity')
    // 2026-08-11 冒烟修复钉扎:标题带影调配对规则(白字×浅底 1.1:1 事故)+
    // Anti-identity 作用域(hero 槽 vs 正文区,正文允许半透明可读性辅助)
    expect(poster.markdown).toContain('dark-ink title')
    expect(poster.markdown).toContain('In the HERO slot')
    expect(poster.markdown).toContain('In CONTENT sections')

    // R6 对照组:editorial / solid 共享同一 Phase 2.5 骨架但视觉语言不同;
    // center_left 是 watercolor 的锁定配方变体(三段体系自包含——profile
    // 是唯一注入 agent 的内容,跨 profile 引用在运行时不可达,见文末
    // "profiles never cross-reference" 守卫)。三者丢失即对照实验静默缩水。
    const editorial = expectDefined(
      index.profiles.find((profile) => profile.id === 'editorial_poster_v1')
    )
    expect(editorial.markdown).toContain('## Fixed system')
    expect(editorial.markdown).toContain('## Anti-identity')
    expect(editorial.markdown).toContain('compose_backdrop')
    expect(editorial.markdown).toContain('88–128px')
    const solidGeo = expectDefined(
      index.profiles.find((profile) => profile.id === 'solid_poster_v1')
    )
    expect(solidGeo.markdown).toContain('## Fixed system')
    expect(solidGeo.markdown).toContain('## Anti-identity')
    expect(solidGeo.markdown).toContain('compose_backdrop')
    expect(solidGeo.markdown).toContain('56–84px')
    const variant = expectDefined(
      index.profiles.find((profile) => profile.id === 'watercolor_poster_v1_center_left')
    )
    // 自包含的锁定配方:三段体系 + Phase 2.5 骨架 + 锁定 pick 全部在正文内
    expect(variant.markdown).toContain('## Fixed system')
    expect(variant.markdown).toContain('## Anti-identity')
    expect(variant.markdown).toContain('compose_backdrop')
    expect(variant.markdown).toContain('center-left')

    // 方法论对照组:v0 是 R0 重写前的扁平格式基线。反向断言是实验设计的
    // 一部分——它若被"升级"成三段体系,同风格 A/B 对照即静默失效。
    const legacy = expectDefined(
      index.profiles.find((profile) => profile.id === 'watercolor_poster_v0')
    )
    expect(legacy.markdown).toContain('## Type scale')
    expect(legacy.markdown).toContain('compose_backdrop')
    expect(legacy.markdown).not.toContain('## Fixed system')
    expect(legacy.markdown).not.toContain('## Anti-identity')
    // 冻结保护延伸:2026-08-11 的配对规则/作用域改造同样不得渗入对照组
    expect(legacy.markdown).not.toContain('dark-ink title')
    expect(legacy.markdown).not.toContain('In the HERO slot')

    expect(index.components.map((component) => component.name)).toEqual(['BrandBar', 'CTABar'])
    const brandBar = expectDefined(
      index.components.find((component) => component.name === 'BrandBar')
    )
    expect(brandBar.readonlyNames).toEqual(['logo', 'brandName'])
    const ctaBar = expectDefined(index.components.find((component) => component.name === 'CTABar'))
    expect(ctaBar.readonlyNames).toEqual(['qrCode'])

    expect(index.references.map((reference) => reference.id)).toEqual(['ref-product-long-001'])
    expect(index.references[0].applicableTo).toEqual(['product_long'])
    expect(index.references[0].tags).toEqual(['luxury_v1'])
  })

  test('the SHIPPED default-library.fig parses healthy (not just a fresh build)', async () => {
    // The round-trip tests above guard a freshly exported graph; the shipped
    // artifact itself can silently drift from the generator (bytes are
    // non-deterministic, so this compares CONTENT, not bytes — node ids may
    // differ). If someone forgets `bun run generate` after editing profiles,
    // this is the test that catches it.
    const shipped = readFileSync(SHIPPED)
    const { index } = await loadLibrary(shipped, 'default-library.fig')
    expect(index.warnings).toEqual([])
    expect(index.profiles.map((profile) => profile.id)).toEqual([
      'casual_v1',
      'watercolor_poster_v0',
      'watercolor_poster_v1',
      'editorial_poster_v1',
      'solid_poster_v1',
      'watercolor_poster_v1_center_left'
    ])
    // Content-level sync with the generator: every shipped profile markdown
    // must equal the freshly generated one.
    const freshBytes = await exportFigFile(buildDefaultLibraryGraph())
    const fresh = (await loadLibrary(freshBytes, 'fresh.fig')).index
    for (const shippedProfile of index.profiles) {
      const freshProfile = fresh.profiles.find((p) => p.id === shippedProfile.id)
      expect(
        freshProfile,
        `profile "${shippedProfile.id}" missing from a fresh build`
      ).toBeDefined()
      expect(
        shippedProfile.markdown,
        `shipped .fig is stale for profile "${shippedProfile.id}" — run bun run generate`
      ).toBe(freshProfile?.markdown)
    }
  })

  test('profiles never cross-reference each other (self-containment guard)', async () => {
    // A profile's markdown is the ONLY thing injected into the agent context
    // when picked (buildMarketingOverlay injects exactly one profile, the
    // catalog is withheld). Referencing another profile ("read X first") is
    // unreachable at runtime — the agent sees the pointer but can never
    // resolve it, so the referenced rules silently stop existing. This is
    // the third instance of 注入面污染 (see error-catalog); guard it in code.
    // Ids match on word boundaries so `watercolor_poster_v1` does not
    // false-positive on `watercolor_poster_v1_center_left`.
    const graph = buildDefaultLibraryGraph()
    const bytes = await exportFigFile(graph)
    const { index } = await loadLibrary(bytes, 'default-library.fig')

    const violations: string[] = []
    for (const profile of index.profiles) {
      for (const other of index.profiles) {
        if (other.id === profile.id) continue
        const ref = new RegExp(`(?<![A-Za-z0-9_])${other.id}(?![A-Za-z0-9_])`)
        if (ref.test(profile.markdown)) {
          violations.push(`profile "${profile.id}" references "${other.id}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  test('library components survive the round-trip as COMPONENT nodes with image bytes', async () => {
    const graph = buildDefaultLibraryGraph()
    const bytes = await exportFigFile(graph)
    const { graph: parsed, index } = await loadLibrary(bytes, 'default-library.fig')

    const brandBar = expectDefined(
      index.components.find((component) => component.name === 'BrandBar')
    )
    const node = expectDefined(parsed.getNode(brandBar.nodeId))
    expect(node.type).toBe('COMPONENT')

    const logo = node.childIds
      .map((id) => parsed.getNode(id))
      .find((child) => child?.name === 'logo')
    const imageFill = logo?.fills.find((fill) => fill.type === 'IMAGE')
    expect(imageFill && 'imageHash' in imageFill ? imageFill.imageHash : undefined).toBeDefined()
    const hash = imageFill && 'imageHash' in imageFill ? imageFill.imageHash : undefined
    expect(hash && parsed.images.get(hash)).toBeDefined()

    // All library text uses Alibaba PuHuiTi
    const brandName = node.childIds
      .map((id) => parsed.getNode(id))
      .find((child) => child?.name === 'brandName')
    expect(brandName?.fontFamily).toBe('Alibaba PuHuiTi')
  })

  test('entries are laid out for human inspection (no overlap within a page)', () => {
    // Pages don't auto-layout their children — the generator must assign
    // explicit positions or every entry stacks at (0,0). Entries go
    // horizontally: long profile markdown overflows its baked-in entry
    // height (real text metrics only exist in-app), and a vertical stack
    // would spill each entry onto the one below. Pages themselves need no
    // position: .fig doesn't persist page coordinates and the app renders
    // one active page at a time.
    const graph = buildDefaultLibraryGraph()
    const pages = graph.getPages()
    expect(pages.length).toBe(4)

    for (const page of pages) {
      let cursorRight = 0
      for (const childId of page.childIds) {
        const child = expectDefined(graph.getNode(childId), `child ${childId}`)
        expect(child.y).toBe(0)
        expect(child.x).toBeGreaterThanOrEqual(cursorRight)
        cursorRight = child.x + child.width
        expect(child.width).toBeGreaterThan(0)
      }
    }

    // Long profile markdown wraps instead of running thousands of px wide.
    const profilesPage = expectDefined(
      pages.find((page) => page.name === 'Profiles'),
      'profiles page'
    )
    for (const childId of profilesPage.childIds) {
      const entry = expectDefined(graph.getNode(childId), 'profile entry')
      for (const textId of entry.childIds) {
        const text = expectDefined(graph.getNode(textId), 'profile text')
        expect(text.width).toBeLessThanOrEqual(600)
      }
    }
  })
})
