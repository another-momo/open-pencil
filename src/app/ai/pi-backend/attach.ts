/**
 * T19 选路接线：VITE_PI_BACKEND=1 时把 Chat 的 transport 切到 pi 后端。
 *
 * 走既有 override 钩子（browser-bridge.ts exposeChatTransportOverride，与 e2e
 * mock 注入同一条管道），因此 transports.ts / use.ts / ChatPanel.vue 零改动。
 * 副作用顺序：本模块显式 import '@/app/ai/chat/use'，保证 window.openPencil
 * .setChatTransport 已暴露后再注册工厂。
 *
 * sessionId 每 tab 稳定：sessionStorage 存 UUID，刷新 / HMR 后复用同一后端
 * session（SessionManager JSONL 落盘恢复）。session↔文件绑定归 T22。
 */

import { IS_BROWSER } from '@open-pencil/core/constants'

import '@/app/ai/chat/use'
import { loadPiBackendSessionId } from '@/app/ai/chat/storage'
import { PiBackendChatTransport } from '@/app/ai/pi-backend/transport'

export function attachPiBackendTransport(): void {
  if (!IS_BROWSER || import.meta.env.VITE_PI_BACKEND !== '1') return

  const setChatTransport = window.openPencil?.setChatTransport
  if (!setChatTransport) {
    throw new Error('pi-backend: window.openPencil.setChatTransport hook unavailable')
  }

  const sessionId = loadPiBackendSessionId()
  setChatTransport(() => new PiBackendChatTransport(sessionId))
}
