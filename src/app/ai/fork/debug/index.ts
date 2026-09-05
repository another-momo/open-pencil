// Batch 2a 路径分离（2026-09-05）：本文件自 src/app/ai/debug/index.ts 迁入
// owned 路径 src/app/ai/fork/debug/，原上游路径留给 deletedPaths 落账——T27
// 起本模块已裁为纯 fork 派生面（无上游对应实现可跟随）。
import type { UIMessage } from 'ai'

import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import type { AIChatFailure } from '../failure'

// T27：旧浏览器内 ToolLoop 的客户端工具日志/step 计数面已随 src/app/ai/tools/
// 删除（pi 路径工具在后端进程执行，浏览器侧恒空）——TOKEN USAGE / DIAGNOSTICS /
// TOOL EXECUTION LOG 三节随之裁掉，本模块只保留从 messages/failure 派生的活内容。

const MAX_FAILURE_DETAIL_LENGTH = 240
const SENSITIVE_DETAIL_PATTERN =
  /(api[-_ ]?key|authorization|token|secret|password)(\s*[:=]\s*|\s+)([^\s,;]+)/gi

export function safeFailureDetail(detail: string): string {
  const redacted = detail.replace(SENSITIVE_DETAIL_PATTERN, '$1$2[redacted]')
  return redacted.length <= MAX_FAILURE_DETAIL_LENGTH
    ? redacted
    : `${redacted.slice(0, MAX_FAILURE_DETAIL_LENGTH)}…`
}

function formatToolPart(part: Record<string, unknown>): string {
  const inv = part.toolInvocation as JSONObject | undefined
  if (inv) {
    const lines = [`  [tool] ${String(inv.toolName)} (${String(inv.state)})`]
    if (inv.args) lines.push(`    args: ${JSON.stringify(inv.args)}`)
    if (inv.result !== undefined) lines.push(`    result: ${JSON.stringify(inv.result)}`)
    return lines.join('\n')
  }

  const name = (typeof part.type === 'string' ? part.type : 'unknown').replace(/^tool-/, '')
  const state = typeof part.state === 'string' ? part.state : '?'
  const lines = [`  [tool] ${name} (${state})`]
  if (part.input) lines.push(`    input: ${JSON.stringify(part.input)}`)
  if (part.output !== undefined) lines.push(`    output: ${JSON.stringify(part.output)}`)
  if (part.errorText) lines.push(`    error: ${part.errorText as string}`)
  return lines.join('\n')
}

function formatMessageStats(messages: UIMessage[]): string {
  let userMessages = 0
  let assistantMessages = 0
  let toolCalls = 0
  let totalTextLength = 0

  for (const msg of messages) {
    if (msg.role === 'user') userMessages++
    else if (msg.role === 'assistant') assistantMessages++
    for (const part of msg.parts) {
      const p = part as JSONObject
      if (p.type === 'text') {
        totalTextLength += typeof p.text === 'string' ? p.text.length : 0
      } else if (
        p.type === 'tool-invocation' ||
        p.type === 'dynamic-tool' ||
        p.toolInvocation ||
        (typeof p.type === 'string' && p.type.startsWith('tool-'))
      ) {
        toolCalls++
        totalTextLength += JSON.stringify(p).length
      }
    }
  }

  const lines = [
    `Messages: ${messages.length} (${userMessages} user, ${assistantMessages} assistant)`,
    `Tool invocations in messages: ${toolCalls}`,
    `Total text content: ${(totalTextLength / 1024).toFixed(1)} KB (~${Math.ceil(totalTextLength / 4)} tokens approx)`
  ]
  return lines.join('\n')
}

export function serializeChatLog(messages: UIMessage[], failure?: AIChatFailure | null): string {
  const sections: string[] = []

  sections.push('╔══════════════════════════════════════╗')
  sections.push('║     OPEN PENCIL AI DEBUG LOG         ║')
  sections.push(`║     ${new Date().toISOString()}   ║`)
  sections.push('╚══════════════════════════════════════╝')
  sections.push('')

  sections.push('=== ERRORS ===')
  if (failure) {
    const detail = failure.detail ? `: ${safeFailureDetail(failure.detail)}` : ''
    sections.push(`  ${failure.reason}${detail}`)
  } else {
    sections.push('  (none recorded)')
  }
  sections.push('')

  sections.push('=== MESSAGE STATS ===')
  sections.push(formatMessageStats(messages))
  sections.push('')

  sections.push('=== CONVERSATION ===')
  for (const msg of messages) {
    const header = `--- ${msg.role.toUpperCase()} (${msg.id}) ---`
    const parts: string[] = []

    for (const part of msg.parts) {
      const p = part as JSONObject
      if (p.type === 'text') {
        parts.push(`  ${p.text as string}`)
      } else if (p.type === 'reasoning') {
        let reasoning = ''
        if (typeof p.text === 'string') reasoning = p.text
        else if (typeof p.content === 'string') reasoning = p.content
        parts.push(`  [reasoning] ${reasoning}`)
      } else if (
        p.type === 'tool-invocation' ||
        p.toolInvocation ||
        (typeof p.type === 'string' && p.type.startsWith('tool-'))
      ) {
        parts.push(formatToolPart(p))
      } else {
        parts.push(`  [${typeof p.type === 'string' ? p.type : 'unknown'}] ${JSON.stringify(p)}`)
      }
    }

    sections.push(`${header}\n${parts.join('\n')}`)
  }

  return sections.join('\n\n')
}

export function copyChatLog(messages: UIMessage[], failure?: AIChatFailure | null): Promise<void> {
  const text = serializeChatLog(messages, failure)
  return navigator.clipboard.writeText(text)
}
