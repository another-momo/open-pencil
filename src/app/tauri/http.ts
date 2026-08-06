interface ProxyHttpHeader {
  name: string
  value: string
}

interface ProxyHttpRequest {
  url: string
  method?: string
  headers?: ProxyHttpHeader[]
  body?: number[]
  max_response_bytes?: number
  follow_redirects?: boolean
  timeout_ms?: number
}

interface ProxyHttpResponseMeta {
  status: number
  headers: ProxyHttpHeader[]
  url: string
}

function headersToProxyHeaders(headers: Headers): ProxyHttpHeader[] {
  return [...headers.entries()].map(([name, value]) => ({ name, value }))
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError')
}

export function withAbortSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => undefined)
    return Promise.reject(abortReason(signal))
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      cleanup()
      reject(abortReason(signal))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void (async () => {
      try {
        const value = await promise
        cleanup()
        resolve(value)
      } catch (error) {
        cleanup()
        reject(
          error instanceof Error
            ? error
            : new Error('Desktop HTTP request failed', { cause: error })
        )
      }
    })()
  })
}

export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxResponseBytes?: number,
  timeoutMs?: number
): Promise<Response> {
  const request = new Request(input, init)
  request.signal.throwIfAborted()
  const { invoke } = await import('@tauri-apps/api/core')
  const payload: ProxyHttpRequest = {
    url: request.url,
    method: request.method,
    headers: headersToProxyHeaders(request.headers),
    body: request.body == null ? undefined : [...new Uint8Array(await request.arrayBuffer())],
    max_response_bytes: maxResponseBytes,
    follow_redirects: request.redirect === 'follow',
    timeout_ms: timeoutMs
  }
  request.signal.throwIfAborted()
  const raw = await withAbortSignal(
    invoke<Uint8Array>('proxy_http_request', { request: payload }),
    request.signal
  )
  // The command returns [4-byte LE meta length][JSON meta][raw body].
  const metaLen = new DataView(raw.buffer, raw.byteOffset).getUint32(0, true)
  const meta = JSON.parse(
    new TextDecoder().decode(raw.subarray(4, 4 + metaLen))
  ) as ProxyHttpResponseMeta
  const proxiedResponse = new Response(new Uint8Array(raw.subarray(4 + metaLen)), {
    status: meta.status,
    headers: meta.headers.map(({ name, value }): [string, string] => [name, value])
  })
  Object.defineProperty(proxiedResponse, 'url', { value: meta.url })
  return proxiedResponse
}
