import { describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import {
  chooseLocalFontMatch,
  fontManager,
  FontManager,
  styleToWeight,
  weightToFigmaStyle,
  weightToStyle
} from '@open-pencil/core'
import type { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('styleToWeight', () => {
  test('maps common style names', () => {
    expect(styleToWeight('Regular')).toBe(400)
    expect(styleToWeight('Bold')).toBe(700)
    expect(styleToWeight('Light')).toBe(300)
    expect(styleToWeight('Thin')).toBe(100)
    expect(styleToWeight('Medium')).toBe(500)
    expect(styleToWeight('SemiBold')).toBe(600)
    expect(styleToWeight('Semi Bold')).toBe(600)
    expect(styleToWeight('DemiBold')).toBe(600)
    expect(styleToWeight('ExtraBold')).toBe(800)
    expect(styleToWeight('Black')).toBe(900)
  })

  test('handles italic variants', () => {
    expect(styleToWeight('Bold Italic')).toBe(700)
    expect(styleToWeight('Light Italic')).toBe(300)
    expect(styleToWeight('600 Italic')).toBe(600)
  })

  test('case insensitive', () => {
    expect(styleToWeight('bold')).toBe(700)
    expect(styleToWeight('THIN')).toBe(100)
    expect(styleToWeight('semibold')).toBe(600)
  })
})

describe('weightToStyle', () => {
  test('maps weight numbers to style names', () => {
    expect(weightToStyle(100)).toBe('Thin')
    expect(weightToStyle(300)).toBe('Light')
    expect(weightToStyle(400)).toBe('Regular')
    expect(weightToStyle(500)).toBe('Medium')
    expect(weightToStyle(600)).toBe('SemiBold')
    expect(weightToStyle(700)).toBe('Bold')
    expect(weightToStyle(800)).toBe('ExtraBold')
    expect(weightToStyle(900)).toBe('Black')
  })
})

describe('weightToFigmaStyle', () => {
  test('Figma uses "Regular" not "Normal"', () => {
    expect(weightToFigmaStyle(400)).toBe('Regular')
  })

  test('maps bold weights', () => {
    expect(weightToFigmaStyle(700)).toBe('Bold')
  })
})

describe('chooseLocalFontMatch', () => {
  test('returns null when no candidates', () => {
    expect(chooseLocalFontMatch('Inter', [], 400)).toBeNull()
  })

  test('picks exact family + style match', () => {
    expect(
      chooseLocalFontMatch('Inter', [
        { family: 'Roboto', style: 'Regular' },
        { family: 'Inter', style: 'Bold' }
      ])
    ).toEqual({ family: 'Inter', style: 'Bold' })
  })
})

describe('FontManager loaded font cache', () => {
  function createRecordingProvider(): {
    provider: TypefaceFontProvider
    calls: Array<{ family: string; style: string }>
  } {
    const calls: Array<{ family: string; style: string }> = []
    const cache = new Map<string, number>()
    const provider: TypefaceFontProvider = {
      registerFont(font) {
        if (!font?.familyName) return
        const key = `${font.familyName}|${font.getTypeface ? 'face' : 'unknown'}`
        cache.set(key, (cache.get(key) ?? 0) + 1)
      },
      countFonts() {
        return cache.size
      },
      getFontFamilies() {
        return [...new Set([...cache.keys()].map((k) => k.split('|')[0]))]
      },
      matchFamily(_family) {
        return []
      }
    }
    void calls
    return { provider, calls }
  }

  test('(Alibaba PuHuiTi + Regular/Medium/Bold/etc) all resolve to a non-null buffer', async () => {
    const manager = new FontManager()
    const recording = createRecordingProvider()
    manager.attachProvider({} as CanvasKit, recording.provider)
    manager.setHostFontLoader(async (family, _style) => {
      if (family === 'Alibaba PuHuiTi') return new ArrayBuffer(8192)
      return null
    })

    for (const style of ['Thin', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Heavy', 'Black']) {
      const buffer = await manager.loadFamily('Alibaba PuHuiTi', { family: 'Alibaba PuHuiTi', style })
      expect(buffer).not.toBeNull()
      expect(buffer?.byteLength).toBe(8192)
    }
  })

  test('loadFamily falls back to global fetch when host loader returns null', async () => {
    const manager = new FontManager()
    const originalFetch = globalThis.fetch
    try {
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        let url: string
        if (typeof input === 'string') {
          url = input
        } else if (input instanceof URL) {
          url = input.toString()
        } else {
          url = input.url
        }
        if (url.includes('cdn.example.com')) {
          return new Response(new ArrayBuffer(4096), { status: 200 })
        }
        return new Response('not found', { status: 404 })
      }) as typeof fetch

      const buffer = await manager.loadFamily('FallbackFont', {
        family: 'FallbackFont',
        style: 'Regular',
        url: 'https://cdn.example.com/font.woff2'
      })
      expect(buffer).not.toBeNull()
      expect(buffer?.byteLength).toBe(4096)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
