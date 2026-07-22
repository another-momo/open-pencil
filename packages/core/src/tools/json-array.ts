/**
 * Lenient JSON array parsing for tool string params.
 *
 * Models sometimes emit a valid JSON array with trailing garbage (stray
 * quotes/braces from double-closing the tool-call string). Strict parsing
 * fails and the model retries the identical payload, burning steps. Salvage
 * by trimming to the last ']' when — and only when — the trimmed tail is
 * insignificant (whitespace, quotes, braces, commas), so payloads corrupted
 * in the middle still fail loudly instead of being silently truncated.
 *
 * The fast path uses destr (prototype-pollution safe); the salvage path
 * refuses payloads containing __proto__ to keep the same guarantee.
 */

import { safeDestr } from 'destr'

export interface JsonArrayParam {
  items: unknown[]
  warning?: string
}

const INSIGNIFICANT_TAIL = /^[\s"',}]*$/

function tryParse(text: string, strictJson: boolean): unknown {
  try {
    return strictJson ? JSON.parse(text) : safeDestr(text)
  } catch {
    return undefined
  }
}

export function parseJsonArrayParam(
  raw: unknown,
  label: string
): JsonArrayParam | { error: string } {
  const text = String(raw)
  const parsed = tryParse(text, false)
  if (parsed !== undefined) {
    return { items: Array.isArray(parsed) ? parsed : [parsed] }
  }

  const lastBracket = text.lastIndexOf(']')
  if (
    lastBracket > 0 &&
    INSIGNIFICANT_TAIL.test(text.slice(lastBracket + 1)) &&
    !text.includes('__proto__')
  ) {
    const salvaged = tryParse(text.slice(0, lastBracket + 1), true)
    if (Array.isArray(salvaged)) {
      return {
        items: salvaged,
        warning: `Trailing garbage after the JSON array in ${label} was ignored — send exactly one JSON value.`
      }
    }
  }
  return { error: `Invalid JSON in ${label}` }
}
