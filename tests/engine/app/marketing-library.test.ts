import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { exportFigFile } from '@open-pencil/core/io'
import { getLibrarySession } from '@open-pencil/core/tools'

import {
  __resetMarketingLibraryForTest,
  bindMarketingLibrary,
  buildMarketingOverlay,
  replaceMarketingLibrary
} from '@/app/ai/marketing/library'

import { makeMiniLibraryGraph } from '#tests/helpers/marketing-library'


describe('marketing library service', () => {
  test('bindMarketingLibrary replaces a previously bound session after upload-replace', async () => {
    const doc = new SceneGraph()

    const firstBytes = await exportFigFile(makeMiniLibraryGraph())
    const first = await replaceMarketingLibrary(new File([firstBytes], 'first.fig'))
    expect('error' in first).toBe(false)
    bindMarketingLibrary(doc)
    expect(getLibrarySession(doc)?.name).toBe('first.fig')

    const secondBytes = await exportFigFile(makeMiniLibraryGraph())
    const second = await replaceMarketingLibrary(new File([secondBytes], 'second.fig'))
    expect('error' in second).toBe(false)
    bindMarketingLibrary(doc)
    expect(getLibrarySession(doc)?.name).toBe('second.fig')
  })

  test('buildMarketingOverlay only emits Material types when no profile is locked (P8)', () => {
    __resetMarketingLibraryForTest()
    const doc = new SceneGraph()
    const overlay = buildMarketingOverlay(doc)
    expect(overlay).not.toBe('')
    // The Material types section is always emitted so the AI can infer
    // type ids and surface library-load failures to the user.
    expect(overlay).toContain('## Material types in the current library')
    expect(overlay).toContain('No material types available')
    // P8: with no user-picked profile, profile information does NOT enter
    // the agent context — neither the catalog nor the active-style section.
    expect(overlay).not.toContain('## Profiles in the current library')
    expect(overlay).not.toContain('## Active style profile')
    expect(overlay).not.toContain('No style profile is active')
  })

  test('buildMarketingOverlay omits the profile catalog and emits the picked profile markdown (P8)', async () => {
    const bytes = await exportFigFile(makeMiniLibraryGraph())
    const result = await replaceMarketingLibrary(new File([bytes], 'lib.fig'))
    expect('error' in result).toBe(false)

    try {
      const storage = await import('@/app/ai/chat/storage')
      storage.setUserProfile('luxury_v1')
      const doc = new SceneGraph()
      const overlay = buildMarketingOverlay(doc)
      // Material types still emitted (always).
      expect(overlay).toContain('## Material types in the current library')
      expect(overlay).toContain('wechat_moments')
      // P8: with a user-picked profile active, ONLY that profile's
      // markdown is injected — no catalog of all profiles, no other
      // profile names leaking into the agent context.
      expect(overlay).toContain('## Active style profile: luxury_v1')
      expect(overlay).not.toContain('## Profiles in the current library')
      expect(overlay).not.toContain('casual_v1')
    } finally {
      __resetMarketingLibraryForTest()
    }
  })

  test('buildMarketingOverlay surfaces an inconsistent user pick (P8)', async () => {
    const bytes = await exportFigFile(makeMiniLibraryGraph())
    await replaceMarketingLibrary(new File([bytes], 'lib.fig'))
    const storage = await import('@/app/ai/chat/storage')
    storage.profileSelection.value = { id: 'nonexistent_profile', source: 'user' }

    try {
      const doc = new SceneGraph()
      const overlay = buildMarketingOverlay(doc)
      // P8: when the user has picked a profile id that the library does
      // not contain, surface the inconsistency rather than silently
      // dropping the pick.
      expect(overlay).toContain('not in library')
      expect(overlay).toContain('nonexistent_profile')
      expect(overlay).not.toContain('## Profiles in the current library')
    } finally {
      __resetMarketingLibraryForTest()
    }
  })

  // P8v5 (2026-08-04): profile state lives in `profileSelection` (the
  // single source of truth) and is reflected in the overlay on the next
  // call to `buildMarketingOverlay`. bindMarketingLibrary itself no
  // longer touches any per-graph cache — there is nothing to clobber.

  test('bindMarketingLibrary does not gate profile visibility on chip state (P8v5)', async () => {
    const bytes = await exportFigFile(makeMiniLibraryGraph())
    const result = await replaceMarketingLibrary(new File([bytes], 'lib.fig'))
    expect('error' in result).toBe(false)

    try {
      const doc = new SceneGraph()
      const storage = await import('@/app/ai/chat/storage')

      // No user pick yet → overlay has no profile section regardless of
      // bind calls.
      storage.profileSelection.value = null
      bindMarketingLibrary(doc)
      expect(buildMarketingOverlay(doc)).not.toContain('## Active style profile')

      // User picks luxury_v1 → overlay shows it on the next call.
      storage.profileSelection.value = { id: 'luxury_v1', source: 'user' }
      bindMarketingLibrary(doc)
      expect(buildMarketingOverlay(doc)).toContain('## Active style profile: luxury_v1')

      // User clears the chip → overlay drops the profile section
      // immediately. There is no "陈旧 lock 保留" hidden behavior:
      // chip state is the source of truth.
      storage.profileSelection.value = null
      bindMarketingLibrary(doc)
      expect(buildMarketingOverlay(doc)).not.toContain('## Active style profile')
    } finally {
      __resetMarketingLibraryForTest()
    }
  })
})
