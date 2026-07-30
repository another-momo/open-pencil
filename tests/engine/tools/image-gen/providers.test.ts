import { afterEach, describe, expect, test } from 'bun:test'

import { getActiveImageGenProvider, setImageGenCredentials } from '#core/tools/image-gen/providers'
import type { ImageGenProvider } from '#core/tools/image-gen/providers'

const B64 = 'iVBORw0KGgo='

interface FetchCall {
  url: string
  init: RequestInit
}

function stubFetch(handler: (call: FetchCall) => Response): FetchCall[] {
  const calls: FetchCall[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string
    if (typeof input === 'string') url = input
    else if (input instanceof URL) url = input.href
    else url = input.url
    const call = { url, init: init ?? {} }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
  return calls
}

function okResponse(): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: B64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function activeProvider(): ImageGenProvider {
  setImageGenCredentials('test-key')
  const provider = getActiveImageGenProvider()
  if (!provider) throw new Error('provider not registered')
  return provider
}

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

interface GenerationsBody {
  moderation?: string
  background?: string
  output_compression?: number
}

function jsonBody(init: RequestInit): GenerationsBody {
  if (typeof init.body !== 'string') throw new Error('expected a JSON string body')
  return JSON.parse(init.body) as GenerationsBody
}

describe('dmxImageProvider', () => {
  test('generations path sends JSON body with moderation/background and numeric output_compression', async () => {
    const calls = stubFetch(() => okResponse())

    await activeProvider().generate({
      prompt: 'cat',
      width: 1024,
      height: 1024,
      outputFormat: 'jpeg',
      outputCompression: 80
    })

    expect(calls[0].url).toContain('/images/generations')
    const body = jsonBody(calls[0].init)
    expect(body.moderation).toBe('auto')
    expect(body.background).toBe('auto')
    expect(typeof body.output_compression).toBe('number')
    expect(body.output_compression).toBe(80)
  })

  test('edits path sends multipart image[] fields and string output_compression', async () => {
    const calls = stubFetch(() => okResponse())

    await activeProvider().generate(
      { prompt: 'edit', width: 1024, height: 1024, outputFormat: 'webp', outputCompression: 70 },
      [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]
    )

    expect(calls[0].url).toContain('/images/edits')
    const form = calls[0].init.body as FormData
    expect(form.getAll('image[]')).toHaveLength(2)
    expect(form.get('image')).toBeNull()
    expect(form.get('moderation')).toBe('auto')
    expect(form.get('background')).toBe('auto')
    expect(form.get('output_compression')).toBe('70')
  })

  test('output_compression is omitted for png output', async () => {
    const calls = stubFetch(() => okResponse())

    await activeProvider().generate({
      prompt: 'cat',
      width: 1024,
      height: 1024,
      outputFormat: 'png',
      outputCompression: 80
    })

    const body = jsonBody(calls[0].init)
    expect('output_compression' in body).toBe(false)
  })

  test('API error surfaces the real message from the response body', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ error: { message: 'size not supported' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    )

    await expect(
      activeProvider().generate({ prompt: 'cat', width: 1024, height: 1024 })
    ).rejects.toThrow('size not supported')
  })

  test('API error with string body is surfaced as-is', async () => {
    stubFetch(() => new Response('moderation blocked', { status: 400 }))

    await expect(
      activeProvider().generate({ prompt: 'cat', width: 1024, height: 1024 })
    ).rejects.toThrow('moderation blocked')
  })
})
