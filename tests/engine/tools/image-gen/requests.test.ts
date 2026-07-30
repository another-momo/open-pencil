import { describe, expect, test } from 'bun:test'

import {
  normalizeDimensions,
  normalizeSize,
  parseImageGenRequests
} from '#core/tools/image-gen/requests'

describe('normalizeDimensions', () => {
  test('aligns to 16px while preserving aspect ratio', () => {
    expect(normalizeDimensions(1080, 1920)).toEqual({ width: 1088, height: 1920 })
    expect(normalizeDimensions(1200, 628)).toEqual({ width: 1200, height: 624 })
  })

  test('scales up to the pixel floor even for aligned sizes', () => {
    // 800x800 = 640,000 pixels < MIN_PIXELS → ceil-scaled to 816x816
    expect(normalizeDimensions(800, 800)).toEqual({ width: 816, height: 816 })
  })

  test('clips to max edge and max pixels', () => {
    expect(normalizeDimensions(5000, 3000)).toEqual({ width: 3712, height: 2224 })
  })

  test('clips extreme ratios then re-fills to the pixel floor', () => {
    // 400x3000 → 3:1 clip to 400x1200 → below MIN_PIXELS → scale up to 480x1408
    expect(normalizeDimensions(400, 3000)).toEqual({ width: 480, height: 1408 })
  })

  test('scales tiny sizes up to the pixel floor', () => {
    const { width, height } = normalizeDimensions(300, 200)
    expect(width * height).toBeGreaterThanOrEqual(655_360)
  })
})

describe('normalizeSize', () => {
  test('rejects invalid input', () => {
    expect(normalizeSize(0, 100)).toEqual({ error: 'Invalid size 0x100' })
    expect(normalizeSize(Number.NaN, 100)).toEqual({ error: 'Invalid size NaNx100' })
  })

  test('reports whether the size was adjusted', () => {
    const adjusted = normalizeSize(1080, 1920)
    expect(adjusted).toEqual({ width: 1088, height: 1920, adjusted: true })
    const exact = normalizeSize(1024, 1024)
    expect(exact).toEqual({ width: 1024, height: 1024, adjusted: false })
  })
})

describe('parseImageGenRequests', () => {
  test('parses references as node id strings', () => {
    const result = parseImageGenRequests(
      '[{"prompt":"edit","id":"0:42","references":["0:42","0:50"]}]'
    )
    expect(result).toEqual({
      requests: [
        expect.objectContaining({
          id: '0:42',
          references: [{ id: '0:42' }, { id: '0:50' }]
        })
      ]
    })
  })

  test('parses references with asImage flag', () => {
    const result = parseImageGenRequests(
      '[{"prompt":"bg","width":1080,"height":1920,"references":[{"id":"0:9","asImage":true}]}]'
    )
    expect(result).toEqual({
      requests: [
        expect.objectContaining({
          references: [{ id: '0:9', asImage: true }]
        })
      ],
      sizeNote: expect.stringContaining('1080x1920 → 1088x1920')
    })
  })

  test('omits references when absent or empty', () => {
    const result = parseImageGenRequests(
      '[{"prompt":"cat","width":1024,"height":1024,"references":[]}]'
    )
    expect(result).toEqual({
      requests: [expect.objectContaining({ references: undefined })]
    })
  })

  test('rejects malformed references', () => {
    expect(
      parseImageGenRequests('[{"prompt":"x","width":100,"height":100,"references":"0:1"}]')
    ).toEqual({ error: '"references" must be an array of node ids' })
    expect(
      parseImageGenRequests('[{"prompt":"x","width":100,"height":100,"references":[42]}]')
    ).toEqual({
      error: 'Each reference must be a node id string or { "id": "...", "asImage"?: true }'
    })
    expect(
      parseImageGenRequests('[{"prompt":"x","width":100,"height":100,"references":[{}]}]')
    ).toEqual({
      error: 'Each reference must be a node id string or { "id": "...", "asImage"?: true }'
    })
  })

  test('new images require width and height', () => {
    expect(parseImageGenRequests('[{"prompt":"cat"}]')).toEqual({
      error: 'New images need numeric "width" and "height"'
    })
  })

  test('reports size adjustments in sizeNote', () => {
    const result = parseImageGenRequests('[{"prompt":"poster","width":1080,"height":1920}]')
    expect(result).toEqual({
      requests: [expect.objectContaining({ width: 1088, height: 1920 })],
      sizeNote: expect.stringContaining('1080x1920 → 1088x1920')
    })
  })
})
