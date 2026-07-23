import { expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core'

/**
 * Multi-renderer font registration: every live renderer owns a
 * TypefaceFontProvider. New font loads must reach ALL attached providers —
 * the scene canvas and the overlay canvas are separate renderers.
 */

interface FakeProvider {
  registrations: { family: string; byteLength: number }[]
}

function fakeProvider(): FakeProvider & TypefaceFontProvider {
  const fake: FakeProvider = { registrations: [] }
  const provider = {
    registrations: fake.registrations,
    registerFont(data: ArrayBuffer, family: string) {
      fake.registrations.push({ family, byteLength: data.byteLength })
    }
  }
  return provider as TypefaceFontProvider as FakeProvider & TypefaceFontProvider
}

const ck = {} as CanvasKit

function bytes(seed: number): ArrayBuffer {
  return new Uint8Array([0, 1, 2, 3, seed]).buffer
}

test('font registrations reach all attached providers', () => {
  const manager = new FontManager()
  const scene = fakeProvider()
  const overlay = fakeProvider()

  manager.attachProvider(ck, scene)
  manager.markLoaded('Inter', 'Regular', bytes(1))
  expect(scene.registrations).toHaveLength(1)

  manager.attachProvider(ck, overlay)
  expect(overlay.registrations).toHaveLength(1)

  manager.markLoaded('Inter', 'Bold', bytes(2))
  expect(scene.registrations).toHaveLength(2)
  expect(overlay.registrations).toHaveLength(2)

  manager.detachProvider(scene)
  manager.markLoaded('Inter', 'Medium', bytes(3))
  expect(scene.registrations).toHaveLength(2)
  expect(overlay.registrations).toHaveLength(3)
})

test('loadFonts-style detach+reattach does not wipe other providers', () => {
  const manager = new FontManager()
  const first = fakeProvider()
  const second = fakeProvider()

  manager.attachProvider(ck, first)
  manager.markLoaded('Inter', 'Regular', bytes(1))

  manager.attachProvider(ck, second)
  manager.detachProvider(undefined)
  manager.markLoaded('Inter', 'Bold', bytes(2))
  expect(first.registrations).toHaveLength(2)
  expect(second.registrations).toHaveLength(2)
})
