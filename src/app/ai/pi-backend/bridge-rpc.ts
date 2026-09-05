/**
 * 7600 桥 /rpc POST 共享助手（T52 集成期消克隆：tools.ts callBridgeTool 与
 * undo-group.ts sendUndoGroupSignal 的 fetch 块逐 token 相同，jscpd 门禁拦下）。
 *
 * 只负责发请求并返回原始 Response；状态码解读/重试/错误文案归各调用方
 * （语义不同：tools.ts 会抛错重试，undo-group.ts 吞掉不阻断）。
 */

import type { DiscoveryInfo } from '@/app/automation/bridge/server/discovery'

export function postBridgeRPC(
  discovery: DiscoveryInfo,
  command: string,
  args: Record<string, unknown>
): Promise<Response> {
  return fetch(`http://127.0.0.1:${discovery.httpPort}/rpc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(discovery.authToken ? { authorization: `Bearer ${discovery.authToken}` } : {})
    },
    body: JSON.stringify({ command, args })
  })
}
