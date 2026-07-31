import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'
import { exportFigFile } from '@open-pencil/core/io'
import { getLibrarySession } from '@open-pencil/core/tools'

import { bindMarketingLibrary, replaceMarketingLibrary } from '@/app/ai/marketing/library'

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
})
