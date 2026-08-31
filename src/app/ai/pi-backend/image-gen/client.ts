/**
 * T54（Phase 3 W2/T-B3）：generate_image 凭证面前端客户端（同构——
 * 只依赖 fetch/vue ref，不引 node 模块；vite proxy '/api/pi' → 7700）。
 *
 * 凭据只进不出：状态只有 configured/presetId/baseUrl/model 元数据，
 * 后端永不回传 key 本体（对应 image-gen/routes.ts）。
 */

import { ref } from 'vue'

import { IMAGE_GEN_PRESETS, type ImageGenPreset } from './presets'

export { DEFAULT_IMAGE_GEN_PRESET_ID, IMAGE_GEN_PRESETS } from './presets'
export type { ImageGenPreset }

// DTO 单源在 ./credentials（type-only import 构建期擦除，node 依赖不进浏览器包——
// 同 T27 catalog.ts 先例）
import type { ImageGenCredentialStatus } from './credentials'

export type { ImageGenCredentialStatus }

const API_PATH = '/api/pi/image-gen/credentials'

export const imageGenCredentialStatus = ref<ImageGenCredentialStatus | null>(null)
export const imageGenCredentialError = ref<string | null>(null)
export const imageGenCredentialLoading = ref(false)

async function requestJSON<T>(init?: RequestInit): Promise<T> {
  const response = await fetch(API_PATH, init)
  if (response.ok) return (await response.json()) as T
  const envelope = (await response.json().catch(() => null)) as { error?: string } | null
  const detail = envelope?.error?.trim() ? envelope.error : `HTTP ${response.status}`
  throw new Error(detail)
}

export async function refreshImageGenCredentialStatus(): Promise<void> {
  imageGenCredentialLoading.value = true
  imageGenCredentialError.value = null
  try {
    imageGenCredentialStatus.value = await requestJSON<ImageGenCredentialStatus>()
  } catch (error) {
    imageGenCredentialStatus.value = null
    imageGenCredentialError.value = error instanceof Error ? error.message : String(error)
  } finally {
    imageGenCredentialLoading.value = false
  }
}

/** 空 key = 清除（00 #7：清除必须生效） */
export async function setImageGenCredential(presetId: string, apiKey: string): Promise<void> {
  await requestJSON<{ ok: true }>({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ presetId, apiKey })
  })
  await refreshImageGenCredentialStatus()
}

export async function clearImageGenCredential(): Promise<void> {
  await requestJSON<{ ok: true }>({ method: 'DELETE' })
  await refreshImageGenCredentialStatus()
}

export function imageGenPresetById(presetId: string): ImageGenPreset | undefined {
  return IMAGE_GEN_PRESETS.find((preset) => preset.id === presetId)
}
