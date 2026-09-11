/**
 * A 方案删空守卫——纯函数 deletionEmptiesDocument 行为钉扎。
 *
 * 根因与方案详见 docs/202609112147-chat-input-seg-root-detached-review.md。
 * 本测试只验纯函数行为（区间 → 是否会删空）；keydown/beforeinput 层把 selection
 * 换算成 [s, e) 区间后调本函数，决策在两处复用同一份不变量。
 */

import { describe, expect, test } from 'bun:test'

import { deletionEmptiesDocument } from '@/components/assistant/delete-guard'

describe('deletionEmptiesDocument', () => {
  test('collapsed caret at end of 1-char doc + Backspace → empties', () => {
    expect(deletionEmptiesDocument('a', 0, 1)).toBe(true)
  })

  test('collapsed caret at start of 1-char doc + Delete → empties', () => {
    expect(deletionEmptiesDocument('a', 0, 1)).toBe(true)
  })

  test('collapsed caret at start of 1-char doc + Backspace (-1, 0) does NOT cover full text → false', () => {
    // 字符位置 0 上的 Backspace 区间是 [-1, 0)；不覆盖全文，不收编。
    expect(deletionEmptiesDocument('a', -1, 0)).toBe(false)
  })

  test('mid-text single-char deletion on 2-char doc → false', () => {
    // 「ab」删首字符 [0, 1) → 剩 'b'，不空。
    expect(deletionEmptiesDocument('ab', 0, 1)).toBe(false)
    // 「ab」删尾字符 [1, 2) → 剩 'a'，不空。
    expect(deletionEmptiesDocument('ab', 1, 2)).toBe(false)
  })

  test('selection covering full text → empties', () => {
    // Ctrl+A → [0, len]，无论文档多长一律收编。
    expect(deletionEmptiesDocument('hello world', 0, 11)).toBe(true)
  })

  test('selection partially covering → false', () => {
    expect(deletionEmptiesDocument('hello world', 0, 5)).toBe(false)
    expect(deletionEmptiesDocument('hello world', 6, 11)).toBe(false)
  })

  test('already-empty doc with any range → true', () => {
    // 已空文档上任何删除键 = delete-past-empty 触发空编辑器规范化，永远收编。
    expect(deletionEmptiesDocument('', 0, 0)).toBe(true)
    expect(deletionEmptiesDocument('', -1, 0)).toBe(true)
    expect(deletionEmptiesDocument('', 0, 1)).toBe(true)
  })

  test('token literal 「@画布选区-1」 full coverage → empties', () => {
    // 字面「@画布选区-1」= 「@画布选区-1」= 9 字符（@ + 画 + 布 + 选 + 区 + - + 1 + 两端「」）
    const token = '「@画布选区-1」'
    expect(token.length).toBe(9)
    expect(deletionEmptiesDocument(token, 0, token.length)).toBe(true)
  })

  test('token literal half coverage → false', () => {
    const token = '「@画布选区-1」'
    // 只删「「@」前 2 字符
    expect(deletionEmptiesDocument(token, 0, 2)).toBe(false)
    // 只删后半「区-1」」
    expect(deletionEmptiesDocument(token, 4, token.length)).toBe(false)
  })

  test('text + token selection covers all → empties', () => {
    // 文本 + token 全覆盖：token 是字面，算进区间后总长 = 全文 → 收编。
    const text = '前缀' + '「@画布选区-1」' + '后缀'
    expect(deletionEmptiesDocument(text, 0, text.length)).toBe(true)
  })
})
