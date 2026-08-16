import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { MEDIA_OUTPUT_TOOLS, paramToValibot } from '@open-pencil/core/tools'
import type { ToolDef, ToolSet } from '@open-pencil/core/tools'

import type { FrontendBridge } from './bridge/ws-client.js'

/**
 * Mirror of `packages/core/src/tools/ai-adapter.ts#toolsToAI` — but with
 * `execute` replaced by an RPC dispatch through the editor's automation
 * bridge. The agent backend has no SceneGraph access; tool execution still
 * happens inside the editor's WebSocket handler, which already wraps the
 * result in `{ ok, result }`.
 *
 * The frontend `tool-handlers.ts:43-56` returns `{ ok: true, result }`,
 * so we just unwrap and return `result` (or `{ error }`) to the AI SDK.
 */

interface MediaToolOutput {
  base64: string
  mimeType: string
  note?: string
}

function isMediaToolOutput(output: unknown): output is MediaToolOutput {
  return (
    !!output &&
    typeof output === 'object' &&
    'base64' in output &&
    'mimeType' in output &&
    typeof (output as MediaToolOutput).base64 === 'string'
  )
}

export function bridgeToolsToAI(tools: ToolDef[], bridge: FrontendBridge): ToolSet {
  const result: ToolSet = {}

  for (const def of tools) {
    const shape: Record<string, unknown> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToValibot(v, param)
    }

    const toolOpts: Record<string, unknown> = {
      description: def.description,
      inputSchema: valibotSchema(v.object(shape as Record<string, never>)),
      execute: async (args: Record<string, unknown>, options: { abortSignal?: AbortSignal } = {}) => {
        try {
          const response = await bridge.sendRPC('tool', { name: def.name, args }, options.abortSignal)
          if (response.ok) {
            return response.result
          }
          return { error: response.error ?? 'Tool execution failed' }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    }

    if (MEDIA_OUTPUT_TOOLS.has(def.name)) {
      toolOpts.toModelOutput = ({ output }: { output: unknown }) => {
        if (isMediaToolOutput(output)) {
          const value: Array<Record<string, unknown>> = []
          if (output.note) value.push({ type: 'text', text: output.note })
          value.push({ type: 'media', mediaType: output.mimeType, data: output.base64 })
          return { type: 'content' as const, value }
        }
        return { type: 'json' as const, value: output as Record<string, unknown> }
      }
    }

    result[def.name] = tool(toolOpts as never)
  }

  return result
}