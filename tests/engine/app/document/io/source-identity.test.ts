import { describe, expect, test, vi } from 'bun:test'

import { createDefaultEditorState } from '@open-pencil/core/editor'

import { createSaveActions } from '@/app/document/io/save'

function makeWritableHandle(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    createWritable: vi.fn(async () => ({
      write: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined)
    }))
  } as FileSystemFileHandle
}

function createSaveHarness(handle: FileSystemFileHandle) {
  const state = {
    ...createDefaultEditorState('page'),
    documentName: 'Untitled'
  }
  const setSourceIdentity = vi.fn()
  const setFileHandle = vi.fn()
  const actions = createSaveActions({
    state,
    buildFigFile: () => new Uint8Array([1, 2, 3]),
    getFilePath: () => null,
    setFilePath: vi.fn(),
    getFileHandle: () => handle,
    setFileHandle,
    getDownloadName: () => null,
    setDownloadName: vi.fn(),
    setSourceIdentity,
    setSavedVersion: vi.fn(),
    setLastWriteTime: vi.fn(),
    startWatchingFile: vi.fn()
  })
  return { actions, setSourceIdentity, setFileHandle }
}

describe('saved document identity', () => {
  test('publishes the writable handle after a successful save', async () => {
    const handle = makeWritableHandle('saved.fig')
    const { actions, setSourceIdentity } = createSaveHarness(handle)

    await actions.saveFigFile()

    expect(setSourceIdentity).toHaveBeenCalledWith({ handle, path: null })
  })

  test('does not publish an identity when writing fails', async () => {
    const handle = {
      kind: 'file',
      name: 'failed.fig',
      createWritable: vi.fn(async () => {
        throw new Error('write failed')
      })
    } as FileSystemFileHandle
    const { actions, setSourceIdentity, setFileHandle } = createSaveHarness(handle)

    // Fork semantics: a failed createWritable falls back to a blob download
    // instead of throwing (the stale handle is cleared so later saves use the
    // download path). The fallback itself needs a DOM, which this environment
    // lacks, so tolerate its rejection — the identity invariant is what matters.
    await actions.saveFigFile().catch(() => {})

    expect(setSourceIdentity).not.toHaveBeenCalled()
    expect(setFileHandle).toHaveBeenCalledWith(null)
  })
})
