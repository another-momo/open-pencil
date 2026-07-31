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

  test('buildMarketingOverlay always emits both section headers even when library is empty', () => {
    __resetMarketingLibraryForTest()
    const doc = new SceneGraph()
    const overlay = buildMarketingOverlay(doc)
    expect(overlay).not.toBe('')
    expect(overlay).toContain('## Material types in the current library')
    expect(overlay).toContain('## Profiles in the current library')
    expect(overlay).toContain('## Active style profile')
    expect(overlay).toContain('No material types available')
    expect(overlay).toContain('No style profile is active')
  })

  test('buildMarketingOverlay lists types and active profile when a library is bound', async () => {
    const bytes = await exportFigFile(makeMiniLibraryGraph())
    const result = await replaceMarketingLibrary(new File([bytes], 'lib.fig'))
    expect('error' in result).toBe(false)

    try {
      const { setActiveProfile } = await import('@/app/ai/marketing/library')
      const doc = new SceneGraph()
      setActiveProfile(doc, 'luxury_v1')
      const overlay = buildMarketingOverlay(doc)
      expect(overlay).toContain('## Material types in the current library')
      expect(overlay).toContain('wechat_moments')
      expect(overlay).toContain('## Profiles in the current library')
      expect(overlay).toContain('casual_v1')
      expect(overlay).toContain('luxury_v1')
      expect(overlay).toContain('## Active style profile: luxury_v1')
    } finally {
      __resetMarketingLibraryForTest()
    }
  })

  test('buildMarketingOverlay names a missing profile when user-selected id is not in the library', async () => {
    const bytes = await exportFigFile(makeMiniLibraryGraph())
    await replaceMarketingLibrary(new File([bytes], 'lib.fig'))
    ;(await import('@/app/ai/chat/storage')).profileSelection.value = 'nonexistent_profile'

    try {
      const doc = new SceneGraph()
      const overlay = buildMarketingOverlay(doc)
      expect(overlay).toContain('not present in the loaded library')
      expect(overlay).toContain('nonexistent_profile')
    } finally {
      __resetMarketingLibraryForTest()
    }
  })
})
