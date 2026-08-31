/**
 * T44 C2 保真核验：config.yaml 三 profile 正文 vs 迁移后 profiles/*.md。
 * 逐节对照（节名归一映射后），Recipe 节对 editorial/solid 期望 no-op 显式空节。
 *
 * 源读取（T48 修复）：brand/ 目录已被 T45 删除（brand 链退役），原
 * `readFileSync('src/app/ai/pi-backend/brand/config.yaml')` 必崩（ENOENT，2026-08-31
 * 实测）。改为 git 钉扎源 `git show 4ce51816:…`（commit 钉扎防分支漂移；
 * blob ec9b22a3 与 rebuild/pi 同值，2026-08-31 `git rev-parse` 双 ref 实测）。
 *
 * 用法：node tools/rebuild/verify-t44-migration-fidelity.mjs（cwd = 仓库根）
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { parse } from 'yaml'

const RENAME = new Map([
  ['Fixed system（不可违反）', 'Fixed system'],
  ['Fixed system (never break)', 'Fixed system'],
  ['Variable system（每个设计选定并记录）', 'Variable system'],
  ['Variable system (choose per design; record your picks)', 'Variable system'],
  ['Anti-identity（本风格绝不做）', 'Anti-identity'],
  ['Anti-identity (this style never does)', 'Anti-identity'],
  ['Visual environment setup（Phase 2.5）', 'Recipe'],
  ['Visual environment setup (Phase 2.5)', 'Recipe'],
  ['Tone', 'Tone']
])
const NOOP_RECIPE = 'no-op（物化配方随精品集改写定稿补齐——T-C3）'
// 已登记的内容偏差（T44-self-check §2）：oxfmt 段落合并风险迫使步骤 1 列表标记补半角空格
// （`1.（` → `1. （`）——源 config.yaml 该列表标记非法 markdown，不改会被格式门禁连成一段
const NORMALIZE = [['1.（Phase 2 骨架）', '1. （Phase 2 骨架）']]

/** markdown → { intro, sections: Map<名, 内容trim> }（按 `## ` 切，索引口径同 T43 parse） */
function splitSections(md) {
  const lines = md.split('\n')
  const intro = []
  const sections = new Map()
  let cur = null
  for (const line of lines) {
    const m = /^## (.+)$/.exec(line)
    if (m) {
      cur = m[1].trim()
      sections.set(cur, [])
    } else if (cur === null) intro.push(line)
    else sections.get(cur).push(line)
  }
  const body = (arr) => arr.join('\n').trim()
  return {
    intro: body(intro),
    sections: new Map([...sections].map(([k, v]) => [k, body(v)]))
  }
}

/** 新文件：剥 frontmatter（--- 对）后取 body */
function stripFrontmatter(raw) {
  const lines = raw.split('\n')
  if (lines[0].trim() !== '---') throw new Error('无 frontmatter')
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return lines.slice(end + 1).join('\n')
}

const cfg = parse(
  execSync('git show 4ce51816:src/app/ai/pi-backend/brand/config.yaml', {
    encoding: 'utf8',
    maxBuffer: 1 << 24
  })
)
const ids = ['watercolor_poster_v3', 'editorial_poster_v1', 'solid_poster_v1']
let pass = 0
let fail = 0
const ok = (cond, label, extra = '') => {
  if (cond) {
    pass++
    console.log(`  PASS ${label}`)
  } else {
    fail++
    console.log(`  FAIL ${label}${extra ? ` —— ${extra}` : ''}`)
  }
}

for (const id of ids) {
  console.log(`\n== ${id} ==`)
  const oldMdRaw = cfg.profiles.find((p) => p.id === id)?.markdown
  if (!oldMdRaw) {
    ok(false, 'config.yaml 源存在')
    continue
  }
  let oldMd = oldMdRaw
  for (const [from, to] of NORMALIZE) oldMd = oldMd.split(from).join(to)
  const newRaw = readFileSync(`src/app/ai/pi-backend/studio/profiles/${id}.md`, 'utf8')
  const oldS = splitSections(oldMd)
  const newS = splitSections(stripFrontmatter(newRaw))

  ok(oldS.intro === newS.intro, '文首（# 标题 + 引言）逐字一致')

  const renamed = new Map()
  for (const [oldName, content] of oldS.sections) {
    const nn = RENAME.get(oldName)
    if (!nn) {
      ok(false, `旧节名「${oldName}」在归一映射内`)
      continue
    }
    renamed.set(nn, content)
  }
  for (const name of ['Fixed system', 'Variable system', 'Anti-identity', 'Tone']) {
    const a = renamed.get(name)
    const b = newS.sections.get(name)
    ok(a !== undefined && b !== undefined && a === b, `## ${name} 正文逐字一致`)
  }
  const oldRecipe = renamed.get('Recipe')
  const newRecipe = newS.sections.get('Recipe')
  if (oldRecipe === '') {
    ok(newRecipe === NOOP_RECIPE, '## Recipe 旧空节 → 显式 no-op（T-C3 补齐）')
  } else {
    ok(oldRecipe === newRecipe, '## Recipe 正文逐字一致')
  }
  const newNames = [...newS.sections.keys()].sort()
  ok(
    JSON.stringify(newNames) ===
      JSON.stringify(['Anti-identity', 'Fixed system', 'Recipe', 'Tone', 'Variable system']),
    '新文件恰好五节无残留旧节名',
    newNames.join(' | ')
  )
}
console.log(`\n${pass} pass / ${fail} fail`)
process.exit(fail ? 1 : 0)
