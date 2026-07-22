import { expect, test } from 'bun:test'

import { getTool, setupToolTest } from '#tests/helpers/tools'

interface CalcResult {
  expr?: string
  result?: number
  results?: Array<{ expr: string; result?: number; error?: string }>
  warning?: string
  error?: string
}

function runCalc(expr: string): CalcResult {
  const { figma } = setupToolTest()
  return getTool('calc').execute(figma, { expr }) as CalcResult
}

test('calc evaluates a single expression', () => {
  expect(runCalc('1080 * 0.6').result).toBe(648)
})

test('calc evaluates a JSON array of expressions', () => {
  const result = runCalc('["1080*0.6", "1080*0.25", "1080*0.15"]')
  expect(result.results?.map((r) => r.result)).toEqual([648, 270, 162])
})

test('calc salvages an array with trailing garbage and warns', () => {
  const result = runCalc('["1080*0.6","1080*0.25"]"')
  expect(result.results?.map((r) => r.result)).toEqual([648, 270])
  expect(result.warning).toContain('Trailing garbage')
})

test('calc rejects a malformed array without falling back to expr-eval', () => {
  const result = runCalc('["1080*0.6",')
  expect(result.error).toContain('Malformed JSON array')
})
