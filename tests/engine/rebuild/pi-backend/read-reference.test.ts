/**
 * T85（资产 references 按需读取机制，定谳 4）：read_reference 后端本地工具单测。
 * 形态参照 tests/engine/rebuild/marketing/ask-user-question.test.ts（pi 工具工厂经
 * 双参直调 execute 钉行为）。
 *
 * 验收映射（T85-plan §3.8）：允许 / 拒绝（未声明列出可读清单）/ 遍历拒绝（`..`
 * 与绝对路径运行期再拒，纵深防御）/ 50KB 截断（尾部注明）/ 读失败结构化错误 /
 * 请求侧反斜杠归一 / 回合外空集全拒。
 */

import { describe, expect, test } from 'bun:test'

import {
  createReadReferenceTool,
  READ_REFERENCE_MAX_BYTES
} from '@/app/ai/pi-backend/read-reference'

const CONTENT = '# 图像决策纪律\n\n留白带只描述外观。\n'

/** 确定性文件存根：path → 内容（未命中抛 ENOENT 形态错误） */
function stubReadFile(files: Record<string, string>): (abs: string) => string {
  return (abs) => {
    if (!(abs in files)) throw new Error(`ENOENT: no such file or directory, open '${abs}'`)
    return files[abs]
  }
}

function makeTool(files: Record<string, string>, allowed?: ReadonlyMap<string, string>) {
  return createReadReferenceTool({
    allowedPaths: () =>
      allowed ?? new Map([['references/imagery.md', '/abs/editable-design/references/imagery.md']]),
    readFile: stubReadFile(files)
  })
}

describe('read_reference：允许与读取', () => {
  test('命中 → 返回全文 + details 带 path/bytes/truncated=false', async () => {
    const tool = makeTool({ '/abs/editable-design/references/imagery.md': CONTENT })
    const result = await tool.execute('call-1', { path: 'references/imagery.md' })
    const text = result.content[0].type === 'text' ? result.content[0].text : ''
    expect(text).toBe(CONTENT)
    expect(result.details).toEqual({
      path: 'references/imagery.md',
      bytes: Buffer.byteLength(CONTENT, 'utf8'),
      truncated: false
    })
  })

  test('请求侧反斜杠归一命中（references\\imagery.md → references/imagery.md）', async () => {
    const tool = makeTool({ '/abs/editable-design/references/imagery.md': CONTENT })
    const result = await tool.execute('call-1', { path: 'references\\imagery.md' })
    const details = result.details as { path?: string }
    expect(details.path).toBe('references/imagery.md')
  })
})

describe('read_reference：拒绝面', () => {
  test('未声明 → reference_not_allowed + 列出本回合可读清单', async () => {
    const tool = makeTool({})
    const result = await tool.execute('call-1', { path: 'references/font-system.md' })
    const details = result.details as { error?: string; message?: string; available?: string[] }
    expect(details.error).toBe('reference_not_allowed')
    expect(details.available).toEqual(['references/imagery.md'])
    expect(details.message).toContain('references/imagery.md')
    expect(details.message).toContain('references/font-system.md')
  })

  test('回合外空集（宿主 finalizeTurn 复位后）→ 全拒 + available 空', async () => {
    const tool = makeTool({}, new Map())
    const result = await tool.execute('call-1', { path: 'references/imagery.md' })
    const details = result.details as { error?: string; available?: string[] }
    expect(details.error).toBe('reference_not_allowed')
    expect(details.available).toEqual([])
  })

  test('`..` 上跳与绝对路径运行期再拒（reference_path_rejected，不查文件）', async () => {
    let reads = 0
    const tool = createReadReferenceTool({
      allowedPaths: () => new Map([['references/imagery.md', '/abs/x.md']]),
      readFile: () => {
        reads++
        return CONTENT
      }
    })
    for (const path of [
      '../secret.md',
      'references/../../secret.md',
      '/etc/passwd',
      'C:\\key.env'
    ]) {
      const result = await tool.execute('call-1', { path })
      const details = result.details as { error?: string; available?: string[] }
      expect(details.error).toBe('reference_path_rejected')
      expect(details.available).toEqual(['references/imagery.md'])
    }
    expect(reads).toBe(0)
  })

  test('空 path → reference_path_rejected', async () => {
    const tool = makeTool({})
    const result = await tool.execute('call-1', { path: '  ' })
    expect((result.details as { error?: string }).error).toBe('reference_path_rejected')
  })

  test('加载后文件被移走 → reference_read_failed 结构化错误', async () => {
    const tool = makeTool({}) // 存根无此文件 → 抛 ENOENT
    const result = await tool.execute('call-1', { path: 'references/imagery.md' })
    const details = result.details as { error?: string; message?: string }
    expect(details.error).toBe('reference_read_failed')
    expect(details.message).toContain('ENOENT')
  })
})

describe('read_reference：50KB 截断', () => {
  test('超出上限 → 按字节截断 + 尾部注明 + details.truncated=true', async () => {
    // 构造 60KB 文本（ASCII 计字节即字符）
    const big = '密'.repeat(20 * 1024) // 3 字节/字 → 60KB
    const tool = makeTool({ '/abs/editable-design/references/imagery.md': big })
    const result = await tool.execute('call-1', { path: 'references/imagery.md' })
    const text = result.content[0].type === 'text' ? result.content[0].text : ''
    const details = result.details as { bytes?: number; truncated?: boolean }
    expect(details.truncated).toBe(true)
    expect(details.bytes).toBe(Buffer.byteLength(big, 'utf8'))
    expect(text).toContain('[已截断')
    // 截断体 ≤ 上限（尾部注记另加）
    expect(Buffer.byteLength(text.split('[已截断')[0], 'utf8')).toBeLessThanOrEqual(
      READ_REFERENCE_MAX_BYTES
    )
  })

  test('恰在上限内 → 不截断', async () => {
    const ok = 'a'.repeat(READ_REFERENCE_MAX_BYTES - 10)
    const tool = makeTool({ '/abs/editable-design/references/imagery.md': ok })
    const result = await tool.execute('call-1', { path: 'references/imagery.md' })
    expect((result.details as { truncated?: boolean }).truncated).toBe(false)
  })
})
