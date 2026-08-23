/**
 * T20/T21 pi 自定义工具 → 7600 桥 → 活编辑器执行。
 *
 * 链路（注册期 recon 实证，见 docs/rebuild/tasks/T20-self-check.md §2.1）：
 *  1. pi session 注册 customTools（service.ts），noTools: 'builtin' 只禁内建
 *  2. LLM 调起工具 → execute() 在本进程执行
 *  3. readDiscoveryFile()（@open-pencil/mcp/discovery）拿 7600 桥的端口与 token
 *  4. POST /rpc {command:'tool', args:{name, args}} → MCP server 经 WS 中继给
 *     浏览器编辑器（WorkspaceView mount 时自动连桥）→ core ALL_TOOLS 执行
 *  5. 返回 {ok, result} / {ok:false, error}，包装为 AgentToolResult
 *
 * T21：工具集从 hello-tool 单件扩为旧 ToolLoop 等价全集——CORE_TOOLS 21 +
 * extended 白名单 4（get_components / list_libraries /
 * insert_library_component / create_shape；前三者与旧 src/app/ai/tools/
 * index.ts:98-104 白名单一致，create_shape 为 T20 hello-tool 保留）。
 * schema 经 paramToTypeBox 从 core ParamDef 迷你 schema 生成（仿 MCP 侧
 * paramToZod 先例 packages/mcp/src/tool/schema.ts），core registry 保持
 * 单一事实源。
 *
 * T21 step budget：旧 MAX_AGENT_STEPS=50 语义平移——每 prompt 计 turn 数
 * （service.ts 在 turn_start 事件递增），剩余 ≤5 时往工具结果注 _warning
 * （文案照抄旧 ai-adapter.ts appendStepWarning）。pi 无 maxTurns 硬限
 * （agent-core 全量 grep 零命中，2026-08-24），硬停能力不再。
 *
 * 仅运行于独立后端进程（bun 直跑，workspace 包导入可用）；token 只经
 * discovery 文件读取（平台目录 0o700 / 文件 0o600），不打印、不落盘他处。
 */

import { defineTool, type AgentToolResult } from '@earendil-works/pi-coding-agent'
import { Type, type TSchema } from 'typebox'

import { CORE_TOOLS, EXTENDED_TOOLS, type ParamDef, type ToolDef } from '@open-pencil/core/tools'
import { readDiscoveryFile } from '@open-pencil/mcp/discovery'

const EXTENDED_WHITELIST = [
  'get_components',
  'list_libraries',
  'insert_library_component',
  'create_shape'
] as const

export const MAX_AGENT_STEPS = 50
const STEP_WARNING_THRESHOLD = 5

/** 每 session 的 turn 计数源（service 在 prompt 时清零、turn_start 时递增） */
export type StepBudgetSource = {
  current(): number
}

type BridgeToolResult = Record<string, unknown>

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

function paramToTypeBox(param: ParamDef): TSchema {
  const description = param.description
  let schema: TSchema
  switch (param.type) {
    case 'string':
      schema = param.enum
        ? Type.Union(
            param.enum.map((v) => Type.Literal(v)),
            { description }
          )
        : Type.String({ description })
      break
    case 'number':
      schema = Type.Number({
        description,
        ...(param.min !== undefined ? { minimum: param.min } : {}),
        ...(param.max !== undefined ? { maximum: param.max } : {})
      })
      break
    case 'boolean':
      schema = Type.Boolean({ description })
      break
    case 'color':
      schema = Type.String({ description })
      break
    case 'string[]':
      schema = Type.Array(Type.String(), { minItems: 1, description })
      break
  }
  return param.required ? schema : Type.Optional(schema)
}

function maybeAppendStepWarning(
  result: BridgeToolResult,
  budget: StepBudgetSource | undefined
): BridgeToolResult {
  if (!budget) return result
  const remaining = MAX_AGENT_STEPS - budget.current()
  if (remaining > STEP_WARNING_THRESHOLD) return result
  const warning = `⚠ ${remaining} steps remaining out of ${MAX_AGENT_STEPS}. Wrap up: finish critical fixes, skip polish. User can send "continue" for more steps.`
  return { ...result, _warning: warning }
}

function toolLabel(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function defineBridgeTool(def: ToolDef, budget: StepBudgetSource | undefined) {
  const shape: Record<string, TSchema> = {}
  for (const [key, param] of Object.entries(def.params)) {
    shape[key] = paramToTypeBox(param)
  }
  return defineTool({
    name: def.name,
    label: toolLabel(def.name),
    description: def.description,
    parameters: Type.Object(shape),
    async execute(_toolCallId, params): Promise<AgentToolResult<BridgeToolResult>> {
      const result = maybeAppendStepWarning(await callBridgeTool(def.name, { ...params }), budget)
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        details: result
      }
    }
  })
}

export function createOpenPencilTools(budget?: StepBudgetSource) {
  const toolSet = [
    ...CORE_TOOLS,
    ...EXTENDED_TOOLS.filter((def) => (EXTENDED_WHITELIST as readonly string[]).includes(def.name))
  ]
  return toolSet.map((def) => defineBridgeTool(def, budget))
}
