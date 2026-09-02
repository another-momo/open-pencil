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
 *
 * T85（2026-09-02）：editable-design mode 落位（references 按需读取机制首个
 * 消费者）——modes 投影三连 + 4 条 references 注册/解析钉扎；扫描器不吞
 * references 子目录的真目录钉扎（workflows 恰好 2 个而非 2+4）。
 */

import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadStudioFromDirs } from '@/app/ai/pi-backend/studio'

const BUILTIN_DIR = join(import.meta.dir, '../../../../src/app/ai/pi-backend/studio')

test('内置资产集过校验面：failures 零、base 注册（免 label）、三 workflow 注册（longform 画布尺寸节非空；editable-design/full references 全解析）、四 profile 注册、modes=[general, editable-design, editable-design-full, longform]', () => {
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

    // T85：editable-design 注册（定画布海报 mode）+ 4 条 references 声明全解析；
    // 扫描器不吞 references 子目录——workflows 恰好 3 个（references/*.md 未误注册）
    expect(r.workflows.size).toBe(3)
    const editable = r.workflows.get('editable-design')
    if (!editable) throw new Error('editable-design 未注册')
    expect(editable.stepBudget).toBe(50)
    expect(editable.sizes).toEqual([
      { label: '竖版海报（A4 印刷比）', canvas: '794x1123' },
      { label: '方形社交卡片', canvas: '1080x1080' }
    ])
    expect(editable.references?.map((ref) => ref.path)).toEqual([
      'references/asset-architecture.md',
      'references/imagery.md',
      'references/layout-typography.md',
      'references/font-system.md'
    ])
    const bucket = r.resolvedReferences.get('workflow:editable-design')
    expect(bucket?.size).toBe(4)
    for (const abs of bucket?.values() ?? []) {
      expect(abs).toContain(join('workflows', 'editable-design', 'references'))
    }
    expect(r.modes.find((m) => m.id === 'editable-design')?.sizes).toEqual(editable.sizes)

    // T86：editable-design-full 注册（高保真移植版，与改写版并存对比）——同尺寸预设、
    // 独立 references 目录 4 条全解析（解析基 workflows/<id>/references/）
    const editableFull = r.workflows.get('editable-design-full')
    if (!editableFull) throw new Error('editable-design-full 未注册')
    expect(editableFull.stepBudget).toBe(50)
    expect(editableFull.sizes).toEqual(editable.sizes)
    expect(editableFull.references?.map((ref) => ref.path)).toEqual([
      'references/asset-architecture.md',
      'references/imagery.md',
      'references/layout-typography.md',
      'references/font-system.md'
    ])
    const fullBucket = r.resolvedReferences.get('workflow:editable-design-full')
    expect(fullBucket?.size).toBe(4)
    for (const abs of fullBucket?.values() ?? []) {
      expect(abs).toContain(join('workflows', 'editable-design-full', 'references'))
    }
    expect(r.modes.find((m) => m.id === 'editable-design-full')?.sizes).toEqual(editableFull.sizes)

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

    // modes 投影：general 恒在 + 三 workflow 派生（文件名序：'-'(0x2D) < '.'(0x2E)，
    // 故 editable-design-full.md 排在 editable-design.md 前）
    expect(r.modes.map((m) => m.id)).toEqual([
      'general',
      'editable-design-full',
      'editable-design',
      'longform'
    ])
    expect(r.modes[1].source).toBe('workflow')
    expect(r.modes[2].source).toBe('workflow')
    expect(r.modes[3].source).toBe('workflow')
  } finally {
    rmSync(userDir, { recursive: true, force: true })
  }
})
