import type { EditorState } from '@open-pencil/core/editor'

import type { StorageDocumentBinding } from '@/app/integrations/storage/types'
import { persistStorageCanvasLocally } from '@/app/storage/sync/persist'
import { isTauri } from '@/app/tauri/env'

type WriteDocumentState = EditorState & { documentName: string }

type DocumentWriterOptions = {
  state: WriteDocumentState
  getFilePath: () => string | null
  getFileHandle: () => FileSystemFileHandle | null
  setFileHandle: (handle: FileSystemFileHandle | null) => void
  getStorageBinding: () => StorageDocumentBinding | null
  setSavedVersion: (version: number) => void
  setLastWriteTime: (time: number) => void
  onWriteFallback?: (data: Uint8Array) => void
}

export function createDocumentWriter({
  state,
  getFilePath,
  getFileHandle,
  setFileHandle,
  getStorageBinding,
  setSavedVersion,
  setLastWriteTime,
  onWriteFallback
}: DocumentWriterOptions) {
  return async function writeFile(data: Uint8Array): Promise<boolean> {
    setLastWriteTime(Date.now())
    const storage = getStorageBinding()
    if (storage) {
      await persistStorageCanvasLocally({
        providerId: storage.providerId,
        canvasId: storage.documentId,
        name: state.documentName || 'Untitled',
        figBytes: data
      })
      setSavedVersion(state.sceneVersion)
      return true
    }

    const filePath = getFilePath()
    const fileHandle = getFileHandle()
    if (filePath && isTauri()) {
      const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
      await tauriWrite(filePath, data)
      setSavedVersion(state.sceneVersion)
      return true
    }
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable()
        await writable.write(new Uint8Array(data))
        await writable.close()
        setSavedVersion(state.sceneVersion)
        return true
      } catch {
        setFileHandle(null)
        if (onWriteFallback) {
          onWriteFallback(data)
        }
      }
    }
    return false
  }
}
