/**
 * AgentSessionEvent → UIMessageChunk 映射（T19）。
 *
 * 映射表来源：docs/rebuild/tasks/T11-self-check.md §2.5（S-pi-4 离线面实测），
 * 惰性开帧状态机照搬上游 src/app/ai/harness/transport.ts mapEvent 的 pending 模式。
 * T19 为纯文本回合（noTools: 'all'），toolcall_* / tool_execution_* 事件不应出现，
 * 留 T20 补；出现即忽略（不产生 chunk，不中断流）。
 *
 * 本文件被 Node 端 service.ts 使用，只允许相对导入（vite.config 经 esbuild 打包，
 * 不解析 tsconfig paths）。
 */

import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent'
import type { UIMessageChunk } from 'ai'

export function createPiEventMapper(
  messageId: string
): (event: AgentSessionEvent) => UIMessageChunk[] {
  let started = false
  let textId: string | null = null
  let reasoningId: string | null = null
  let textSeq = 0
  let reasoningSeq = 0

  return (event) => {
    const chunks: UIMessageChunk[] = []
    if (!started) {
      started = true
      chunks.push({ type: 'start', messageId })
    }

    if (event.type === 'message_update') {
      const sub = event.assistantMessageEvent
      switch (sub.type) {
        case 'text_start':
          textId = `text-${++textSeq}`
          chunks.push({ type: 'text-start', id: textId })
          break
        case 'text_delta':
          if (!textId) {
            textId = `text-${++textSeq}`
            chunks.push({ type: 'text-start', id: textId })
          }
          chunks.push({ type: 'text-delta', id: textId, delta: sub.delta })
          break
        case 'text_end':
          if (textId) {
            chunks.push({ type: 'text-end', id: textId })
            textId = null
          }
          break
        case 'thinking_start':
          reasoningId = `reasoning-${++reasoningSeq}`
          chunks.push({ type: 'reasoning-start', id: reasoningId })
          break
        case 'thinking_delta':
          if (!reasoningId) {
            reasoningId = `reasoning-${++reasoningSeq}`
            chunks.push({ type: 'reasoning-start', id: reasoningId })
          }
          chunks.push({ type: 'reasoning-delta', id: reasoningId, delta: sub.delta })
          break
        case 'thinking_end':
          if (reasoningId) {
            chunks.push({ type: 'reasoning-end', id: reasoningId })
            reasoningId = null
          }
          break
        case 'error':
          chunks.push({
            type: 'error',
            errorText: sub.error.errorMessage ?? `model stream error (${sub.reason})`
          })
          break
        default:
          // start / done / toolcall_*：T19 不产生 chunk
          break
      }
    }

    if (event.type === 'agent_end') {
      if (textId) {
        chunks.push({ type: 'text-end', id: textId })
        textId = null
      }
      if (reasoningId) {
        chunks.push({ type: 'reasoning-end', id: reasoningId })
        reasoningId = null
      }
      chunks.push({ type: 'finish', finishReason: 'stop' })
    }

    return chunks
  }
}
