/**
 * In-memory credential registry for the agent backend (P0).
 *
 * The frontend POSTs `{ connectionId, apiKey }` to `/v1/auth` and the
 * backend holds the key in memory for the duration of the chat session.
 * When the agent process restarts (or the TTL expires) the frontend must
 * re-publish the key.
 *
 * This is a deliberate compromise for the "local CLI backend + localhost
 * web UI" form factor: the frontend still owns the CredentialStore, the
 * backend never persists anything. The OS keychain path is tracked in
 * P1 — this module is the single seam.
 */

const TTL_MS = 60 * 60 * 1000

type Entry = { value: string; expiresAt: number }

const store = new Map<string, Entry>()

export function putCredential(connectionId: string, apiKey: string): { expiresIn: number } {
  store.set(connectionId, { value: apiKey, expiresAt: Date.now() + TTL_MS })
  return { expiresIn: TTL_MS / 1000 }
}

export function consumeCredential(connectionId: string): string | null {
  const entry = store.get(connectionId)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    store.delete(connectionId)
    return null
  }
  return entry.value
}

export function forgetCredential(connectionId: string): void {
  store.delete(connectionId)
}

export function activeConnectionCount(): number {
  let count = 0
  const now = Date.now()
  for (const [, entry] of store) {
    if (entry.expiresAt >= now) count++
  }
  return count
}