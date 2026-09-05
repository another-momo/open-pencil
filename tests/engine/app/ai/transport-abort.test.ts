import { describe, expect, test } from 'bun:test'

import { isAbortLikeError } from '@/app/ai/pi-backend/transport'

// T94：用户主动 stop 触发的 AbortController.abort() 会让流 reader 抛多种
// 形状的"取消"错误——任一形状命中即视为取消，不冒为失败。
describe('pi-backend transport abort detection', () => {
  test('recognises DOMException AbortError', () => {
    const dom = new DOMException('BodyStreamBuffer was aborted', 'AbortError')
    expect(isAbortLikeError(dom)).toBe(true)
  })

  test('recognises Chrome TypeError with BodyStreamBuffer message', () => {
    const err = new TypeError('BodyStreamBuffer was aborted')
    expect(isAbortLikeError(err)).toBe(true)
  })

  test('recognises Node ABORT_ERR code', () => {
    const err = Object.assign(new Error('aborted'), { code: 'ABORT_ERR' })
    expect(isAbortLikeError(err)).toBe(true)
  })

  test('recognises numeric code 20 (Node undici)', () => {
    const err = Object.assign(new Error('aborted'), { code: 20 })
    expect(isAbortLikeError(err)).toBe(true)
  })

  test('does not match unrelated network errors', () => {
    expect(isAbortLikeError(new Error('Network request failed'))).toBe(false)
    expect(isAbortLikeError(new TypeError('fetch failed'))).toBe(false)
    expect(isAbortLikeError({ statusCode: 500 })).toBe(false)
    expect(isAbortLikeError(null)).toBe(false)
    expect(isAbortLikeError(undefined)).toBe(false)
  })
})
