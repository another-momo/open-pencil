import { describe, expect, test } from 'bun:test'

import {
  buildMarketingOverlay,
  type LibrarySnapshot
} from '#agent/prompts/library-snapshot'

function snapshotWith(overrides: Partial<NonNullable<LibrarySnapshot>>): LibrarySnapshot {
  return {
    userPickedProfileId: null,
    types: [],
    profiles: [],
    references: [],
    hasReferencesPage: false,
    ...overrides
  }
}

describe('buildMarketingOverlay', () => {
  test('returns empty string when snapshot is null (Path A or no library bound)', () => {
    expect(buildMarketingOverlay(null)).toBe('')
  })

  test('lists material types from the snapshot', () => {
    const overlay = buildMarketingOverlay(
      snapshotWith({
        types: [
          { id: 'hero', label: 'Hero banner', description: 'Top-of-page visual' },
          { id: 'product', label: 'Product card' }
        ]
      })
    )
    expect(overlay).toContain('Material types in the current library')
    expect(overlay).toContain('- hero (Hero banner): Top-of-page visual')
    expect(overlay).toContain('- product (Product card)')
  })

  test('emits the no-types hint when types is empty', () => {
    const overlay = buildMarketingOverlay(snapshotWith({ types: [] }))
    expect(overlay).toContain('No material types available')
    expect(overlay).toContain('setup_material_type')
  })

  test('emits the 参考区 paragraph when the document has a references page', () => {
    const overlay = buildMarketingOverlay(snapshotWith({ hasReferencesPage: true }))
    expect(overlay).toContain('参考区 (library references)')
    expect(overlay).toContain('reference-only')
  })

  test('omits the 参考区 paragraph when hasReferencesPage is false', () => {
    const overlay = buildMarketingOverlay(snapshotWith({ hasReferencesPage: false }))
    expect(overlay).not.toContain('参考区 (library references)')
  })

  test('emits the active profile markdown when userPickedProfileId matches a profile', () => {
    const overlay = buildMarketingOverlay(
      snapshotWith({
        userPickedProfileId: 'p-bold',
        profiles: [
          { id: 'p-bold', label: 'Bold', applicableTo: ['hero'], markdown: 'Use thick strokes' },
          { id: 'p-calm', label: 'Calm', applicableTo: ['hero'], markdown: 'Use thin strokes' }
        ]
      })
    )
    expect(overlay).toContain('Active style profile: p-bold')
    expect(overlay).toContain('Use thick strokes')
    expect(overlay).not.toContain('Use thin strokes')
    expect(overlay).not.toContain('p-calm')
  })

  test('emits the "(not in library)" hint when the picked id is missing from profiles', () => {
    const overlay = buildMarketingOverlay(
      snapshotWith({
        userPickedProfileId: 'p-deleted',
        profiles: [{ id: 'p-active', label: 'A', applicableTo: [], markdown: 'A markdown' }]
      })
    )
    expect(overlay).toContain('Active style profile: (not in library)')
    expect(overlay).toContain('"p-deleted"')
  })

  test('omits the profile section entirely when the user has not picked one', () => {
    const overlay = buildMarketingOverlay(
      snapshotWith({
        userPickedProfileId: null,
        profiles: [
          { id: 'p-x', label: 'X', applicableTo: ['hero'], markdown: 'X markdown' },
          { id: 'p-y', label: 'Y', applicableTo: ['hero'], markdown: 'Y markdown' }
        ]
      })
    )
    expect(overlay).not.toContain('Active style profile')
    expect(overlay).not.toContain('X markdown')
    expect(overlay).not.toContain('Y markdown')
    // Catalog ("## Profiles in the current library") is intentionally omitted
    // so the agent has no visibility until the user picks.
    expect(overlay).not.toContain('Profiles in the current library')
  })

  test('emits a leading blank line so the overlay can be appended to the system prompt', () => {
    const overlay = buildMarketingOverlay(snapshotWith({ types: [] }))
    expect(overlay.startsWith('\n\n')).toBe(true)
  })
})
