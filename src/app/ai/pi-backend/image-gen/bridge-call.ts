/**
 * T54（Phase 3 W2/T-B3）：generate_image 后端编排的桥调用助手。
 *
 * 与 pi-backend/tools.ts callBridgeTool 同语义（discovery 读取 → POST /rpc →
 * {ok,result}/{ok:false,error}，连接失败/401 单次重读 discovery 重试），两点差异：
 *  1. 显式 fetch 超时：桥 RPC 超时（packages/mcp/src/browser-rpc.ts，
 *     OPENPENCIL_RPC_TIMEOUT_MS，缺省 300s）+ 60s 余量——生图链路 240s 级，
 *     裸 fetch 无超时会无限悬挂（tools.ts 既有段不在本任务改动面，集成期可
 *     归并共用，见 T54 报告）
 *  2. 独立模块：tools.ts 的 callBridgeTool 为私有且该文件属集成期接线面，
 *     本任务不改。
 *
 * key 卫生：本模块只搬运工具参数（图像字节 base64 / 节点 id / 尺寸），
 * 凭证永不进桥 payload（红线）。
 */

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

/** 桥 RPC 缺省超时本地副本（与 packages/mcp/src/browser-rpc.ts DEFAULT_RPC_TIMEOUT_MS
 * 保持一致，tests/engine/rebuild/image-gen/rpc-timeout.test.ts 钉扎两者一致） */
export const BRIDGE_RPC_DEFAULT_TIMEOUT_MS = 300_000
/** fetch 在桥 RPC 超时之上再加的余量（桥内超时先触发并回 502，fetch 兜底防悬挂） */
export const BRIDGE_FETCH_MARGIN_MS = 60_000

export function bridgeCallTimeoutMs(): number {
  const rpcTimeout = Number(process.env.OPENPENCIL_RPC_TIMEOUT_MS) || BRIDGE_RPC_DEFAULT_TIMEOUT_MS
  return rpcTimeout + BRIDGE_FETCH_MARGIN_MS
}

export type BridgeCallResult = Record<string, unknown>

export type BridgeCaller = (
  toolName: string,
  toolArgs: Record<string, unknown>,
  target?: { documentId?: string }
) => Promise<BridgeCallResult>

type BridgeAttempt =
  | { ok: true; result: BridgeCallResult }
  | { ok: false; retryable: boolean; message: string }

async function attemptBridgeCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  target?: { documentId?: string }
): Promise<BridgeAttempt> {
  const discovery = await readDiscoveryFile()
  if (!discovery) {
    return {
      ok: false,
      retryable: false,
      message:
        '7600 桥 discovery 文件不存在或已过期——确认 dev server 已启动（MCP server 随 vite 拉起）'
    }
  }

  // documentId 注入桥 args 外层 document_id（同 tools.ts T22 D4 语义；
  // 缺省落当前活动 tab）
  const documentId = target?.documentId
  const args = documentId ? { ...toolArgs, document_id: documentId } : toolArgs

  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (discovery.authToken) headers.authorization = `Bearer ${discovery.authToken}`
  const endpoint = `http://127.0.0.1:${discovery.httpPort}/rpc`
  const payload = { command: 'tool', args: { name: toolName, args } }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(bridgeCallTimeoutMs())
    })
  } catch (error) {
    // 单次重试覆盖「桥在两次调用间重启、端口/token 漂移」窗口（重读 discovery）
    return {
      ok: false,
      retryable: true,
      message: `7600 桥连接失败（${error instanceof Error ? error.message : String(error)}）——确认 dev server 已启动`
    }
  }

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    result?: BridgeCallResult
    error?: string
  } | null

  if (response.status === 401) {
    // 401 唯一可恢复场景 = 桥重启换 token（重读 discovery 后再试一次）
    return {
      ok: false,
      retryable: true,
      message: '7600 桥鉴权失败（401）——discovery token 与运行中实例不匹配，重启 dev server'
    }
  }
  if (!response.ok || body?.ok !== true) {
    const upstream = body?.error ?? `HTTP ${response.status}`
    const offlineHint =
      response.status === 502 ? '——确认浏览器已打开 app（编辑器需在线才能执行工具）' : ''
    return { ok: false, retryable: false, message: `7600 桥执行失败：${upstream}${offlineHint}` }
  }
  return { ok: true, result: body.result ?? {} }
}

export function createBridgeCaller(): BridgeCaller {
  return async (toolName, toolArgs, target) => {
    // 最多两次尝试：retryable（连接失败/401）时第二轮重读 discovery
    for (let attempt = 0; attempt < 2; attempt++) {
      const outcome = await attemptBridgeCall(toolName, toolArgs, target)
      if (outcome.ok) return outcome.result
      if (!outcome.retryable || attempt === 1) throw new Error(outcome.message)
    }
    throw new Error('unreachable')
  }
}
