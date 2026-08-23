import { renderTreeNode } from '@open-pencil/core/design-jsx'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { ALL_TOOLS, registerComponentCatalog } from '@open-pencil/core/tools'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

/**
 * T21：桥执行的变更类操作补 undo 条目（对齐旧 ToolLoop 环绕 src/app/ai/tools/
 * index.ts:107-130 语义：执行前快照、执行后推 `AI: <name>` 撤销条目）。
 * 桥现在是 AI agent 的唯一执行路径（pi 后端经 7600 进来），undo 补齐后
 * 用户可撤销 agent 变更。执行抛错时不产生条目。
 */
async function withAIUndo<T>(
  store: AutomationTarget['store'],
  toolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const before = store.snapshotPage()
  const result = await fn()
  const after = store.snapshotPage()
  store.pushUndoEntry({
    label: `AI: ${toolName}`,
    forward: () => store.restorePageFromSnapshot(after),
    inverse: () => store.restorePageFromSnapshot(before)
  })
  return result
}

export function createAutomationToolHandler(makeFigma: FigmaFactory) {
  async function handleToolRender(
    target: AutomationTarget,
    toolArgs: Record<string, unknown>
  ): Promise<unknown> {
    const store = target.store
    const tree = toolArgs.tree as Parameters<typeof renderTreeNode>[1]
    const result = await withAIUndo(store, 'render', () =>
      renderTreeNode(store.graph, tree, {
        parentId: (toolArgs.parent_id as string | undefined) ?? target.pageId,
        x: toolArgs.x as number | undefined,
        y: toolArgs.y as number | undefined
      })
    )
    await ensureGraphFonts(store.graph, [result.id], store.renderer)
    computeAllLayouts(store.graph, target.pageId)
    store.requestRender()
    store.flashNodes([result.id])
    return {
      ok: true,
      result: { id: result.id, name: result.name, type: result.type, children: result.childIds }
    }
  }

  return async function handleTool(target: AutomationTarget, args: unknown): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const toolArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')

    if (toolName === 'render' && toolArgs.tree) {
      return handleToolRender(target, toolArgs)
    }

    const def = ALL_TOOLS.find((t) => t.name === toolName)
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const store = target.store
    const libraryService = useLibraryService()
    libraryService.bindEditor(store)
    registerComponentCatalog(store.graph, libraryService)
    const figma = makeFigma(store, target.pageId)
    const execute = () => Promise.resolve(def.execute(figma, toolArgs))
    const result = def.mutates ? await withAIUndo(store, toolName, execute) : await execute()

    if (def.mutates) {
      const pageNode = store.graph.getNode(figma.currentPageId)
      if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
      computeAllLayouts(store.graph, figma.currentPageId)
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { ok: true, result }
  }
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as JSONObject
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (item && typeof item === 'object' && typeof (item as JSONObject).id === 'string')
        ids.push((item as JSONObject).id as string)
    }
  }
  return ids
}
