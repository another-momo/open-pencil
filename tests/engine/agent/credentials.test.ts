import { afterEach, describe, expect, setSystemTime, test } from 'bun:test'

import {
  activeConnectionCount,
  consumeCredential,
  forgetCredential,
  putCredential
} from '#agent/credentials'

describe('credentials', () => {
  afterEach(() => {
    // Reset the module-level store between tests by deleting every id we
    // might have introduced. forgetCredential is idempotent so it's safe
    // to call with ids that don't exist.
    for (const id of ['conn-A', 'conn-B', 'conn-C']) forgetCredential(id)
    setSystemTime()
  })

  describe('putCredential / consumeCredential', () => {
    test('stores and returns the API key for the matching connectionId', () => {
      const { expiresIn } = putCredential('conn-A', 'sk-test-key')
      expect(expiresIn).toBe(3600)
      expect(consumeCredential('conn-A')).toBe('sk-test-key')
    })

    test('returns null for an unknown connectionId', () => {
      expect(consumeCredential('conn-NOPE')).toBeNull()
    })

    test('overwrites the previous value when called twice with the same id', () => {
      putCredential('conn-A', 'sk-old')
      putCredential('conn-A', 'sk-new')
      expect(consumeCredential('conn-A')).toBe('sk-new')
    })

    test('isolates entries by connectionId', () => {
      putCredential('conn-A', 'sk-A')
      putCredential('conn-B', 'sk-B')
      expect(consumeCredential('conn-A')).toBe('sk-A')
      expect(consumeCredential('conn-B')).toBe('sk-B')
    })
  })

  describe('TTL expiration', () => {
    test('consumeCredential returns null after the 1h TTL elapses', () => {
      putCredential('conn-A', 'sk-test')
      // Freeze time 1h + 1ms past expiry; the entry should be treated as
      // gone and removed from the store as a side-effect.
      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(consumeCredential('conn-A')).toBeNull()
      expect(activeConnectionCount()).toBe(0)
    })

    test('consumeCredential still returns the key inside the TTL window', () => {
      putCredential('conn-A', 'sk-test')
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000)) // 30 minutes in
      expect(consumeCredential('conn-A')).toBe('sk-test')
    })

    test('putCredential resets the TTL', () => {
      putCredential('conn-A', 'sk-old')
      // Half-way through the first TTL, refresh.
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000))
      putCredential('conn-A', 'sk-new')
      // 45 minutes after refresh (1h15m total) — still inside the new window.
      setSystemTime(new Date(Date.now() + 30 * 60 * 1000 + 15 * 60 * 1000))
      expect(consumeCredential('conn-A')).toBe('sk-new')
    })
  })

  describe('forgetCredential', () => {
    test('removes the entry so subsequent consumeCredential returns null', () => {
      putCredential('conn-A', 'sk-test')
      forgetCredential('conn-A')
      expect(consumeCredential('conn-A')).toBeNull()
    })

    test('is a no-op for unknown connectionIds', () => {
      expect(() => forgetCredential('conn-NOPE')).not.toThrow()
    })
  })

  describe('activeConnectionCount', () => {
    test('counts only non-expired entries', () => {
      putCredential('conn-A', 'sk-A')
      putCredential('conn-B', 'sk-B')
      putCredential('conn-C', 'sk-C')
      expect(activeConnectionCount()).toBe(3)

      // All three were inserted in the same instant and share the same
      // expiresAt — past the 1h window every entry is gone.
      setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1))
      expect(activeConnectionCount()).toBe(0)
    })

    test('returns 0 for an empty store', () => {
      expect(activeConnectionCount()).toBe(0)
    })
  })
})
