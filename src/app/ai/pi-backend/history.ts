/**
 * T22 历史回填读取面（T22-plan D3）：pi JSONL 会话文件 → UIMessage[]。
 *
 * 只读路径，零副作用：fs 读盘 + pi 根导出的纯函数 parseSessionEntries
 * （session-manager.d.ts:145/169 实测，T22-self-check §2.5-15）。刻意不经
 * SessionManager.open / createAgentSession——前者对旧版本文件会迁移重写、
 * 后者恢复时写 thinking_level_change（sdk.js:233-237），都会污染运行中会话。
 *
 * 最小保真（D3）：user/assistant 文本 + 工具卡片；reasoning（thinking）
 * 不回填；toolResult 独立 role 按 toolCallId 折叠回 assistant 的 tool part。
 */

import { readFileSync } from 'node:fs'

import { parseSessionEntries } from '@earendil-works/pi-coding-agent'
import type { UIMessage } from 'ai'

/** pi AgentMessage 的结构化窄投影（含 coding-agent 自定义 role 的并集在此只关心这三种） */
type PiHistoryMessage = {
  role: string
  content?:
    | string
    | Array<{
        type: string
        text?: string
        id?: string
        name?: string
        arguments?: Record<string, unknown>
      }>
  toolCallId?: string
  details?: unknown
  isError?: boolean
}

type ToolPart = {
  type: string
  toolCallId: string
  state: string
  input: unknown
  output?: unknown
  errorText?: string
}

type AssistantPart = { type: string } & Record<string, unknown>

function textOfContent(content: PiHistoryMessage['content']): string {
  if (typeof content === 'string') return content
  return (content ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n')
}

function toAssistantParts(
  message: PiHistoryMessage,
  toolParts: Map<string, ToolPart>
): AssistantPart[] {
  const parts: AssistantPart[] = []
  for (const part of Array.isArray(message.content) ? message.content : []) {
    if (part.type === 'text' && part.text) {
      parts.push({ type: 'text', text: part.text })
    } else if (part.type === 'toolCall' && part.id && part.name) {
      const toolPart: ToolPart = {
        type: `tool-${part.name}`,
        toolCallId: part.id,
        state: 'input-available',
        input: part.arguments ?? {}
      }
      toolParts.set(part.id, toolPart)
      parts.push(toolPart)
    }
    // thinking / 其余 part 类型：不回填（D3 最小保真）
  }
  return parts
}

function foldToolResult(message: PiHistoryMessage, toolParts: Map<string, ToolPart>): void {
  if (!message.toolCallId) return
  const toolPart = toolParts.get(message.toolCallId)
  if (!toolPart) return
  const text = textOfContent(message.content)
  if (message.isError) {
    toolPart.state = 'output-error'
    toolPart.errorText = text || 'tool error'
  } else {
    toolPart.state = 'output-available'
    toolPart.output = message.details ?? (text || null)
  }
}

export function readPiHistoryFile(file: string): UIMessage[] {
  const entries = parseSessionEntries(readFileSync(file, 'utf8'))
  const messages: UIMessage[] = []
  const toolParts = new Map<string, ToolPart>()

  for (const entry of entries) {
    if (entry.type !== 'message') continue
    const message = (entry as { message?: PiHistoryMessage }).message
    if (!message) continue

    if (message.role === 'user') {
      const text = textOfContent(message.content)
      if (text.trim()) {
        messages.push({ id: entry.id, role: 'user', parts: [{ type: 'text', text }] })
      }
    } else if (message.role === 'assistant') {
      const parts = toAssistantParts(message, toolParts)
      if (parts.length > 0) {
        messages.push({ id: entry.id, role: 'assistant', parts } as UIMessage)
      }
    } else if (message.role === 'toolResult') {
      foldToolResult(message, toolParts)
    }
  }

  return messages
}
