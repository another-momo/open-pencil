/**
 * T43 studio 机制——frontmatter 切分与正文小节索引。
 *
 * 不引 gray-matter：手写 `---` 块切分 + yaml 包 parse（根依赖 ^2.9.0，零新增依赖）。
 * 切分/解析失败不抛出——返回 error 判别联合，由 registry 记入 failures（S2 §8：
 * 单文件失败不影响其余文件）。
 */

import { parse as parseYaml } from 'yaml'

export type ParsedAsset =
  | {
      ok: true
      frontmatter: Record<string, unknown>
      body: string
      sections: Record<string, string>
    }
  | { ok: false; reason: string; hint: string }

const ASSET_ID_RE = /^[a-z0-9]+([_-][a-z0-9]+)*$/

/** 机读 id 校验：小写字母/数字起头，连字符/下划线分段（S2 示例实为 snake_case 与 kebab 混用） */
export function isAssetId(id: string): boolean {
  return ASSET_ID_RE.test(id)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 切分 frontmatter 与正文。文件首行必须是 `---`，其后到下一个独占行 `---` 为
 * YAML frontmatter（必须解析为 map），再往后为 markdown 正文。
 */
export function splitFrontmatter(raw: string): ParsedAsset {
  const normalized = raw.replace(/^﻿/, '')
  const lines = normalized.split('\n')
  if (lines[0]?.trim() !== '---') {
    return {
      ok: false,
      reason: '缺 frontmatter：文件首行不是 `---`',
      hint: '在文件顶部加 `---` 包裹的 YAML frontmatter（至少含 id 与 label），再写正文'
    }
  }
  let closeIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIndex = i
      break
    }
  }
  if (closeIndex === -1) {
    return {
      ok: false,
      reason: 'frontmatter 未闭合：找不到第二个独占行 `---`',
      hint: '检查 frontmatter 块是否以独占一行 `---` 结束'
    }
  }
  const yamlText = lines.slice(1, closeIndex).join('\n')
  let doc: unknown
  try {
    doc = parseYaml(yamlText)
  } catch (e) {
    return {
      ok: false,
      reason: `frontmatter YAML 语法错误：${e instanceof Error ? e.message.split('\n')[0] : String(e)}`,
      hint: '用 YAML 校验器检查 frontmatter 块（常见坑：冒号后缺空格、未转义的引号）'
    }
  }
  if (!isRecord(doc)) {
    return {
      ok: false,
      reason: 'frontmatter 不是键值 map',
      hint: 'frontmatter 必须是 `key: value` 形式的 YAML map'
    }
  }
  const body = lines.slice(closeIndex + 1).join('\n')
  return { ok: true, frontmatter: doc, body, sections: indexSections(body) }
}

/**
 * 正文小节索引：`## X`（二级）与 `### X`（三级）标题均入索引；节内容 = 标题行
 * 之后到下一个任意级标题之间的文本（trim 后）。profile 的 `##` 功能节与
 * workflow 正文小节共用本索引（types.ts 头部口径）。
 */
export function indexSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const headingRe = /^#{2,3}\s+(.+?)\s*$/
  let current: string | null = null
  let buffer: string[] = []
  const flush = () => {
    if (current !== null && !(current in sections)) sections[current] = buffer.join('\n').trim()
  }
  for (const line of body.split('\n')) {
    const m = line.match(headingRe)
    if (m) {
      flush()
      current = m[1]
      buffer = []
    } else if (current !== null) {
      buffer.push(line)
    }
  }
  flush()
  return sections
}
