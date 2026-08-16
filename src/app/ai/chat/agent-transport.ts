import { useLocalStorage } from '@vueuse/core'

import { IS_BROWSER } from '@open-pencil/core/constants'

import type { AIProviderID } from '@open-pencil/core/constants'

import type { ChatMode } from '@/app/ai/marketing/settings'

export type AgentBackendInfo = {
  /** Base URL of the agent backend, e.g. http://127.0.0.1:7601 */
  baseUrl: string
  /** Per-tab stable connection id the backend uses to retrieve credentials. */
  connectionId: string
  /** Backend-reported version, surfaced for diagnostics. */
  version: string | null
}

export type AgentChatConfig = {
  connectionId: string
  providerID: AIProviderID
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  maxOutputTokens: number
  chatMode: ChatMode
  lookImagesKept: number
}

const PROBE_TTL_MS = 5_000
const PROBE_TIMEOUT_MS = 800
const AGENT_URL_STORAGE_KEY = 'open-pencil:agent-url'
const CONNECTION_ID_STORAGE_KEY = 'open-pencil:agent-connection-id'

let cached: { info: AgentBackendInfo; expiresAt: number } | null = null
let inflight: Promise<AgentBackendInfo | null> | null = null

export function isAgentBackendDisabled(): boolean {
  // Build-time only: Vite replaces `import.meta.env.OPENPENCIL_AGENT_DISABLE`
  // with the literal value at bundle time. Set `OPENPENCIL_AGENT_DISABLE=1`
  // in `.env.local` to skip the probe entirely.
  const env = import.meta.env as { OPENPENCIL_AGENT_DISABLE?: unknown } | undefined
  return env?.OPENPENCIL_AGENT_DISABLE === '1'
}

export async function probeAgentBackend(): Promise<AgentBackendInfo | null> {
  if (!IS_BROWSER) return null
  if (isAgentBackendDisabled()) return null
  if (cached && cached.expiresAt > Date.now()) return cached.info
  if (inflight) return inflight

  inflight = (async () => {
    const url = resolveAgentBackendURL()
    if (!url) return null
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
      const res = await fetch(`${url}/health`, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) return null
      const body = (await res.json().catch(() => ({}))) as { version?: unknown }
      const info: AgentBackendInfo = {
        baseUrl: url,
        connectionId: getOrCreateConnectionId(),
        version: typeof body.version === 'string' ? body.version : null
      }
      cached = { info, expiresAt: Date.now() + PROBE_TTL_MS }
      return info
    } catch (error) {
      console.warn('[agent-transport] probe failed:', error)
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

function resolveAgentBackendURL(): string | null {
  const fromWindow = windowAgentURL()
  if (fromWindow) return fromWindow.replace(/\/$/, '')
  const fromStorage = readAgentURL()
  if (fromStorage) return fromStorage.replace(/\/$/, '')
  return 'http://127.0.0.1:7601'
}

function windowAgentURL(): string | null {
  const w = globalThis as { __OPENPENCIL_AGENT_URL__?: unknown }
  const value = w.__OPENPENCIL_AGENT_URL__
  return typeof value === 'string' && value ? value : null
}

function readAgentURL(): string | null {
  try {
    const value = agentURLStorage.value
    return value && value.trim() ? value : null
  } catch {
    return null
  }
}

const agentURLStorage = useLocalStorage<string>(AGENT_URL_STORAGE_KEY, '')
const connectionIdStorage = useLocalStorage<string>(CONNECTION_ID_STORAGE_KEY, '')

function getOrCreateConnectionId(): string {
  try {
    if (connectionIdStorage.value) return connectionIdStorage.value
    const id = `web-${crypto.randomUUID()}`
    connectionIdStorage.value = id
    return id
  } catch (error) {
    console.warn('[agent-transport] getOrCreateConnectionId fallback:', error)
    return `web-${Date.now().toString(36)}-${cryptoFallback()}`
  }
}

/**
 * Push the current API key to the agent backend before a chat session is
 * opened. Idempotent — the backend deduplicates by `connectionId`. The
 * key TTL is 1h; the frontend re-publishes each time it opens a chat.
 */
export async function provisionAgentCredential(
  info: AgentBackendInfo,
  apiKey: string | null
): Promise<void> {
  if (!apiKey) return
  try {
    await fetch(`${info.baseUrl}/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: info.connectionId, apiKey })
    })
  } catch (error) {
    console.warn('[agent-transport] provisionAgentCredential failed:', error)
  }
}

export function resetAgentBackendCache(): void {
  cached = null
}

function cryptoFallback(): string {
  try {
    return crypto.randomUUID().slice(0, 8)
  } catch {
    return 'fallback'
  }
}