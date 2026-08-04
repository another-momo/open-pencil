import type { UIMessage } from 'ai'

import { buildDebugLog } from '@open-pencil/core/tools'
import type { ToolDebugLog, ToolLogEntry } from '@open-pencil/core/tools'
import type { JsonObject } from '@open-pencil/scene-graph/primitives'

import { getPrepareCallDebug, getStepUsages, getToolLogEntries } from '@/app/ai/tools'

interface MediaOutputShape {
  base64: string
  mimeType: string
}

interface UnknownMediaOutput {
  base64: unknown
  mimeType: unknown
}

function asMediaOutput(value: unknown): MediaOutputShape | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as UnknownMediaOutput
  if (
    typeof record.base64 === 'string' &&
    typeof record.mimeType === 'string' &&
    record.mimeType.startsWith('image/')
  ) {
    return { base64: record.base64, mimeType: record.mimeType }
  }
  return undefined
}

function sanitizeMediaOutput(value: unknown): unknown {
  const media = asMediaOutput(value)
  if (!media) return value
  const record = value as JsonObject
  const { base64: _base64, ...rest } = record
  return { ...rest, base64: `[omitted ${media.base64.length} chars]` }
}

function sanitizeToolPart(part: JsonObject): JsonObject {
  const clone: JsonObject = { ...part }
  if ('output' in clone) clone.output = sanitizeMediaOutput(clone.output)
  const inv = clone.toolInvocation as JsonObject | undefined
  if (inv && 'result' in inv) {
    clone.toolInvocation = { ...inv, result: sanitizeMediaOutput(inv.result) }
  }
  return clone
}

export function formatTokenUsage(): string {
  const steps = getStepUsages()
  if (steps.length === 0) return '  (no usage data — provider may not report it)'

  let totalInput = 0
  let totalOutput = 0
  let totalCacheRead = 0
  let totalCacheWrite = 0

  const lines: string[] = []
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    totalInput += s.inputTokens
    totalOutput += s.outputTokens
    totalCacheRead += s.cacheReadTokens
    totalCacheWrite += s.cacheWriteTokens

    const cacheInfo: string[] = []
    if (s.cacheReadTokens > 0) cacheInfo.push(`cache_read=${s.cacheReadTokens}`)
    if (s.cacheWriteTokens > 0) cacheInfo.push(`cache_write=${s.cacheWriteTokens}`)
    lines.push(
      `  Step ${i + 1}: in=${s.inputTokens} out=${s.outputTokens}${cacheInfo.length > 0 ? ` ${cacheInfo.join(' ')}` : ' NO CACHE'}`
    )
  }

  const cacheHitRate = totalInput > 0 ? ((totalCacheRead / totalInput) * 100).toFixed(1) : '0.0'
  const savedTokens = totalCacheRead > 0 ? totalCacheRead - Math.round(totalCacheRead * 0.1) : 0

  lines.unshift(
    `Total: in=${totalInput} out=${totalOutput} cache_read=${totalCacheRead} cache_write=${totalCacheWrite}`,
    `Cache hit rate: ${cacheHitRate}% (saved ~${savedTokens} uncached input tokens, 90% cost reduction on cached)`,
    `Steps: ${steps.length}`,
    totalCacheRead === 0 && totalCacheWrite === 0
      ? '⚠ NO CACHING DETECTED — system prompt + tools are re-processed every step'
      : ''
  )

  return lines.filter(Boolean).join('\n')
}

function formatMediaDelivery(): string {
  const debug = getPrepareCallDebug()
  if (!debug) return '  (no prepareCall recorded yet)'
  const verdict =
    debug.degradedOutputs > 0
      ? '⚠ media tool-result outputs are NOT in content form — the image was serialized as JSON text (toModelOutput wiring broken)'
      : (debug.rewriteToUserMessage
        ? 'chat-completions path: images are rewritten to user-message image parts (turn entry + per step)'
        : 'images delivered natively inside tool results')
  const lines = [
    `  Provider: ${debug.providerID} / ${debug.modelID} (api: ${debug.customAPIType})`,
    `  Turn-entry history: ${debug.contentOutputs} content-form media tool-result(s), ${debug.degradedOutputs} degraded, ${debug.mediaParts} image part(s)`,
    `  Delivery: ${verdict}`
  ]
  if (debug.rewriteToUserMessage) {
    lines.push(`  Intra-turn: ${debug.stepInlinedImages} image part(s) inlined per-step so far`)
  }
  return lines.join('\n')
}

export function formatLogEntry(entry: ToolLogEntry, index: number): string {
  const time = new Date(entry.timestamp).toISOString().slice(11, 23)
  const lines = [`  #${index + 1} [${time}] ${entry.tool} (${entry.durationMs}ms)`]
  lines.push(`    args: ${JSON.stringify(entry.args)}`)

  if (entry.error) {
    lines.push(`    ERROR: ${entry.error}`)
  } else {
    lines.push(`    result: ${JSON.stringify(entry.result)}`)
  }

  if (entry.isDuplicate) {
    lines.push(`    ⚠ DUPLICATE: same tool+args called earlier in session`)
  }

  if (entry.unchangedProps?.length) {
    lines.push(`    ⚠ NO-OP PROPS: ${entry.unchangedProps.join(', ')}`)
    if (entry.nodeBefore) {
      for (const prop of entry.unchangedProps) {
        const val = entry.nodeBefore[prop]
        lines.push(`      ${prop} stayed: ${JSON.stringify(val)}`)
      }
    }
  }

  if (entry.nodeBefore && entry.nodeAfter) {
    const changed = diffNodeSnapshots(entry.nodeBefore, entry.nodeAfter)
    if (changed.length > 0) {
      lines.push(
        `    changed: ${changed.map((c) => `${c.prop}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`).join(', ')}`
      )
    }
  }

  return lines.join('\n')
}

function diffNodeSnapshots(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Array<{ prop: string; before: unknown; after: unknown }> {
  const skip = new Set(['childIds', 'parentId', 'id'])
  const changed: Array<{ prop: string; before: unknown; after: unknown }> = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of allKeys) {
    if (skip.has(key)) continue
    const bStr = JSON.stringify(before[key])
    const aStr = JSON.stringify(after[key])
    if (bStr !== aStr) {
      changed.push({ prop: key, before: before[key], after: after[key] })
    }
  }
  return changed
}

export function formatDiagnostics(log: ToolDebugLog): string {
  const sections: string[] = []

  sections.push(`Total tool calls: ${log.entries.length}`)
  sections.push(`Total result payload: ${(log.totalResultBytes / 1024).toFixed(1)} KB`)

  const mutatingCalls = log.entries.filter((e) => e.mutates)
  const errorCalls = log.entries.filter((e) => e.error)
  sections.push(`Mutating calls: ${mutatingCalls.length}`)
  if (errorCalls.length > 0) {
    sections.push(`Errors: ${errorCalls.length}`)
  }

  if (log.duplicates.length > 0) {
    sections.push('')
    sections.push('⚠ DUPLICATE CALLS (potential loops):')
    for (const dup of log.duplicates) {
      sections.push(`  ${dup.tool} ×${dup.count} — args: ${JSON.stringify(dup.args)}`)
    }
  }

  if (log.noopMutations.length > 0) {
    sections.push('')
    sections.push('⚠ NO-OP MUTATIONS (tool succeeded but node unchanged):')
    for (const entry of log.noopMutations) {
      sections.push(`  ${entry.tool} on ${String(entry.args.id)}`)
      sections.push(`    unchanged: ${entry.unchangedProps?.join(', ')}`)
      if (entry.nodeBefore && entry.unchangedProps) {
        for (const prop of entry.unchangedProps) {
          sections.push(`    ${prop} = ${JSON.stringify(entry.nodeBefore[prop])}`)
        }
      }
    }
  }

  const largeResults = log.entries
    .map((e, i) => ({ index: i, tool: e.tool, size: JSON.stringify(e.result ?? '').length }))
    .filter((r) => r.size > 2048)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)

  if (largeResults.length > 0) {
    sections.push('')
    sections.push('⚠ LARGE RESULTS (potential token waste):')
    for (const r of largeResults) {
      sections.push(`  #${r.index + 1} ${r.tool}: ${(r.size / 1024).toFixed(1)} KB`)
    }
  }

  return sections.join('\n')
}

function formatToolPart(part: Record<string, unknown>): string {
  const inv = part.toolInvocation as JsonObject | undefined
  if (inv) {
    const lines = [`  [tool] ${String(inv.toolName)} (${String(inv.state)})`]
    if (inv.args) lines.push(`    args: ${JSON.stringify(inv.args)}`)
    if (inv.result !== undefined)
      lines.push(`    result: ${JSON.stringify(sanitizeMediaOutput(inv.result))}`)
    return lines.join('\n')
  }

  const name = (typeof part.type === 'string' ? part.type : 'unknown').replace(/^tool-/, '')
  const state = typeof part.state === 'string' ? part.state : '?'
  const lines = [`  [tool] ${name} (${state})`]
  if (part.input) lines.push(`    input: ${JSON.stringify(part.input)}`)
  if (part.output !== undefined)
    lines.push(`    output: ${JSON.stringify(sanitizeMediaOutput(part.output))}`)
  if (part.errorText) lines.push(`    error: ${part.errorText as string}`)
  return lines.join('\n')
}

function formatMessageStats(messages: UIMessage[]): string {
  let userMessages = 0
  let assistantMessages = 0
  let toolCalls = 0
  let totalTextLength = 0
  let mediaImages = 0
  let mediaChars = 0

  for (const msg of messages) {
    if (msg.role === 'user') userMessages++
    else if (msg.role === 'assistant') assistantMessages++
    for (const part of msg.parts) {
      const p = part as JsonObject
      if (p.type === 'text') {
        totalTextLength += typeof p.text === 'string' ? p.text.length : 0
      } else if (
        p.type === 'tool-invocation' ||
        p.type === 'dynamic-tool' ||
        p.toolInvocation ||
        (typeof p.type === 'string' && p.type.startsWith('tool-'))
      ) {
        toolCalls++
        const inv = p.toolInvocation as JsonObject | undefined
        const output = inv ? inv.result : p.output
        const media = asMediaOutput(output)
        if (media) {
          mediaImages++
          mediaChars += media.base64.length
          totalTextLength += JSON.stringify(sanitizeToolPart(p)).length
        } else {
          totalTextLength += JSON.stringify(p).length
        }
      }
    }
  }

  const lines = [
    `Messages: ${messages.length} (${userMessages} user, ${assistantMessages} assistant)`,
    `Tool invocations in messages: ${toolCalls}`,
    `Total text content: ${(totalTextLength / 1024).toFixed(1)} KB (~${Math.ceil(totalTextLength / 4)} tokens approx)`
  ]
  if (mediaImages > 0) {
    lines.push(
      `Media payload (excluded from request after elision): ${mediaImages} images / ${(mediaChars / 1024).toFixed(1)} KB`
    )
  }
  return lines.join('\n')
}

export function serializeChatLog(messages: UIMessage[]): string {
  const sections: string[] = []

  const toolLog = getToolLogEntries()
  const debugLog = buildDebugLog(toolLog)

  sections.push('╔══════════════════════════════════════╗')
  sections.push('║     OPEN PENCIL AI DEBUG LOG         ║')
  sections.push(`║     ${new Date().toISOString()}   ║`)
  sections.push('╚══════════════════════════════════════╝')
  sections.push('')

  sections.push('=== TOKEN USAGE & CACHING ===')
  sections.push(formatTokenUsage())
  sections.push('')

  sections.push('=== MEDIA DELIVERY (last prepareCall) ===')
  sections.push(formatMediaDelivery())
  sections.push('')

  sections.push('=== DIAGNOSTICS ===')
  sections.push(formatDiagnostics(debugLog))
  sections.push('')

  sections.push('=== MESSAGE STATS ===')
  sections.push(formatMessageStats(messages))
  sections.push('')

  sections.push('=== TOOL EXECUTION LOG ===')
  if (toolLog.length === 0) {
    sections.push('  (no tool calls recorded)')
  } else {
    for (let i = 0; i < toolLog.length; i++) {
      sections.push(formatLogEntry(toolLog[i], i))
    }
  }
  sections.push('')

  sections.push('=== CONVERSATION ===')
  for (const msg of messages) {
    const header = `--- ${msg.role.toUpperCase()} (${msg.id}) ---`
    const parts: string[] = []

    for (const part of msg.parts) {
      const p = part as JsonObject
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
        parts.push(
          `  [${typeof p.type === 'string' ? p.type : 'unknown'}] ${JSON.stringify(sanitizeToolPart(p))}`
        )
      }
    }

    sections.push(`${header}\n${parts.join('\n')}`)
  }

  return sections.join('\n\n')
}

export function copyChatLog(messages: UIMessage[]): Promise<void> {
  const text = serializeChatLog(messages)
  return navigator.clipboard.writeText(text)
}
