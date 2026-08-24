/**
 * T24 聊天模式 + style profile 选择态（T24-plan D7/D8 薄 UI 的状态核）：
 *
 *  - piChatMode / piPickedProfileId：用户选择，useLocalStorage 持久化
 *    （照 aiModelSettings 的 storage.ts 先例，键 open-pencil:pi-chat-mode）。
 *  - piBrandManifest：GET /api/pi/brand/manifest 拉取缓存（失败 → null →
 *    profile 下拉降级空态、后端 overlay 走 fallback）；markdown 正文不下发
 *    （信任边界，brand/manifest.ts）。
 *
 * pickedProfileId 不随模式切回 ui 而清空——用户回切 marketing 时选择还在；
 * 后端按注册表 acceptsProfile 决定忽略与否。
 */

import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { PiBrandManifest } from '@/app/ai/pi-backend/brand/manifest'
import type { PiChatMode } from '@/app/ai/pi-backend/chat-mode'

type PiChatModeSelection = {
  mode: PiChatMode
  pickedProfileId: string | null
}

const stored = useLocalStorage<PiChatModeSelection>(
  'open-pencil:pi-chat-mode',
  { mode: 'ui', pickedProfileId: null },
  { serializer: StorageSerializers.object, writeDefaults: false }
)

export const piChatMode = computed<PiChatMode>({
  get: () => (stored.value.mode === 'marketing' ? 'marketing' : 'ui'),
  set: (mode) => {
    stored.value = { ...stored.value, mode }
  }
})

export const piPickedProfileId = computed<string | null>({
  get: () =>
    typeof stored.value.pickedProfileId === 'string' ? stored.value.pickedProfileId : null,
  set: (pickedProfileId) => {
    stored.value = { ...stored.value, pickedProfileId }
  }
})

export const piBrandManifest = ref<PiBrandManifest | null>(null)

let manifestRequested = false

/** 拉取 manifest（进程内一次；失败 → null 降级，不重试不轮询） */
export async function ensurePiBrandManifest(): Promise<void> {
  if (manifestRequested) return
  manifestRequested = true
  try {
    const res = await fetch('/api/pi/brand/manifest')
    if (!res.ok) return
    piBrandManifest.value = (await res.json()) as PiBrandManifest
  } catch (error) {
    console.warn('[pi-backend] brand manifest 拉取失败——profile 下拉降级为空态', error)
  }
}
