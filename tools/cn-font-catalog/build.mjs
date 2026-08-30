/**
 * T42 S1：中文网字计划全量目录构建管线（离线跑一次，产出入仓）。
 *
 * 运行：bun tools/cn-font-catalog/build.mjs
 *
 * 流程：
 * 1. npm search API 枚举 @chinese-fonts/ 作用域包（size=250 翻页至无新增）；
 * 2. 逐包探针（并发 8）：packument 取 latest version + license 原文 →
 *    jsdelivr dist/index.json 取子族目录 → 逐目录拉 result.css，
 *    正则提取每个 @font-face 的 font-family / font-weight（区间形态 → variable）；
 *    按 font-family 聚合出族（一包可出多族）；
 * 3. 排除：FONT_REGISTRY 已收录的 6 个包（精选层不动）、探针失败包（原因记 excluded.json）、
 *    家族名与注册表/前序条目冲突者；
 * 4. 产出 packages/core/src/text/font/cn-catalog.ts（generated）+ excluded.json。
 *
 * 已知边界：npm search 只覆盖搜索可见面的包（排名遗漏不进目录）；
 * 非 ASCII 目录名 jsdelivr 全边缘节点 404（2026-08-30 实测 cdn/fastly/gcore），
 * 该类包回退 unpkg 探针（unpkg 支持非 ASCII 路径且 CORS *，实测 200）。
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_TS = join(REPO_ROOT, 'packages', 'core', 'src', 'text', 'font', 'cn-catalog.ts')
const OUT_EXCLUDED = join(REPO_ROOT, 'tools', 'cn-font-catalog', 'excluded.json')

const REGISTRY_PACKAGES = new Set([
  '@chinese-fonts/syst',
  '@chinese-fonts/lxgwwenkai',
  '@chinese-fonts/xiaolai',
  '@chinese-fonts/yozai',
  '@chinese-fonts/mksjh',
  '@chinese-fonts/hcqyt'
])
// 注册表 6 族家族名：catalog 条目与之冲突时注册表优先
const REGISTRY_FAMILIES = new Set([
  'Source Han Serif CN VF',
  'LXGW WenKai',
  'Xiaolai SC',
  'Yozai',
  'MaokenAssortedSans',
  '寒蝉全圆体'
])

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'
const NPM_PACKUMENT = 'https://registry.npmjs.org'
const JSDELIVR = 'https://cdn.jsdelivr.net/npm'
const UNPKG = 'https://unpkg.com'
const CONCURRENCY = 8
const FETCH_TIMEOUT_MS = 20000

async function fetchJSON(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function listCatalogPackages() {
  const names = new Set()
  let from = 0
  for (;;) {
    const data = await fetchJSON(`${NPM_SEARCH}?text=%40chinese-fonts&size=250&from=${from}`)
    if (!data || !Array.isArray(data.objects) || data.objects.length === 0) break
    let added = 0
    for (const object of data.objects) {
      const name = object?.package?.name
      if (typeof name === 'string' && name.startsWith('@chinese-fonts/') && !names.has(name)) {
        names.add(name)
        added++
      }
    }
    if (data.objects.length < 250 || added === 0) break
    from += 250
  }
  return [...names].sort()
}

/** 从 result.css 文本聚合 { family → { weights:Set, variable } }；无 @font-face 返回空 Map */
function parseResultCSSFamilies(css) {
  const families = new Map()
  for (const chunk of css.split('@font-face').slice(1)) {
    if (!chunk.includes('unicode-range')) continue
    const familyMatch = /font-family\s*:\s*["']([^"']+)["']/i.exec(chunk)
    if (!familyMatch) continue
    const family = familyMatch[1].trim()
    if (!family) continue
    const weightMatch = /font-weight\s*:\s*([0-9]+)(?:\s+([0-9]+))?/i.exec(chunk)
    const entry = families.get(family) ?? { weights: new Set(), variable: false }
    if (weightMatch) {
      const low = Number.parseInt(weightMatch[1], 10)
      if (weightMatch[2] !== undefined) {
        entry.variable = true
        entry.weights.add(low)
        entry.weights.add(Number.parseInt(weightMatch[2], 10))
      } else {
        entry.weights.add(low)
      }
    } else {
      entry.weights.add(400)
    }
    families.set(family, entry)
  }
  return families
}

/**
 * 逐目录探针：jsdelivr 优先，404 回退 unpkg（非 ASCII 目录名场景）。
 * 每族记录其目录实际可用的 CDN base；同族目录跨 CDN 分裂由调用方排除
 * （运行时 resolveCSSURL 只选单目录，跨 base 拼不出一致片源）。
 */
async function probeFamilyDirs(name, version, dirs) {
  const families = new Map() // family → { weights:Set, variable, bases:Set }
  const dirFailures = []
  for (const dir of dirs) {
    let css = await fetchText(
      `${JSDELIVR}/${name}@${version}/dist/${encodeURIComponent(dir)}/result.css`
    )
    let base = undefined // undefined = jsdelivr（catalog 缺省）
    if (!css) {
      css = await fetchText(
        `${UNPKG}/${name}@${version}/dist/${encodeURIComponent(dir)}/result.css`
      )
      if (css) base = UNPKG
    }
    if (!css) {
      dirFailures.push(dir)
      continue
    }
    for (const [family, info] of parseResultCSSFamilies(css)) {
      const entry = families.get(family) ?? {
        weights: new Set(),
        variable: false,
        bases: new Set()
      }
      for (const weight of info.weights) entry.weights.add(weight)
      entry.variable = entry.variable || info.variable
      entry.bases.add(base)
      families.set(family, entry)
    }
  }
  return { families, dirFailures }
}

async function probePackage(name) {
  const packument = await fetchJSON(`${NPM_PACKUMENT}/${name.replace('/', '%2f')}`)
  const version = packument?.['dist-tags']?.latest
  if (!version) return { excluded: 'packument 无 dist-tags.latest' }
  const licenseRaw = packument?.versions?.[version]?.license
  const license =
    typeof licenseRaw === 'string'
      ? licenseRaw
      : (licenseRaw?.type ?? '未标注（包内无 license 字段）')

  const dirs = await fetchJSON(`${JSDELIVR}/${name}@${version}/dist/index.json`)
  if (!Array.isArray(dirs) || dirs.length === 0 || dirs.some((d) => typeof d !== 'string')) {
    return { excluded: 'dist/index.json 不可达或非法' }
  }

  const { families, dirFailures } = await probeFamilyDirs(name, version, dirs)
  if (families.size === 0) {
    return {
      excluded:
        dirFailures.length > 0
          ? `全部子族目录 result.css 在 jsdelivr/unpkg 均不可达（${dirFailures.length}/${dirs.length} 目录 404）`
          : 'result.css 未解析出 font-family'
    }
  }
  return { version, license, families, dirFailures }
}

async function mapPool(items, worker) {
  const results = new Map()
  let cursor = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++]
        results.set(item, await worker(item))
      }
    })
  )
  return results
}

const today = new Date().toISOString().slice(0, 10)
console.log(`[cn-catalog] enumerating @chinese-fonts packages…`)
const packages = await listCatalogPackages()
console.log(`[cn-catalog] ${packages.length} packages discovered`)

const excluded = {}
const entries = []
const seenFamilies = new Set(REGISTRY_FAMILIES)
const probed = await mapPool(
  packages.filter((name) => !REGISTRY_PACKAGES.has(name)),
  probePackage
)

for (const [name, result] of [...probed.entries()].sort()) {
  if (result.excluded) {
    excluded[name] = result.excluded
    continue
  }
  for (const [family, info] of [...result.families.entries()].sort()) {
    if (seenFamilies.has(family)) {
      excluded[`${name} → ${family}`] = '家族名与注册表/前序 catalog 条目冲突（前者优先）'
      continue
    }
    if (info.bases.size > 1) {
      excluded[`${name} → ${family}`] = '子族目录跨 jsdelivr/unpkg 分裂，运行时无法取一致片源'
      continue
    }
    seenFamilies.add(family)
    const base = [...info.bases][0]
    entries.push({
      family,
      package: name,
      version: result.version,
      license: result.license,
      variable: info.variable,
      weights: [...info.weights].sort((a, b) => a - b),
      ...(base ? { base } : {})
    })
  }
  if (result.dirFailures?.length > 0) {
    excluded[`${name}（部分目录）`] =
      `${result.dirFailures.length} 个目录 result.css 404：${result.dirFailures.join(', ')}`
  }
}

entries.sort((a, b) => a.family.localeCompare(b.family))

const ts = `/**
 * GENERATED by tools/cn-font-catalog/build.mjs — 请勿手改，重跑管线更新。
 * 构建日期：${today} | 目录规模：${packages.length} 包探针 → ${entries.length} 族收录 / ${Object.keys(excluded).length} 条排除
 *
 * T42 S1：中文网字计划全量目录（registry 精选 6 族之外的 @chinese-fonts/* 包）。
 * catalog 族白名单语义 = 默认停用（opt-in，D-c）；授权以包内 license 原文为准，未审计（D-d）。
 */

export interface CnFontCatalogEntry {
  family: string
  package: string
  /** 构建时实解版本（钉扎可重现 + piece 缓存键稳定，D-g） */
  version: string
  /** npm 包内 license 字段原文（未审计，展示用） */
  license: string
  variable: boolean
  /** result.css 实见字重（静态档集合；VF 为区间端点） */
  weights: number[]
  /** 非 ASCII 目录名包的回退 CDN base（缺省 = jsdelivr）；运行时透传 descriptor.baseURL */
  base?: string
}

export const CN_FONT_CATALOG: CnFontCatalogEntry[] = ${JSON.stringify(entries, null, 2)}

const catalogByFamily = new Map(CN_FONT_CATALOG.map((entry) => [entry.family, entry]))

export function cnCatalogEntry(family: string): CnFontCatalogEntry | undefined {
  return catalogByFamily.get(family)
}

export function isCnCatalogFamily(family: string): boolean {
  return catalogByFamily.has(family)
}
`

writeFileSync(OUT_TS, ts)
writeFileSync(OUT_EXCLUDED, JSON.stringify(excluded, null, 2) + '\n')
console.log(`[cn-catalog] ${entries.length} families → ${OUT_TS}`)
console.log(`[cn-catalog] ${Object.keys(excluded).length} exclusions → ${OUT_EXCLUDED}`)
