/**
 * T48 保真核验：watercolor_poster_v2 抢救性迁移——git 钉扎源 vs profiles/watercolor_poster_v2.md。
 *
 * 源 = `git show 4ce51816:src/app/ai/pi-backend/brand/config.yaml`（T45 已删除 brand/，
 * v2 仅存于 git 历史；commit 钉扎防分支漂移，blob ec9b22a3 与 rebuild/pi 同值，
 * 2026-08-31 `git rev-parse` 双 ref 实测）。逐节对照（T44 同款节名归一映射后）；
 * Recipe 节期望 = 旧 `Visual environment setup (Phase 2.5)` 正文逐字（真配方，非 no-op）。
 *
 * oxfmt canonical 化观察项（T48 自检登记）：oxfmt 在 `## Tone` 前补了一个结构性空行——
 * 节体按 trim 口径对照，不受影响，无需 NORMALIZE 条目。
 *
 * 用法：node tools/rebuild/verify-t48-v2-rescue-fidelity.mjs（cwd = 仓库根）
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { parse } from 'yaml'

const PINNED_SOURCE = '4ce51816:src/app/ai/pi-backend/brand/config.yaml'
const RENAME = new Map([
  ['Fixed system (never break)', 'Fixed system'],
  ['Variable system (choose per design; record your picks)', 'Variable system'],
  ['Anti-identity (this style never does)', 'Anti-identity'],
  ['Visual environment setup (Phase 2.5)', 'Recipe'],
  ['Tone', 'Tone']
])
const EXPECTED_FRONTMATTER = [
  '---',
  'id: watercolor_poster_v2',
  'label: 水彩海报 v2',
  'applicable_to: [longform]',
  'version: 2',
  '---'
].join('\n')

/** markdown → { intro, sections: Map<名, 内容trim> }（按 `## ` 切，索引口径同 T43 parse / T44 核验） */
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

/** 新文件：拆 frontmatter 原文块（--- 对）与 body */
function splitFile(raw) {
  const lines = raw.split('\n')
  if (lines[0].trim() !== '---') throw new Error('无 frontmatter')
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return { frontmatter: lines.slice(0, end + 1).join('\n'), body: lines.slice(end + 1).join('\n') }
}

const src = execSync(`git show ${PINNED_SOURCE}`, { encoding: 'utf8', maxBuffer: 1 << 24 })
const cfg = parse(src)
const oldMd = cfg.profiles.find((p) => p.id === 'watercolor_poster_v2')?.markdown

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

console.log('== watercolor_poster_v2（git 钉扎源 4ce51816） ==')
ok(oldMd !== undefined, '钉扎源含 watercolor_poster_v2 条目')

if (oldMd) {
  const { frontmatter, body } = splitFile(
    readFileSync('src/app/ai/pi-backend/studio/profiles/watercolor_poster_v2.md', 'utf8')
  )
  ok(frontmatter === EXPECTED_FRONTMATTER, 'frontmatter 四键钉扎（id/label/applicable_to/version）')

  const oldS = splitSections(oldMd)
  const newS = splitSections(body)
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
  ok(
    oldRecipe !== undefined && oldRecipe !== '' && oldRecipe === newRecipe,
    '## Recipe 真配方逐字一致（旧 Visual environment setup 节，非 no-op）'
  )
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
