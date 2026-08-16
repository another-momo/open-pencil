import type { ChatTransport, UIMessage } from 'ai'

import type { AgentBackendInfo } from '@/app/ai/chat/agent-transport'
import type { EditorStore } from '@/app/editor/session/create'

export interface OpenPencilTestHooks {
  writeCount?: () => number
  mockHandle?: FileSystemFileHandle
  savedOpen?: Window['open']
}

export interface OpenPencilWindowAPI {
  getStore?: () => EditorStore
  setChatTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
  /**
   * Pin the frontend's agent-backend URL to a specific server (e.g.
   * a mock launched by an e2e spec). Pass `null` to restore probe-based
   * discovery. The frontend's chat transport will use this info
   * instead of probing `/health` on the default port.
   */
  setAgentBackend?: (info: AgentBackendInfo | null) => void
  test?: OpenPencilTestHooks
}

declare global {
  interface Window {
    openPencil?: OpenPencilWindowAPI
  }
}

let activeStore: EditorStore | null = null

function windowAPI(): OpenPencilWindowAPI {
  window.openPencil ??= {}
  window.openPencil.getStore ??= () => {
    if (!activeStore) throw new Error('OpenPencil store not initialized')
    return activeStore
  }
  return window.openPencil
}

export function setOpenPencilStore(store: EditorStore) {
  activeStore = store
  windowAPI()
}

export function exposeChatTransportOverride(
  setChatTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowAPI().setChatTransport = setChatTransport
}

export function setOpenPencilOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowAPI().openFile = openFile
}

export function setOpenPencilAgentBackend(
  setAgentBackend: (info: AgentBackendInfo | null) => void
) {
  windowAPI().setAgentBackend = setAgentBackend
}
