import ExprEval from 'expr-eval'

import { parseJsonArrayParam } from './json-array'
import { defineTool } from './schema'

const parser = new ExprEval.Parser()

function evalExpr(
  expr: string
): { expr: string; result: number } | { expr: string; error: string } {
  try {
    const result = parser.evaluate(expr)
    if (!Number.isFinite(result)) {
      return { expr, error: `Produced ${String(result)}` }
    }
    return { expr, result }
  } catch (e) {
    return { expr, error: e instanceof Error ? e.message : String(e) }
  }
}

export const calc = defineTool({
  name: 'calc',
  description:
    'Arithmetic calculator. ALWAYS use instead of mental math. ' +
    'Pass one expression or a JSON array of expressions — all evaluated in one call. ' +
    'Supports: + - * / % ** ( ) min max floor ceil round abs sqrt pow. ' +
    'Examples: "844 - 56 - 96 - 82", \'["1440 * 8 / 12", "(952 - 16) / 2", "floor(390 * 0.6)"]\'',
  params: {
    expr: {
      type: 'string',
      description: 'Single expression or JSON array of expressions',
      required: true
    }
  },
  execute: (_figma, { expr }) => {
    const trimmed = expr.trim()
    if (!trimmed.startsWith('[')) return evalExpr(expr)

    const parsed = parseJsonArrayParam(trimmed, 'expr')
    if ('error' in parsed) {
      return {
        expr,
        error: `Malformed JSON array in expr — send a single expression or a valid JSON array of expressions. (${parsed.error})`
      }
    }

    const exprs = parsed.items.map(String)
    if (exprs.length === 1) return evalExpr(exprs[0])

    const results = exprs.map(evalExpr)
    return parsed.warning ? { results, warning: parsed.warning } : { results }
  }
})
