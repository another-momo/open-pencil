import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

/**
 * Tests for the agent mode setting that controls Path A (backend) vs
 * Path B (in-browser) routing.
 *
 * The `agent-transport.ts` module is loaded with `IS_BROWSER = true`
 * and an in-memory localStorage so we can exercise the real
 * `getAgentMode` / `setAgentMode` / `probeAgentBackend` flow without
 * hitting the network or DOM.
 */

// In-memory localStorage that survives across the test run.
class MemoryStorage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

const memoryStorage = new MemoryStorage()

// Bun provides globalThis.window as undefined; we need a minimal stub
// for `useLocalStorage` (vueuse) which reads `window.localStorage`.
;(globalThis as { window?: object }).window = { localStorage: memoryStorage }
;(globalThis as { localStorage?: MemoryStorage }).localStorage = memoryStorage

// Import after stubbing window so useLocalStorage (vueuse) reads our
// in-memory storage.
const {
  agentMode,
  getAgentMode,
  setAgentMode,
  probeAgentBackend,
  resetAgentBackendCache,
  isAgentBackendDisabled
} = await import('@/app/ai/chat/agent-transport')

afterEach(() => {
  memoryStorage.clear()
  resetAgentBackendCache()
  setAgentMode('backend')
})

beforeEach(() => {
  memoryStorage.clear()
  resetAgentBackendCache()
  setAgentMode('backend')
})

describe('AgentMode storage', () => {
  test('default is "backend"', () => {
    expect(getAgentMode()).toBe('backend')
  })

  test('setAgentMode round-trips in-memory', () => {
    setAgentMode('browser')
    expect(getAgentMode()).toBe('browser')
    setAgentMode('auto')
    expect(getAgentMode()).toBe('auto')
    setAgentMode('backend')
    expect(getAgentMode()).toBe('backend')
  })

  test('agentMode is reactive (computed ref)', () => {
    expect(agentMode.value).toBe('backend')
    setAgentMode('browser')
    expect(agentMode.value).toBe('browser')
  })

  test('rejects unknown localStorage values, falls back to "backend"', () => {
    memoryStorage.setItem('open-pencil:agent-mode', 'something-invalid')
    expect(getAgentMode()).toBe('backend')
  })
})

describe('probeAgentBackend respects agentMode', () => {
  let originalFetch: typeof fetch
  let fetchCalls: string[]

  beforeEach(() => {
    originalFetch = globalThis.fetch
    fetchCalls = []
    globalThis.fetch = (async (url: string | URL | Request) => {
      fetchCalls.push(String(url))
      return new Response(JSON.stringify({ status: 'ok', version: '0.14.0' }), { status: 200 })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('mode="browser" → probe returns null without hitting /health', async () => {
    setAgentMode('browser')
    const info = await probeAgentBackend()
    expect(info).toBeNull()
    expect(fetchCalls).toHaveLength(0)
  })

  test('mode="backend" → probe hits /health and returns info', async () => {
    setAgentMode('backend')
    const info = await probeAgentBackend()
    expect(info).not.toBeNull()
    expect(info!.baseUrl).toBe('http://127.0.0.1:7601')
    expect(fetchCalls.some((u) => u.endsWith('/health'))).toBe(true)
  })

  test('mode="auto" → probe hits /health (caller decides fallback)', async () => {
    setAgentMode('auto')
    const info = await probeAgentBackend()
    expect(info).not.toBeNull()
  })

  test('mode="backend" with /health returning non-OK → probe returns null, no throw', async () => {
    setAgentMode('backend')
    globalThis.fetch = (async () =>
      new Response('upstream broken', { status: 503 })) as typeof fetch
    const info = await probeAgentBackend()
    expect(info).toBeNull()
  })

  test('mode="backend" with fetch throwing → probe returns null, no throw', async () => {
    setAgentMode('backend')
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch
    const info = await probeAgentBackend()
    expect(info).toBeNull()
  })
})

describe('isAgentBackendDisabled', () => {
  test('returns false by default', () => {
    expect(isAgentBackendDisabled()).toBe(false)
  })
})
