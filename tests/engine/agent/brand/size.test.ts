/**
 * Size string parser — covers the Wx / WxH wire formats.
 */

import { describe, expect, test } from 'bun:test'

import { resolveSize } from '#agent/brand/index.js'

describe('resolveSize', () => {
  test('parses fixed width × height', () => {
    expect(resolveSize('1080x1080')).toEqual({ width: 1080, height: 1080 })
  })

  test('parses HUG height', () => {
    expect(resolveSize('750x')).toEqual({ width: 750, height: null })
  })

  test('throws on malformed input', () => {
    expect(() => resolveSize('nope' as never)).toThrow(/Invalid size/)
  })
})