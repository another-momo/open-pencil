import { defineTool } from '#core/tools/schema'

import { wrapEvalCode } from './wrap'

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is available. ' +
    'Technical constraints: code runs inside an async function body (`await` works), but the figma object has NO `*Async` methods — `getNodeByIdAsync` does not exist (use sync `getNodeById`); `loadFontAsync` is a no-op (assign `fontName` directly to change fonts). ' +
    'The return value is whatever your code returns — a loop counter is NOT a write confirmation; after bulk mutations, `describe` a sample of nodes to verify the writes landed. ' +
    'For bulk font/fill changes prefer batch_update / set_fill / render replace_id — eval is the last resort.',
  params: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true }
  },
  mutates: true,
  execute: async (figma, { code }) => {
    type AsyncFunctionConstructor = new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>
    const AsyncFunction = Object.getPrototypeOf(async () => undefined)
      .constructor as AsyncFunctionConstructor
    const fn = new AsyncFunction('figma', wrapEvalCode(code))
    const result = await fn(figma)
    if (result && typeof result === 'object') {
      const toJSON = Reflect.get(result, 'toJSON')
      if (typeof toJSON === 'function') return toJSON.call(result)
    }
    if (result !== undefined && result !== null) return result
    return { ok: true, message: 'Code executed (no return value)' }
  }
})
