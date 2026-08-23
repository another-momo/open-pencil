/**
 * T21 P2 pi 后端管理 API 前端客户端。
 *
 * 对应 server.ts 的 admin 路由（vite proxy '/api/pi' → 127.0.0.1:7700）：
 *   GET    /api/pi/catalog                 → PiCatalog（含每个 provider 的 auth 状态）
 *   POST   /api/pi/credentials  {providerId, apiKey}
 *   DELETE /api/pi/credentials  {providerId}
 *   POST   /api/pi/providers    CustomProviderInput
 *
 * 凭据只进不出：catalog 里只有 configured/type/source，绝不回传 key 本体。
 * 本模块自带 DTO 类型（不 import 后端 provider-admin，避免浏览器侧打进 node 依赖）。
 */

import { ref } from 'vue'

export type PiThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export type PiModelSpec = {
  providerId: string
  modelId: string
  thinkingLevel?: PiThinkingLevel
}

export type PiCatalogModel = {
  id: string
  name: string
  api?: string
  reasoning?: boolean
  input?: string[]
  contextWindow?: number
  maxTokens?: number
  cost?: { input?: number; output?: number }
}

export type PiCatalogProvider = {
  id: string
  name: string
  baseUrl?: string
  auth: { configured: boolean; type?: string; source?: string }
  models: PiCatalogModel[]
}

export type PiCatalog = { providers: PiCatalogProvider[] }

export type PiCustomProviderInput = {
  id: string
  name?: string
  baseUrl: string
  api?: string
  models: string[]
}

const API_PREFIX = '/api/pi'

export const piCatalog = ref<PiCatalog | null>(null)
export const piCatalogError = ref<string | null>(null)
export const piCatalogLoading = ref(false)

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

function jsonBody(payload: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }
}

export async function refreshPiCatalog(): Promise<void> {
  piCatalogLoading.value = true
  piCatalogError.value = null
  try {
    piCatalog.value = await requestJSON<PiCatalog>('/catalog')
  } catch (error) {
    piCatalog.value = null
    piCatalogError.value = error instanceof Error ? error.message : String(error)
  } finally {
    piCatalogLoading.value = false
  }
}

export async function setPiCredential(providerId: string, apiKey: string): Promise<void> {
  await requestJSON<{ ok: true }>('/credentials', jsonBody({ providerId, apiKey }))
  await refreshPiCatalog()
}

export async function clearPiCredential(providerId: string): Promise<void> {
  const response = await fetch(`${API_PREFIX}/credentials`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ providerId })
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }
  await refreshPiCatalog()
}

export async function upsertPiProvider(input: PiCustomProviderInput): Promise<void> {
  await requestJSON<{ ok: true }>('/providers', jsonBody(input))
  await refreshPiCatalog()
}
