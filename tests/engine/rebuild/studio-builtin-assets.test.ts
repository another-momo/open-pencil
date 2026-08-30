/**
 * T44（S4 W1 / T-A2）内置 studio 资产集钉扎测试——真目录加载。
 *
 * 把「内置资产过 T43 校验面」钉成永久门禁：W3 内容填充（T-C2/C3）或后续
 * 资产改动写坏文件即红。用户目录以 tmp 空目录隔离，只测内置集。
 *
 * 中间态注记：base.md 随 T-A5 落位——此前 failures 恰含且仅含 base 缺失一条
 *（kind=base）；T-A5 收口时应把该断言收为 failures: []。
 */

import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadStudioFromDirs } from '@/app/ai/pi-backend/studio'

const BUILTIN_DIR = join(import.meta.dir, '../../../src/app/ai/pi-backend/studio')

test('内置资产集过校验面：四迁移文件零失败、longform 三 type 蓝图非空、三 profile 注册、modes=[general, longform]', () => {
  const userDir = mkdtempSync(join(tmpdir(), 'studio-user-empty-'))
  try {
    const r = loadStudioFromDirs(BUILTIN_DIR, userDir)

    // 迁移四文件零失败；唯一 failure = base.md 未落位（T-A5 消除）
    expect(r.failures.length).toBe(1)
    const only = r.failures[0]
    expect(only.kind).toBe('base')
    expect(only.reason).toContain('base.md 缺失')

    // workflow：longform 注册，三 type 齐全且蓝图节非空
    const longform = r.workflows.get('longform')
    if (!longform) throw new Error('longform 未注册')
    if (longform.types === 'none') throw new Error('longform types 不应为 none')
    expect(longform.types.map((t) => t.id)).toEqual([
      'ecommerce_detail',
      'product_long',
      'xiaohongshu_long'
    ])
    expect(longform.types.map((t) => t.size)).toEqual(['750x', '750x', '1080x'])
    for (const t of longform.types) {
      expect(longform.sections[t.id]).toBeTruthy()
    }

    // profiles：恰好三份精品，applicable_to 均指向 longform
    expect([...r.profiles.keys()].sort()).toEqual([
      'editorial_poster_v1',
      'solid_poster_v1',
      'watercolor_poster_v3'
    ])
    for (const p of r.profiles.values()) {
      expect(p.applicableTo).toEqual(['longform'])
    }

    // modes 投影：general 恒在 + longform 来自 workflow
    expect(r.modes.map((m) => m.id)).toEqual(['general', 'longform'])
    expect(r.modes[1].source).toBe('workflow')
  } finally {
    rmSync(userDir, { recursive: true, force: true })
  }
})
