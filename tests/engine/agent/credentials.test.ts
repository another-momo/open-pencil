import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'

import {
  activeConnectionCount,
  consumeCredential,
  consumeCredentialAsync,
  MemoryCredentialStore,
  putCredential,
  resetCredentialStore,
  setCredentialStore
} from '#agent/credentials'
import type { CredentialStore } from '#agent/credentials'

describe('credentials', () => {
  // Force the memory store so tests never touch the real OS keychain,
  // and so each block starts from a clean slate. The legacy sync shim
  // routes through whichever store is active.
  let store: MemoryCredentialStore
  beforeEach(() => {
    store = new MemoryCredentialStore()
    setCredentialStore(store)
  })
  afterEach(() => {
    resetCredentialStore()
    setSystemTime()
  })

  describe('MemoryCredentialStore (sync shim)', () => {
    test('putCredential / consumeCredential round-trip', () => {
      const { expiresIn } = putCredential('conn-A', 'sk-test-key')
      expect(expiresIn).toBe(3600)
      expect(consumeCredential('conn-A')).toBe('sk-test-key')
    })

    test('consumeCredential returns null for an unknown connectionId', () => {
      expect(consumeCredential('conn-NOPE')).toBeNull()
    })

    test('putCredential overwrites the previous value', () => {
      putCredential('conn-A', 'sk-old')
      putCredential('conn-A', 'sk-new')
      expect(consumeCredential('conn-A')).toBe('sk-new')
    })

    test('entries are isolated by connectionId', () => {
      putCredential('conn-A', 'sk-A')
      putCredential('conn-B', 'sk-B')
      expect(consumeCredential('conn-A')).toBe('sk-A')
      expect(consumeCredential('conn-B')).toBe('sk-B')
    })

    test('consumeCredential returns null after the 1h TTL elapses', () => {
      putCredential('conn-A', 'sk-test')
      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(consumeCredential('conn-A')).toBeNull()
      expect(activeConnectionCount()).toBe(0)
    })

    test('consumeCredential returns the key inside the TTL window', () => {
      putCredential('conn-A', 'sk-test')
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000))
      expect(consumeCredential('conn-A')).toBe('sk-test')
    })

    test('putCredential resets the TTL', () => {
      putCredential('conn-A', 'sk-old')
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000))
      putCredential('conn-A', 'sk-new')
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000 + 15 * 60 * 1000))
      expect(consumeCredential('conn-A')).toBe('sk-new')
    })

    test('forgetCredential removes the entry', () => {
      putCredential('conn-A', 'sk-test')
      expect(consumeCredential('conn-A')).toBe('sk-test')
      store.forgetSync('conn-A')
      expect(consumeCredential('conn-A')).toBeNull()
    })

    test('forgetCredential is a no-op for unknown ids', () => {
      expect(() => store.forgetSync('conn-NOPE')).not.toThrow()
    })

    test('activeConnectionCount only counts non-expired entries', () => {
      putCredential('conn-A', 'sk-A')
      putCredential('conn-B', 'sk-B')
      putCredential('conn-C', 'sk-C')
      expect(activeConnectionCount()).toBe(3)

      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(activeConnectionCount()).toBe(0)
    })

    test('activeConnectionCount returns 0 for an empty store', () => {
      expect(activeConnectionCount()).toBe(0)
    })
  })

  describe('MemoryCredentialStore (async API)', () => {
    let asyncStore: CredentialStore
    beforeEach(() => {
      asyncStore = new MemoryCredentialStore()
    })

    test('put / consume round-trip', async () => {
      const { expiresIn } = await asyncStore.put('conn-A', 'sk-test-key')
      expect(expiresIn).toBe(3600)
      expect(await asyncStore.consume('conn-A')).toBe('sk-test-key')
    })

    test('consume returns null after the TTL elapses', async () => {
      await asyncStore.put('conn-A', 'sk-test')
      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(await asyncStore.consume('conn-A')).toBeNull()
    })

    test('forget removes the entry', async () => {
      await asyncStore.put('conn-A', 'sk-test')
      await asyncStore.forget('conn-A')
      expect(await asyncStore.consume('conn-A')).toBeNull()
    })

    test('activeCount counts only live entries', async () => {
      await asyncStore.put('conn-A', 'sk-A')
      await asyncStore.put('conn-B', 'sk-B')
      expect(await asyncStore.activeCount()).toBe(2)
      await asyncStore.forget('conn-A')
      expect(await asyncStore.activeCount()).toBe(1)
    })
  })

  describe('async convenience helpers', () => {
    test('consumeCredentialAsync reflects the most recent put', async () => {
      store.putSync('conn-A', 'sk-test')
      expect(await consumeCredentialAsync('conn-A')).toBe('sk-test')
    })
  })

  // Integration test against the real OS keyring. Enabled with
  // RUN_KEYRING_TESTS=1. The store mutates the user's keychain — we
  // use a uniquely-prefixed connectionId so we never collide with the
  // Tauri side (which uses a different service name) and clean up after
  // ourselves.
  describe.skipIf(!process.env.RUN_KEYRING_TESTS)('KeychainCredentialStore (integration)', () => {
    let store: CredentialStore
    const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join('')
    const testId = `test-${Date.now()}-${randomSuffix}`

    beforeEach(async () => {
      const { KeychainCredentialStore } = await import('#agent/credentials')
      store = new KeychainCredentialStore()
      await store.forget(testId)
    })
    afterEach(async () => {
      await store.forget(testId)
    })

    test('put / consume / forget round-trip on the real keyring', async () => {
      const { expiresIn } = await store.put(testId, 'sk-secret-key')
      expect(expiresIn).toBe(3600)
      expect(await store.consume(testId)).toBe('sk-secret-key')
      await store.forget(testId)
      expect(await store.consume(testId)).toBeNull()
    })

    test('consume returns null after the TTL elapses', async () => {
      await store.put(testId, 'sk-secret-key')
      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(await store.consume(testId)).toBeNull()
    })
  })
})
