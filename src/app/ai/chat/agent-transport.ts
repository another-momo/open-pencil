import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

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
const AGENT_MODE_STORAGE_KEY = 'open-pencil:agent-mode'

/**
 * How the frontend picks between the local agent backend (Path A,
 * preferred) and the in-browser fallback (Path B, legacy).
 *
 * - `'backend'` (default): probe `/health` once on chat open. If the
 *   backend is reachable, route every chat through it. If it isn't,
 *   surface an actionable error — do NOT silently downgrade to
 *   in-browser mode. This is what the user expects after
 *   `bun run dev` brought the backend up.
 * - `'browser'`: always run the agent loop in the browser. Useful for
 *   testing in-browser behavior, debugging Path B itself, or running
 *   in environments where the agent process can't be spawned.
 * - `'auto'`: probe; if unreachable, silently fall back to in-browser.
 *   This is the legacy behavior; kept as an explicit opt-in for
 *   transitional setups (e.g. running the web build against a remote
 *   MCP server without the local agent).
 */
export type AgentMode = 'backend' | 'browser' | 'auto'

const agentModeStorage = useLocalStorage<AgentMode>(AGENT_MODE_STORAGE_KEY, 'backend')

/**
 * Reactive agent-mode ref. Read/write goes through this so Vue
 * components re-render on change and `watch` callbacks fire.
 *
 * Defensive read rejects any non-enum value (e.g. legacy localStorage
 * from before the setting existed) back to the `'backend'` default.
 */
export const agentMode = computed<AgentMode>({
  get: () => {
    const value = agentModeStorage.value
    return value === 'backend' || value === 'browser' || value === 'auto' ? value : 'backend'
  },
  set: (value) => {
    agentModeStorage.value = value
  }
})

export function getAgentMode(): AgentMode {
  return agentMode.value
}

export function setAgentMode(mode: AgentMode): void {
  agentMode.value = mode
}

let cached: { info: AgentBackendInfo; expiresAt: number } | null = null
let inflight: Promise<AgentBackendInfo | null> | null = null

export function isAgentBackendDisabled(): boolean {
  // Build-time only: Vite replaces `import.meta.env.OPENPENCIL_AGENT_DISABLE`
  // with the literal value at bundle time. Set `OPENPENCIL_AGENT_DISABLE=1`
  // in `.env.local` to skip the probe entirely.
  const env = import.meta.env as { OPENPENCIL_AGENT_DISABLE?: unknown } | undefined
  return env?.OPENPENCIL_AGENT_DISABLE === '1'
}

let forcedBackend: AgentBackendInfo | null = null

/**
 * Test hook: pin `probeAgentBackend` to a specific backend without
 * running the HTTP probe. Pass `null` to restore probe-based
 * discovery. Designed for e2e specs that stand up a mock agent
 * server with `Bun.serve` and don't want to wait for the probe to
 * discover it.
 */
export function setForcedAgentBackend(info: AgentBackendInfo | null): void {
  forcedBackend = info
  resetAgentBackendCache()
}

export function getForcedAgentBackend(): AgentBackendInfo | null {
  return forcedBackend
}

export async function probeAgentBackend(): Promise<AgentBackendInfo | null> {
  // Check window presence at call time (not module-load time) so the
  // test harness can stub `globalThis.window` after imports resolve.
  if (typeof window === 'undefined') return null
  if (isAgentBackendDisabled()) return null
  // Browser mode never talks to the backend.
  if (getAgentMode() === 'browser') return null
  if (forcedBackend) return forcedBackend
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
      if (!res.ok) {
        console.warn(`[agent-transport] /health responded ${res.status} from ${url}`)
        return null
      }
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

export function resolveAgentBackendURL(): string | null {
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