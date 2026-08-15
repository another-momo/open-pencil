import { describe, expect, test } from 'bun:test'

import type { Fill, Stroke } from '@open-pencil/scene-graph'

import { createAPI } from '../helpers'

describe('property access', () => {
  test('name get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.name = 'Card'
    expect(frame.name).toBe('Card')
  })

  test('position get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.x = 50
    frame.y = 100
    expect(frame.x).toBe(50)
    expect(frame.y).toBe(100)
  })

  test('resize', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.resize(300, 200)
    expect(frame.width).toBe(300)
    expect(frame.height).toBe(200)
  })

  test('fills get/set', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    expect(rect.fills.length).toBe(1)
    expect(rect.fills[0].color.r).toBe(1)
  })

  test('fills setter fills in opacity/visible/blendMode defaults', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    // Runtime callers (eval, external data) may pass partial fills.
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }] as unknown as Fill[]
    expect(rect.fills[0].opacity).toBe(1)
    expect(rect.fills[0].visible).toBe(true)
    expect(rect.fills[0].blendMode).toBe('NORMAL')
  })

  test('fills setter defaults survive explicit undefined', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, visible: undefined, opacity: undefined }
    ] as unknown as Fill[]
    expect(rect.fills[0].opacity).toBe(1)
    expect(rect.fills[0].visible).toBe(true)
  })

  test('fills setter preserves non-SOLID fields and normalizes gradient stops', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.fills = [
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [{ position: 0, color: { r: 1, g: 0, b: 0 } }],
        gradientTransform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
      }
    ] as unknown as Fill[]
    const fill = rect.fills[0]
    expect(fill.gradientTransform?.m01).toBe(1)
    expect(fill.gradientStops?.[0].color.a).toBe(1)
    expect(fill.visible).toBe(true)
    expect(fill.opacity).toBe(1)
  })

  test('strokes setter fills in opacity/visible defaults', () => {
    const api = createAPI()
    const rect = api.createRectangle()
    rect.strokes = [
      { color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, align: 'CENTER' }
    ] as unknown as Stroke[]
    expect(rect.strokes[0].opacity).toBe(1)
    expect(rect.strokes[0].visible).toBe(true)
  })

  test('opacity get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.opacity = 0.5
    expect(frame.opacity).toBe(0.5)
  })

  test('visible get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.visible = false
    expect(frame.visible).toBe(false)
  })

  test('locked get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.locked = true
    expect(frame.locked).toBe(true)
  })

  test('rotation get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.rotation = 45
    expect(frame.rotation).toBe(45)
  })

  test('clipsContent get/set', () => {
    const api = createAPI()
    const frame = api.createFrame()
    frame.clipsContent = true
    expect(frame.clipsContent).toBe(true)
  })
})
