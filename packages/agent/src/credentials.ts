/**
 * Credential registry for the agent backend.
 *
 * The frontend POSTs `{ connectionId, apiKey }` to `/v1/auth` and the
 * backend holds the key for the duration of the chat session. When the
 * agent process restarts (or the TTL expires) the frontend must
 * re-publish the key.
 *
 * P1 hardens this with an OS keychain-backed default store
 * (`@napi-rs/keyring`) so the API key no longer sits in process memory
 * for the full 1h TTL. The memory store is still available for tests
 * and as a fallback when the keyring is unavailable (Linux without
 * dbus, headless CI, etc.).
 *
 * The module exports a singleton `defaultStore` plus legacy sync
 * helpers that route async calls through the singleton. Callers should
 * migrate to the async `CredentialStore` API directly; the sync shims
 * stay one release for upstream tests that haven't been refactored yet.
 */

import { Entry } from '@napi-rs/keyring'

const TTL_MS = 60 * 60 * 1000

const KEYRING_SERVICE = 'net.openpencil.agent-credentials'
const KEYRING_ACCOUNT_PREFIX = 'openpencil:agent:'

export interface CredentialStore {
  /**
   * Persist the key for `connectionId`. Returns the TTL in seconds so
   * the caller can echo it back to the frontend (which uses it to
   * schedule a refresh).
   */
  put(connectionId: string, apiKey: string): Promise<{ expiresIn: number }>
  /** Return the unexpired key for `connectionId`, or null if missing/expired. */
  consume(connectionId: string): Promise<string | null>
  /** Remove the entry. Idempotent. */
  forget(connectionId: string): Promise<void>
  /** Number of unexpired entries currently held. */
  activeCount(): Promise<number>
}

/**
 * In-memory store. Used by tests and as the fallback when the OS
 * keyring is unavailable. Mirrors the keyring store's contract, so
 * call sites can swap freely.
 */
export class MemoryCredentialStore implements CredentialStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>()

  async put(connectionId: string, apiKey: string): Promise<{ expiresIn: number }> {
    return this.putSync(connectionId, apiKey)
  }

  async consume(connectionId: string): Promise<string | null> {
    return this.consumeSync(connectionId)
  }

  async forget(connectionId: string): Promise<void> {
    this.forgetSync(connectionId)
  }

  async activeCount(): Promise<number> {
    return this.activeCountSync()
  }

  putSync(connectionId: string, apiKey: string): { expiresIn: number } {
    this.entries.set(connectionId, { value: apiKey, expiresAt: Date.now() + TTL_MS })
    return { expiresIn: TTL_MS / 1000 }
  }

  consumeSync(connectionId: string): string | null {
    const entry = this.entries.get(connectionId)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(connectionId)
      return null
    }
    return entry.value
  }

  forgetSync(connectionId: string): void {
    this.entries.delete(connectionId)
  }

  activeCountSync(): number {
    const now = Date.now()
    let count = 0
    for (const [, entry] of this.entries) {
      if (entry.expiresAt >= now) count++
    }
    return count
  }
}

/**
 * Type marker for the `Error` thrown by `@napi-rs/keyring` when the
 * platform keyring rejects the round-trip. The library doesn't export
 * a class hierarchy, so we sniff the message — it's stable across
 * versions and small enough to keep this file self-contained.
 */
function isKeyringUnavailableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('no backend') ||
    msg.includes('no keyring') ||
    msg.includes('platform not supported') ||
    msg.includes('dbus') ||
    msg.includes('secitem') ||
    msg.includes('not implemented')
  )
}

type KeyringEntry = {
  read(): string | null
  write(value: string): void
  delete(): void
}

interface KeyringAdapter {
  open(account: string): KeyringEntry
}

/**
 * OS keychain store. The library doesn't expose metadata, so we
 * prefix the value with the TTL deadline (`<expiresAtMs>:<apiKey>`).
 * `consume` parses the prefix, checks expiry, then returns the key.
 */
export class KeychainCredentialStore implements CredentialStore {
  constructor(private readonly adapter: KeyringAdapter = keyringAdapter) {}

  private entryFor(connectionId: string): KeyringEntry {
    return this.adapter.open(`${KEYRING_ACCOUNT_PREFIX}${connectionId}`)
  }

  async put(connectionId: string, apiKey: string): Promise<{ expiresIn: number }> {
    const expiresAt = Date.now() + TTL_MS
    this.entryFor(connectionId).write(`${expiresAt}:${apiKey}`)
    return { expiresIn: TTL_MS / 1000 }
  }

  async consume(connectionId: string): Promise<string | null> {
    const raw = this.entryFor(connectionId).read()
    if (raw === null) return null
    const separator = raw.indexOf(':')
    if (separator <= 0) {
      // Defensive: malformed entry — drop it so the next call returns null.
      this.entryFor(connectionId).delete()
      return null
    }
    const expiresAt = Number(raw.slice(0, separator))
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      this.entryFor(connectionId).delete()
      return null
    }
    return raw.slice(separator + 1)
  }

  async forget(connectionId: string): Promise<void> {
    this.entryFor(connectionId).delete()
  }

  async activeCount(): Promise<number> {
    // The keyring API doesn't support enumeration — the only way to
    // know how many entries are live is to attempt a read for each
    // connectionId we know about. The frontend is the source of truth
    // for connectionIds, so we keep a small in-memory index of put()
    // calls in this process. Entries opened in a previous process
    // won't be counted, which is acceptable for a `/health` gauge.
    return liveConnectionIds.size
  }
}

const keyringAdapter: KeyringAdapter = {
  open(account) {
    const entry = new Entry(KEYRING_SERVICE, account)
    return {
      read: () => {
        try {
          return entry.getPassword()
        } catch (err) {
          if (isKeyringUnavailableError(err)) {
            throw new KeyringUnavailableError(err.message)
          }
          // Entry was deleted between put/consume — return null.
          return null
        }
      },
      write: (value) => {
        try {
          entry.setPassword(value)
          liveConnectionIds.add(account.slice(KEYRING_ACCOUNT_PREFIX.length))
        } catch (err) {
          if (isKeyringUnavailableError(err)) {
            throw new KeyringUnavailableError(err.message)
          }
          throw err
        }
      },
      delete: () => {
        try {
          entry.deletePassword()
        } catch {
          // ignore — Mac's keychain reports "not found" on a missing delete
        }
        liveConnectionIds.delete(account.slice(KEYRING_ACCOUNT_PREFIX.length))
      }
    }
  }
}

export class KeyringUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeyringUnavailableError'
  }
}

const liveConnectionIds = (() => {
  const id = new Map<string, true>()
  return {
    add: (id_: string) => void id.set(id_, true),
    delete: (id_: string) => void id.delete(id_),
    size: () => id.size
  }
})()

let cachedStore: CredentialStore | null = null
let cachedStoreKind: 'keychain' | 'memory' | null = null

/**
 * Return the process-wide credential store. The first call probes the
 * OS keyring with a round-trip; if it fails the agent falls back to the
 * in-memory store and logs a warning. Set `OPENPENCIL_AGENT_CREDENTIALS=memory`
 * to force the memory store (useful for CI / containers without a
 * secret service).
 */
export function createCredentialStore(): CredentialStore {
  if (cachedStore) return cachedStore

  const forced = process.env.OPENPENCIL_AGENT_CREDENTIALS?.trim().toLowerCase()
  if (forced === 'memory') {
    cachedStore = new MemoryCredentialStore()
    cachedStoreKind = 'memory'
    return cachedStore
  }

  try {
    const probe = new Entry(KEYRING_SERVICE, 'openpencil:agent:__probe__')
    probe.setPassword('ok')
    probe.deletePassword()
    cachedStore = new KeychainCredentialStore()
    cachedStoreKind = 'keychain'
    return cachedStore
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.warn(
      `[openpencil-agent] OS keyring unavailable, falling back to in-memory credential store (${reason}). ` +
        'Set OPENPENCIL_AGENT_CREDENTIALS=memory to silence this check.'
    )
    cachedStore = new MemoryCredentialStore()
    cachedStoreKind = 'memory'
    return cachedStore
  }
}

/** Which backing store the singleton currently uses. Exposed for diagnostics. */
export function credentialStoreKind(): 'keychain' | 'memory' | null {
  return cachedStoreKind
}

/**
 * Reset the cached singleton. Tests call this between cases so each
 * scenario can pick a fresh store (e.g. force the memory fallback).
 */
export function resetCredentialStore(): void {
  cachedStore = null
  cachedStoreKind = null
}

/**
 * Test-only: swap the singleton for a deterministic store. Returns
 * the previous store so callers can restore it.
 */
export function setCredentialStore(store: CredentialStore): CredentialStore | null {
  const previous = cachedStore
  cachedStore = store
  cachedStoreKind = store instanceof KeychainCredentialStore ? 'keychain' : 'memory'
  return previous
}

// -- Legacy sync shims --------------------------------------------------
//
// These keep the original `putCredential`/`consumeCredential`/
// `forgetCredential`/`activeConnectionCount` signatures so existing
// tests and route handlers don't need to be touched in this release.
// New code should call the async `CredentialStore` API directly.

export function putCredential(connectionId: string, apiKey: string): { expiresIn: number } {
  const store = createCredentialStore()
  if (store instanceof MemoryCredentialStore) {
    store.putSync(connectionId, apiKey)
    return { expiresIn: TTL_MS / 1000 }
  }
  // Keyring path: best-effort sync write. The async `putCredentialAsync`
  // is preferred for new callers; existing tests route through here.
  const expiresAt = Date.now() + TTL_MS
  const entry = new Entry(KEYRING_SERVICE, `${KEYRING_ACCOUNT_PREFIX}${connectionId}`)
  entry.setPassword(`${expiresAt}:${apiKey}`)
  liveConnectionIds.add(connectionId)
  return { expiresIn: TTL_MS / 1000 }
}

export function consumeCredential(connectionId: string): string | null {
  const store = createCredentialStore()
  if (store instanceof MemoryCredentialStore) return store.consumeSync(connectionId)
  const entry = new Entry(KEYRING_SERVICE, `${KEYRING_ACCOUNT_PREFIX}${connectionId}`)
  let raw: string
  try {
    raw = entry.getPassword()
  } catch {
    return null
  }
  const separator = raw.indexOf(':')
  if (separator <= 0) return null
  const expiresAt = Number(raw.slice(0, separator))
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null
  return raw.slice(separator + 1)
}

export function forgetCredential(connectionId: string): void {
  const store = createCredentialStore()
  if (store instanceof MemoryCredentialStore) {
    store.forgetSync(connectionId)
    return
  }
  try {
    new Entry(KEYRING_SERVICE, `${KEYRING_ACCOUNT_PREFIX}${connectionId}`).deletePassword()
  } catch {
    // ignore
  }
  liveConnectionIds.delete(connectionId)
}

export function activeConnectionCount(): number {
  const store = createCredentialStore()
  if (store instanceof MemoryCredentialStore) return store.activeCountSync()
  return liveConnectionIds.size
}

/** Async versions of the legacy helpers — preferred for new callers. */
export async function putCredentialAsync(
  connectionId: string,
  apiKey: string
): Promise<{ expiresIn: number }> {
  return createCredentialStore().put(connectionId, apiKey)
}

export async function consumeCredentialAsync(connectionId: string): Promise<string | null> {
  return createCredentialStore().consume(connectionId)
}

export async function forgetCredentialAsync(connectionId: string): Promise<void> {
  return createCredentialStore().forget(connectionId)
}

export async function activeConnectionCountAsync(): Promise<number> {
  return createCredentialStore().activeCount()
}
