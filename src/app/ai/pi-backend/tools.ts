/**
 * T20 hello-tool：pi 自定义工具 → 7600 桥 → 活编辑器执行。
 *
 * 链路（注册期 recon 实证，见 docs/rebuild/tasks/T20-self-check.md §2.1）：
 *  1. pi session 注册 customTools（service.ts），noTools: 'builtin' 只禁内建
 *  2. LLM 调起 create_shape → execute() 在本进程执行
 *  3. readDiscoveryFile()（@open-pencil/mcp/discovery）拿 7600 桥的端口与 token
 *  4. POST /rpc {command:'tool', args:{name, args}} → MCP server 经 WS 中继给
 *     浏览器编辑器（WorkspaceView mount 时自动连桥）→ core ALL_TOOLS 执行
 *  5. 返回 {ok, result} / {ok:false, error}，包装为 AgentToolResult
 *
 * 仅运行于独立后端进程（bun 直跑，workspace 包导入可用）；token 只经
 * discovery 文件读取（平台目录 0o700 / 文件 0o600），不打印、不落盘他处。
 */

import { defineTool, type AgentToolResult } from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'

import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

type BridgeToolResult = {
  id?: string
  name?: string
  type?: string
  children?: string[]
}

async function callBridgeTool(
  toolName: string,
  toolArgs: Record<string, unknown>,
  allowRetry = true
): Promise<BridgeToolResult> {
  const discovery = await readDiscoveryFile()
  if (!discovery) {
    throw new Error(
      '7600 桥 discovery 文件不存在或已过期——确认 dev server 已启动（MCP server 随 vite 拉起）'
    )
  }

  let res: Response
  try {
    res = await fetch(`http://127.0.0.1:${discovery.httpPort}/rpc`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(discovery.authToken ? { authorization: `Bearer ${discovery.authToken}` } : {})
      },
      body: JSON.stringify({ command: 'tool', args: { name: toolName, args: toolArgs } })
    })
  } catch (error) {
    if (allowRetry) return callBridgeTool(toolName, toolArgs, false)
    throw new Error(
      `7600 桥连接失败（${error instanceof Error ? error.message : String(error)}）——确认 dev server 已启动`
    )
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean
    result?: BridgeToolResult
    error?: string
  } | null

  if (res.status === 401) {
    if (allowRetry) return callBridgeTool(toolName, toolArgs, false)
    throw new Error('7600 桥鉴权失败（401）——discovery token 与运行中实例不匹配，重启 dev server')
  }
  if (!res.ok || body?.ok !== true) {
    const upstream = body?.error ?? `HTTP ${res.status}`
    throw new Error(
      `7600 桥执行失败：${upstream}` +
        (res.status === 502 ? '——确认浏览器已打开 app（编辑器需在线才能执行工具）' : '')
    )
  }
  return body.result ?? {}
}

export function createOpenPencilTools() {
  return [
    defineTool({
      name: 'create_shape',
      label: 'Create Shape',
      description:
        'Create a shape on the open-pencil canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels, LINE for rules and dividers. Coordinates are canvas pixels.',
      parameters: Type.Object({
        type: Type.Union([
          Type.Literal('FRAME'),
          Type.Literal('RECTANGLE'),
          Type.Literal('ELLIPSE'),
          Type.Literal('TEXT'),
          Type.Literal('LINE'),
          Type.Literal('STAR'),
          Type.Literal('POLYGON'),
          Type.Literal('SECTION')
        ]),
        x: Type.Number({ description: 'X position on canvas' }),
        y: Type.Number({ description: 'Y position on canvas' }),
        width: Type.Number({ minimum: 1, description: 'Width in pixels' }),
        height: Type.Number({ minimum: 1, description: 'Height in pixels' }),
        name: Type.Optional(Type.String({ description: 'Node name shown in layers panel' }))
      }),
      async execute(_toolCallId, params): Promise<AgentToolResult<{ nodeId?: string }>> {
        const result = await callBridgeTool('create_shape', { ...params })
        const summary = result.id
          ? `Created ${result.type ?? params.type} "${result.name ?? params.name ?? ''}" (id=${result.id}) at (${params.x}, ${params.y}), ${params.width}×${params.height}`
          : `Created ${params.type} at (${params.x}, ${params.y}), ${params.width}×${params.height}`
        return {
          content: [{ type: 'text', text: summary }],
          details: { nodeId: result.id, ...result }
        }
      }
    })
  ]
}
