import { describe, expect, test } from 'bun:test'

import { parsePhotoRequests } from '#core/tools/stock-photo/requests'

describe('parsePhotoRequests', () => {
  test('parses a single request and request arrays', () => {
    expect(parsePhotoRequests('{"id":"1:2","query":"forest"}')).toEqual({
      requests: [{ id: '1:2', query: 'forest' }]
    })
    expect(parsePhotoRequests('[{"id":"1:2","query":"forest"}]')).toEqual({
      requests: [{ id: '1:2', query: 'forest' }]
    })
  })

  test('rejects malformed JSON', () => {
    expect(parsePhotoRequests('[{"id":')).toEqual({ error: 'Invalid JSON in requests' })
  })

  test('salvages a valid array with insignificant trailing garbage', () => {
    const result = parsePhotoRequests('[{"id":"1:2","query":"forest"}]"}')
    expect(result).toEqual({
      requests: [{ id: '1:2', query: 'forest' }],
      warning: expect.stringContaining('Trailing garbage')
    })
  })

  test('rejects arrays with substantive content after the closing bracket', () => {
    expect(parsePhotoRequests('[{"id":"1:2"}] , {"id":"1:3"}')).toEqual({
      error: 'Invalid JSON in requests'
    })
  })

  test('removes prototype-polluting properties', () => {
    const result = parsePhotoRequests(
      '[{"id":"1:2","query":"forest","__proto__":{"polluted":true}}]'
    )

    expect(result).toEqual({ error: 'Invalid JSON in requests' })
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false)
  })
})
