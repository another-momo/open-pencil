/**
 * Locate and load the shipped default brand config.
 *
 * Three resolution strategies, in order:
 *   1. Bun build-time embedded asset (production) — looked up via
 *      `import.meta.resolve('./default-brand-config.js')` once that's wired
 *      up in C11; for now this path is a stub returning the literal YAML.
 *   2. Filesystem `public/default-brand/config.yaml` (dev) — the Vite dev
 *      server ships the file under the public dir; agent looks it up at
 *      `<cwd>/public/default-brand/config.yaml`.
 *   3. Hardcoded fallback (Path B web preview with no agent) — embedded
 *      literal YAML used when neither 1 nor 2 resolves.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { parseBrandYaml, type BrandConfig } from './index.js'

const FALLBACK_YAML = `schema_version: 1
name: 默认品牌库
types:
  - id: wechat_moments
    label: 朋友圈广告
    size: 1080x1080
    description: 微信朋友圈信息流广告
  - id: wechat_article_cover
    label: 公众号封面
    size: 900x500
    description: 公众号文章首图
  - id: xiaohongshu
    label: 小红书图
    size: 1080x1440
    description: 小红书图文
  - id: ecommerce_detail
    label: 电商详情页
    size: 750x
    description: 淘宝/京东详情长图
  - id: event_poster
    label: 活动海报
    size: 1080x1920
    description: 线下活动主视觉海报
  - id: dsp_banner
    label: DSP 广告
    size: 300x250
    description: IAB 标准中矩形
  - id: product_long
    label: 产品长图
    size: 750x
    description: 通用产品长图
profiles:
  - id: casual_v1
    label: 休闲活泼
    applicable_to: [wechat_moments, xiaohongshu, dsp_banner]
    markdown: |
      # 休闲活泼风格
      - 配色：主色 #FF6B35，配白色与深灰，整体明快
      - 字体：Alibaba PuHuiTi；标题加粗，正文 Regular
      - 语气：年轻、直接、促销感；多用短句和行动词
      - 版式：留白充足，卖点用图标 + 短文案成组出现
  - id: watercolor_poster_v0
    label: 水彩海报 v0 (冻结基线)
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Watercolor poster v0 — frozen baseline
  - id: watercolor_poster_v1
    label: 水彩海报 v1
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Watercolor poster v1
  - id: editorial_poster_v1
    label: 杂志封面海报
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Editorial poster
  - id: solid_poster_v1
    label: 扁平几何海报
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Solid geometry poster
  - id: watercolor_poster_v1_center_left
    label: 水彩海报 v1 (center-left)
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Watercolor poster — center-left
  - id: watercolor_poster_v2
    label: 水彩海报 v2
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # Watercolor poster v2
  - id: watercolor_poster_v3
    label: 水彩海报 v3
    applicable_to: [product_long, event_poster, xiaohongshu]
    markdown: |
      # 水彩海报 v3
`

export function loadDefaultBrandConfig(): BrandConfig {
  const candidates = [
    join(process.cwd(), 'public/default-brand/config.yaml'),
    join(import.meta.dir, '..', '..', '..', 'public/default-brand/config.yaml'),
    // bun --watch runs from repo root; try relative to the agent package
    join(import.meta.dir, '..', '..', '..', '..', 'public/default-brand/config.yaml')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const source = readFileSync(candidate, 'utf8')
      const parsed = parseBrandYaml(source)
      if (parsed.ok) return parsed.config
    }
  }
  const parsed = parseBrandYaml(FALLBACK_YAML)
  if (!parsed.ok) throw new Error(`fallback brand config invalid: ${JSON.stringify(parsed.issues)}`)
  return parsed.config
}

/** Resolve the brand config DB path for the current user. */
export function defaultBrandDbPath(): string {
  const override = process.env.OPENPENCIL_BRAND_DB?.trim()
  if (override) return override
  // When the agent is started without a writable home (tests, ephemeral
  // CI), fall back to an in-memory database so the first request after
  // restart does not crash on SQLite open. Production environments always
  // have $HOME / $USERPROFILE.
  if (process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test') {
    return ':memory:'
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? process.cwd()
  return join(home, '.openpencil', 'brand.db')
}