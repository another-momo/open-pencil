/**
 * T66（P0/P1/P2）：generate_image 凭证 HTTP 面钉扎（真 HTTP server + fetch，
 * 同 tests/engine/mcp/stdio/auth.test.ts 先例——不 mock req/res）——
 * POST 四键（providerType/baseUrl/model/apiKey）校验与空 key 清除分派；
 * POST /test 连接探针端点（探针注入 mock：成功/失败/无 key 400；
 * 表单缺省字段回落已存凭证——key 不回前端的配套通路）。
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createImageGenCredentialStore,
  type ImageGenCredentialStatus,
  type ImageGenCredentialStore
} from '@/app/ai/pi-backend/image-gen/credentials'
import type { ImageGenProbeResult } from '@/app/ai/pi-backend/image-gen/provider'
import { handleImageGenAdminRequest } from '@/app/ai/pi-backend/image-gen/routes'

const VALID_BODY = {
  providerType: 'openai-compatible',
  baseUrl: 'https://api.example.com/v1',
  model: 'gpt-image-1',
  apiKey: 'sk-route-test'
}

function tempAgentDir(): { agentDir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'openpencil-imagegen-routes-'))
  return { agentDir: dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

type ProbeFn = (options: { baseUrl: string; apiKey: string }) => Promise<ImageGenProbeResult>

/** 挂 handler 起真 server；handler 返回 false 时落 404（钉路径分派契约） */
async function withServer(
  store: ImageGenCredentialStore,
  probe: ProbeFn,
  run: (baseURL: string) => Promise<void>
): Promise<void> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    void handleImageGenAdminRequest(store, req, res, url.pathname, probe).then((handled) => {
      if (!handled) res.writeHead(404).end('Not Found')
      return undefined
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const { port } = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
}

function postJSON(baseURL: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${baseURL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
}

const unusedProbe: ProbeFn = async () => ({ ok: true })

describe('POST /api/pi/image-gen/credentials（四键）', () => {
  test('四键齐全 → set 落盘；GET status 回 providerType/baseUrl/model 且不回 key', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      await withServer(store, unusedProbe, async (baseURL) => {
        const saved = await postJSON(baseURL, '/api/pi/image-gen/credentials', VALID_BODY)
        expect(saved.status).toBe(200)
        expect(store.get()?.model).toBe('gpt-image-1')

        const statusResponse = await fetch(`${baseURL}/api/pi/image-gen/credentials`)
        const status = (await statusResponse.json()) as ImageGenCredentialStatus
        expect(status.configured).toBe(true)
        expect(status.providerType).toBe('openai-compatible')
        expect(status.baseUrl).toBe('https://api.example.com/v1')
        expect(JSON.stringify(status)).not.toContain('sk-route-test')
      })
    } finally {
      cleanup()
    }
  })

  test('缺字段 → 400（providerType/baseUrl/model 必填）', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      await withServer(store, unusedProbe, async (baseURL) => {
        for (const body of [
          { apiKey: 'sk-x' },
          { providerType: 'openai-compatible', apiKey: 'sk-x' },
          { providerType: 'openai-compatible', baseUrl: 'https://a.com/v1', apiKey: 'sk-x' },
          { ...VALID_BODY, providerType: 'unknown-protocol' }
        ]) {
          const response = await postJSON(baseURL, '/api/pi/image-gen/credentials', body)
          expect(response.status).toBe(400)
        }
        expect(store.get()).toBeNull()
      })
    } finally {
      cleanup()
    }
  })

  test('空 apiKey = 清除（00 #7；其余字段不校验）', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set(VALID_BODY)
      await withServer(store, unusedProbe, async (baseURL) => {
        const response = await postJSON(baseURL, '/api/pi/image-gen/credentials', { apiKey: '  ' })
        expect(response.status).toBe(200)
        expect(store.get()).toBeNull()
      })
    } finally {
      cleanup()
    }
  })

  test('DELETE → clear；非本面路径 → handler false → 404', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set(VALID_BODY)
      await withServer(store, unusedProbe, async (baseURL) => {
        const deleted = await fetch(`${baseURL}/api/pi/image-gen/credentials`, {
          method: 'DELETE'
        })
        expect(deleted.status).toBe(200)
        expect(store.get()).toBeNull()
        const other = await fetch(`${baseURL}/api/pi/other`)
        expect(other.status).toBe(404)
      })
    } finally {
      cleanup()
    }
  })
})

describe('POST /api/pi/image-gen/test（连接探针）', () => {
  test('探针成功 → 200 {ok:true, modelCount}；baseUrl/key 用表单值', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      const probeCalls: Array<{ baseUrl: string; apiKey: string }> = []
      await withServer(
        store,
        async (input) => {
          probeCalls.push(input)
          return { ok: true, modelCount: 3 }
        },
        async (baseURL) => {
          const response = await postJSON(baseURL, '/api/pi/image-gen/test', {
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-form-key'
          })
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ ok: true, modelCount: 3 })
          expect(probeCalls).toEqual([
            { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-form-key' }
          ])
        }
      )
    } finally {
      cleanup()
    }
  })

  test('探针失败 → 200 {ok:false, error}（成败显式回显由 UI 消费）', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      await withServer(
        store,
        async () => ({ ok: false, error: 'Invalid API key' }),
        async (baseURL) => {
          const response = await postJSON(baseURL, '/api/pi/image-gen/test', {
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'sk-bad'
          })
          expect(response.status).toBe(200)
          expect(await response.json()).toEqual({ ok: false, error: 'Invalid API key' })
        }
      )
    } finally {
      cleanup()
    }
  })

  test('表单空字段回落已存凭证（key 不回前端的配套：已存 key 可直接探）', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      store.set(VALID_BODY)
      const probeCalls: Array<{ baseUrl: string; apiKey: string }> = []
      await withServer(
        store,
        async (input) => {
          probeCalls.push(input)
          return { ok: true }
        },
        async (baseURL) => {
          const response = await postJSON(baseURL, '/api/pi/image-gen/test', {})
          expect(response.status).toBe(200)
          expect(probeCalls).toEqual([
            { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-route-test' }
          ])
        }
      )
    } finally {
      cleanup()
    }
  })

  test('表单与已存皆无 key → 400；test 面非 POST → 405', async () => {
    const { agentDir, cleanup } = tempAgentDir()
    try {
      const store = createImageGenCredentialStore({ agentDir })
      await withServer(store, unusedProbe, async (baseURL) => {
        const noKey = await postJSON(baseURL, '/api/pi/image-gen/test', {
          baseUrl: 'https://api.example.com/v1'
        })
        expect(noKey.status).toBe(400)
        const getTest = await fetch(`${baseURL}/api/pi/image-gen/test`)
        expect(getTest.status).toBe(405)
      })
    } finally {
      cleanup()
    }
  })
})
