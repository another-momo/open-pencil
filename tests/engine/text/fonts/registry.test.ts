import { describe, expect, test } from 'bun:test'

import {
  FONT_REGISTRY,
  fontRegistryEntry,
  isBundledFamilyAllowed,
  isProviderFamilyVisible
} from '#core/text/font/registry'

describe('FONT_REGISTRY', () => {
  test('registers the three bundled families with tiers', () => {
    const families = FONT_REGISTRY.map((entry) => entry.family)
    expect(families).toContain('Inter')
    expect(families).toContain('Alibaba PuHuiTi')
    expect(families).toContain('Noto Naskh Arabic')
  })

  test('Alibaba PuHuiTi carries all nine weights and T1 licensing note', () => {
    const entry = fontRegistryEntry('Alibaba PuHuiTi')
    expect(entry?.tier).toBe('T1')
    expect(entry?.weights).toHaveLength(9)
    expect(entry?.note).toBeTruthy()
  })

  test('only T0/T1 entries are registered', () => {
    for (const entry of FONT_REGISTRY) {
      expect(['T0', 'T1']).toContain(entry.tier)
    }
  })
})

describe('isBundledFamilyAllowed', () => {
  test('allows registered bundled families', () => {
    expect(isBundledFamilyAllowed('Inter')).toBe(true)
    expect(isBundledFamilyAllowed('Alibaba PuHuiTi')).toBe(true)
  })

  test('rejects unregistered families', () => {
    expect(isBundledFamilyAllowed('Comic Sans MS')).toBe(false)
    expect(isBundledFamilyAllowed('')).toBe(false)
  })
})

describe('isProviderFamilyVisible', () => {
  test('keeps online provider families visible (generic capability)', () => {
    expect(isProviderFamilyVisible('Any Web Font')).toBe(true)
  })
})
