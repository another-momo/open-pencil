/**
 * T77 P6：image-gen provider mock fetch 共享夹具——
 * provider.test.ts（OpenAI 兼容族）+ provider-seedream.test.ts（Seedream 族）
 * 的 mockFetch 完全一致；提取到本文件避免 test:type-shapes
 * 「Duplicate object type shape」误判（两个文件 CapturedCall 形态字面
 * 一致即触发）。返回的 fetchImpl 已断言为 typeof fetch 便于类型层注入。
 */

export interface CapturedCall {
  url: string
  method?: string
  headers: HeadersInit | undefined
  body: BodyInit | null | undefined
  signal: AbortSignal | null | undefined
}

export function mockFetch(
  payload: unknown,
  status = 200
): {
  calls: CapturedCall[]
  fetchImpl: typeof fetch
} {
  const calls: CapturedCall[] = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: init?.headers,
      body: init?.body ?? null,
      signal: init?.signal ?? null
    })
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return new Response(body, {
      status,
      headers: { 'content-type': typeof payload === 'string' ? 'text/plain' : 'application/json' }
    })
  }
  return { calls, fetchImpl: fetchImpl as typeof fetch }
}
