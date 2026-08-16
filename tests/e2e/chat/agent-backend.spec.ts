import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/**
 * Path A e2e: spin up a mock agent backend with `Bun.serve`, then
 * pin the frontend to it via `window.openPencil.setAgentBackend`.
 * The frontend should hit `/v1/auth` to publish the credential, then
 * stream `/v1/chat` SSE responses through the chat panel.
 *
 * Skipped when `TEST_REAL_LLM` or `RUN_AGENT_E2E` is not set: CI on
 * platforms without a real backend process should run the existing
 * Path B spec (panel.spec.ts) instead.
 */

const RUN_E2E = process.env.RUN_AGENT_E2E === '1'

test.describe('agent backend (Path A)', () => {
  test.skip(!RUN_E2E, 'set RUN_AGENT_E2E=1 to run Path A spec')

  let page: Page
  let canvas: CanvasHelper
  let mockPort: number
  let mockServer: { stop: () => void; authHits: () => number; chatHits: () => number }

  test.beforeAll(async ({ browser }) => {
    mockServer = await startMockAgentServer()
    mockPort = mockServer.port

    page = await browser.newPage()
    await page.goto('/')
    canvas = new CanvasHelper(page)
    await canvas.waitForInit()

    // Pin the frontend to the mock backend before the chat is opened.
    await page.evaluate((info) => {
      const setAgentBackend = window.openPencil?.setAgentBackend
      if (!setAgentBackend) throw new Error('setAgentBackend injection not available')
      setAgentBackend(info)
    }, {
      baseUrl: `http://127.0.0.1:${mockPort}`,
      connectionId: 'e2e-conn',
      version: 'mock-0.0.0'
    })
  })

  test.afterAll(async () => {
    await page?.close()
    mockServer?.stop()
  })

  test('auth + chat SSE reach the mock backend', async () => {
    // Open AI tab, configure OpenRouter with a fake key.
    await page.getByRole('tab', { name: 'AI' }).click()
    await page.getByTestId('provider-setup-open-settings').click()
    await page.getByTestId('settings-model-provider').click()
    await page.getByRole('option', { name: 'OpenRouter' }).click()
    await page.getByLabel('Name').fill('E2E Claude')
    await page.getByTestId('provider-settings-api-key').fill('sk-e2e-test-key')
    await page.getByRole('button', { name: 'Save model' }).click()
    await page.getByTestId('app-settings-done').click()

    const input = page.locator('input[placeholder="Describe a change…"]')
    await input.waitFor()
    await input.fill('Hello agent')
    await input.press('Enter')

    // Mock sends `start → text-delta → finish`. The UI should surface
    // the streamed text.
    await expect(page.getByText('mock agent response', { exact: false })).toBeVisible({
      timeout: 5000
    })

    // Allow the auth + chat requests a moment to land before asserting.
    await expect(() => {
      expect(mockServer.authHits()).toBeGreaterThan(0)
      expect(mockServer.chatHits()).toBeGreaterThan(0)
    }).toPass({ timeout: 3000 })
  })
})

async function startMockAgentServer() {
  // Use Bun.serve if available (matches the agent bundle's runtime);
  // fall back to a tiny Node http server for non-bun Playwright runs.
  const authHits = { count: 0 }
  const chatHits = { count: 0 }

  // Bun.serve isn't on the global in Node — duck-type check.
  const bun = (globalThis as { Bun?: { serve: (o: unknown) => unknown } }).Bun
  if (!bun) {
    throw new Error('RUN_AGENT_E2E requires Bun runtime for the mock server')
  }

  const server = bun.serve({
    port: 0,
    async fetch(request: Request) {
      const url = new URL(request.url)
      if (url.pathname === '/health') {
        return Response.json({ status: 'ok', version: 'mock-0.0.0' })
      }
      if (url.pathname === '/v1/auth' && request.method === 'POST') {
        authHits.count++
        return Response.json({ ok: true, expiresIn: 3600 })
      }
      if (url.pathname === '/v1/chat' && request.method === 'POST') {
        chatHits.count++
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(
              'data: {"type":"start","messageId":"mock-1"}\n\n'
            ))
            controller.enqueue(new TextEncoder().encode(
              'data: {"type":"text-delta","id":"text-1","delta":"mock agent response"}\n\n'
            ))
            controller.enqueue(new TextEncoder().encode(
              'data: {"type":"finish","finishReason":"stop"}\n\n'
            ))
            controller.close()
          }
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          }
        })
      }
      return new Response('not found', { status: 404 })
    }
  })

  return {
    port: server.port,
    stop: () => server.stop(true),
    authHits: () => authHits.count,
    chatHits: () => chatHits.count
  }
}
