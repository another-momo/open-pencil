/**
 * T44（S4 W1 / T-A2）内置 studio 资产集钉扎测试——真目录加载。
 *
 * 把「内置资产过 T43 校验面」钉成永久门禁：W3 内容填充（T-C2/C3）或后续
 * 资产改动写坏文件即红。用户目录以 tmp 空目录隔离，只测内置集。
 *
 * T46（S4 W1 / T-A5）：base.md 已落位——failures 断言按预约收为零，并加
 * base 注册钉扎（免 label schema：frontmatter 仅 `id: base` 即注册成功）。
 *
 * T49（2026-08-31，owner 指令）：base.md 已回归纯转写（frontmatter + 双源头注 +
 * 119 行逐字转写，不承载显式纪律段），原纪律段内容钉扎断言随之撤除。
 */

import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadStudioFromDirs } from '@/app/ai/pi-backend/studio'

const BUILTIN_DIR = join(import.meta.dir, '../../../../src/app/ai/pi-backend/studio')

test('内置资产集过校验面：failures 零、base 注册（免 label）、longform 注册（T62 后无 types 面、画布尺寸节非空）、四 profile 注册、modes=[general, longform]', () => {
  const userDir = mkdtempSync(join(tmpdir(), 'studio-user-empty-'))
  try {
    const r = loadStudioFromDirs(BUILTIN_DIR, userDir)

    // T46 收零：base.md 落位后内置集零失败成永久门禁
    expect(r.failures).toEqual([])

    // base 唯一槽位注册（D-e 免 label schema：内置 base.md 无 label 字段）
    if (!r.base) throw new Error('base 未注册')
    expect(r.base.id).toBe('base')
    expect(r.base.origin).toBe('builtin')

    // workflow：longform 注册；T62 后无 types 数据面，mode 级尺寸说明节非空
    const longform = r.workflows.get('longform')
    if (!longform) throw new Error('longform 未注册')
    expect('types' in longform).toBe(false)
    expect(longform.stepBudget).toBe(50)
    expect(longform.sections['画布尺寸']).toBeTruthy()

    // T65：sizes 尺寸预设清单（原三蓝图 750x/750x/1080x 证据——同尺寸只收一条）
    expect(longform.sizes).toEqual([
      { label: '电商详情长图', canvas: '750x' },
      { label: '小红书长图', canvas: '1080x' }
    ])
    expect(r.modes.find((m) => m.id === 'longform')?.sizes).toEqual(longform.sizes)

    // profiles：恰好四份精品（T48 补迁 watercolor_poster_v2），applicable_to 均指向 longform
    expect([...r.profiles.keys()].sort()).toEqual([
      'editorial_poster_v1',
      'solid_poster_v1',
      'watercolor_poster_v2',
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
