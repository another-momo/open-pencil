import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  consumeCredential,
  forgetCredential,
  MemoryCredentialStore,
  putCredential,
  resetCredentialStore,
  setCredentialStore
} from '#agent/credentials'
import { chatRoute } from '#agent/routes/chat'

const app = chatRoute()

async function postChat(body: unknown) {
  const request = new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  return app.fetch(request)
}

const validBody = {
  id: 'chat-1',
  messages: [{ role: 'user', content: 'hi' }],
  agent: {
    connectionId: 'conn-CHAT',
    providerID: 'anthropic',
    modelID: 'm',
    customModelID: '',
    customBaseURL: '',
    customAPIType: 'completions',
    maxOutputTokens: 4096,
    chatMode: 'design',
    lookImagesKept: 0
  }
}

describe('chatRoute validation', () => {
  beforeEach(() => {
    setCredentialStore(new MemoryCredentialStore())
  })
  afterEach(() => {
    forgetCredential('conn-CHAT')
    forgetCredential('conn-MISSING-KEY')
    resetCredentialStore()
  })

  test('returns 400 for invalid JSON body', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json'
    })
    const response = await app.fetch(request)
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/Invalid JSON body/)
  })

  test('returns 400 when messages is missing', async () => {
    const response = await postChat({ id: 'chat-1', agent: validBody.agent })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/messages\[\] is required/)
  })

  test('returns 400 when messages is not an array', async () => {
    const response = await postChat({ ...validBody, messages: 'oops' })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/messages\[\] is required/)
  })

  test('returns 400 when id is missing', async () => {
    const response = await postChat({
      messages: validBody.messages,
      agent: validBody.agent
    })
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/id is required/)
  })
})

describe('chatRoute brandSelection decoding', () => {
  beforeEach(() => {
    setCredentialStore(new MemoryCredentialStore())
  })
  afterEach(() => {
    forgetCredential('conn-CHAT')
    resetCredentialStore()
  })

  // brandSelection decoding happens AFTER messages[] and id validation
  // but BEFORE the bridge call, so the response we see here is the
  // "agent not running" 503 — the selection was accepted (or rejected)
  // before that branch. We assert the selection acceptance/rejection by
  // looking at whether the response surfaces the bridge error vs the
  // shape-error.
  //
  // Bridge call requires a running mcp server with discovery file. We
  // can't easily stand one up in unit tests, so these tests focus on
  // decodeBrandSelection's contract via observable behavior.

  test('legacy/unknown fields are dropped (treated as no selection)', async () => {
    // The decode function only reads pickedProfileId — anything else is
    // ignored, so the route proceeds just as if no selection was sent.
    // We can't observe the decode result from outside, so this test only
    // verifies the route doesn't 4xx/500 on a legacy-shaped selection.
    putCredential('conn-CHAT', 'sk-test')
    const response = await postChat({
      ...validBody,
      brandSelection: { userPickedProfileId: 'p1', hasReferencesPage: false }
    })
    // Will be 503 (bridge can't connect) — proves we passed decode without
    // a 4xx decode error.
    expect(response.status).toBe(503)
  })

  test('well-formed brandSelection is accepted', async () => {
    putCredential('conn-CHAT', 'sk-test')
    const response = await postChat({
      ...validBody,
      brandSelection: { pickedProfileId: 'p1' }
    })
    expect(response.status).toBe(503)
  })

  test('null brandSelection is accepted (no selection is a valid state)', async () => {
    putCredential('conn-CHAT', 'sk-test')
    const response = await postChat({ ...validBody, brandSelection: null })
    expect(response.status).toBe(503)
  })
})

describe('chatRoute credential lookup', () => {
  beforeEach(() => {
    setCredentialStore(new MemoryCredentialStore())
  })
  afterEach(() => {
    forgetCredential('conn-CHAT')
    forgetCredential('conn-MISSING-KEY')
    resetCredentialStore()
  })

  // The credential lookup happens AFTER bridge connect. We can't observe
  // the "API key not available" response without a running bridge either,
  // but we can at least confirm consumeCredential sees what was PUT via
  // /v1/auth (which we tested separately).
  test('consumeCredential returns null for an unknown connectionId', () => {
    expect(consumeCredential('conn-MISSING-KEY')).toBeNull()
  })

  test('consumeCredential returns the key after putCredential', () => {
    putCredential('conn-CHAT', 'sk-test')
    expect(consumeCredential('conn-CHAT')).toBe('sk-test')
  })
})
