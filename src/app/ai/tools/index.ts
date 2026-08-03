import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { CORE_TOOLS, getMarketingState, toolsToAI } from '@open-pencil/core/tools'
import type { StepBudget, ToolLogEntry } from '@open-pencil/core/tools'
import type { SceneNode } from '@open-pencil/scene-graph'

import { syncMaterialTypeFromAI } from '@/app/ai/chat/storage'
import type { ChatMode } from '@/app/ai/chat/storage'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'

export const MAX_AGENT_STEPS = 50

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

export interface PrepareCallDebug {
  providerID: string
  modelID: string
  customAPIType: string
  rewriteToUserMessage: boolean
  contentOutputs: number
  degradedOutputs: number
  mediaParts: number
  stepInlinedImages: number
  timestamp: number
}

class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0
  burstId = 0
  prepareCallDebug: PrepareCallDebug | null = null

  recordStep(usage: StepUsage): void {
    this.stepUsages.push(usage)
    this.currentSteps++
  }

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.stepUsages = []
    this.currentSteps = 0
  }
}

const runStates = new WeakMap<EditorStore, RunState>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

export function getToolLogEntries(store?: EditorStore): ToolLogEntry[] {
  return getRunState(store).toolLog
}

export function getStepUsages(store?: EditorStore): StepUsage[] {
  return getRunState(store).stepUsages
}

export function recordStepUsage(usage: StepUsage, store?: EditorStore): void {
  getRunState(store).recordStep(usage)
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function recordPrepareCallDebug(debug: PrepareCallDebug, store?: EditorStore): void {
  getRunState(store).prepareCallDebug = debug
}

export function recordStepInlinedImages(count: number, store?: EditorStore): void {
  const debug = getRunState(store).prepareCallDebug
  if (debug) debug.stepInlinedImages += count
}

export function getPrepareCallDebug(store?: EditorStore): PrepareCallDebug | null {
  return getRunState(store).prepareCallDebug
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function clearToolLogEntries(store?: EditorStore): void {
  getRunState(store).clear()
}

export function beginNewBurst(store?: EditorStore): void {
  getRunState(store).burstId++
}

/** Marketing-only tools — hidden in ui mode where no marketing state exists. */
const MARKETING_ONLY_TOOLS = new Set(['look', 'setup_material_type', 'validate'])

export function createAITools(store: EditorStore, chatMode: ChatMode = 'ui') {
  let beforeSnapshot: Map<string, SceneNode> | null = null
  const runState = getRunState(store)
  const tools =
    chatMode === 'marketing'
      ? CORE_TOOLS
      : CORE_TOOLS.filter((def) => !MARKETING_ONLY_TOOLS.has(def.name))

  return toolsToAI(
    tools,
    {
      getFigma: () => makeFigmaFromStore(store),
      onBeforeExecute: (def) => {
        if (def.mutates) {
          beforeSnapshot = store.snapshotPage()
        }
      },
      onAfterExecute: async (def) => {
        if (def.name === 'setup_material_type') {
          const typeId = getMarketingState(store.graph)?.materialTypeId
          if (typeId) syncMaterialTypeFromAI(typeId)
        }
        if (def.mutates) {
          const pageId = store.state.currentPageId
          const pageNode = store.graph.getNode(pageId)
          if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
          computeAllLayouts(store.graph, pageId)
          store.requestRender()
          if (beforeSnapshot) {
            const before = beforeSnapshot
            const after = store.snapshotPage()
            store.pushUndoEntry({
              label: `AI: ${def.name}`,
              coalesceKey: `ai-burst-${runState.burstId}`,
              forward: () => store.restorePageFromSnapshot(after),
              inverse: () => store.restorePageFromSnapshot(before)
            })
            beforeSnapshot = null
          }
        }
      },
      onFlashNodes: (nodeIds) => {
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) {
          store.aiFlashDone(nodeIds)
        }
      },
      onToolLog: (entry) => {
        // P8 (2026-08-01): profile is a user-driven asset. Setup may
        // return `activeProfileId` (because the user has locked one in the
        // config bar), but the AI must NOT echo it back into
        // `profileSelection` — that would imply the AI picked the profile,
        // polluting the user-picked profile semantics and changing the chip display.
        // The MarketingConfigBar → `bindMarketingLibrary` path is the
        // single writer for the active profile; this hook is intentionally
        // a no-op for `setup_material_type`.
        runState.toolLog.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
