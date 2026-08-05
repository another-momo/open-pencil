/**
 * Brief form panel state + orchestration (brief-form-panel.md §4.2).
 *
 * The panel holds no state of its own: the canvas brief node tree is the
 * single source of truth, loadBrief() rebuilds the view from it, and every
 * apply is a full undo transaction (snapshot → core primitive → layout →
 * render → pushUndoEntry). Disciplines:
 *
 * - Re-read before every apply: users may drag/rename brief nodes on the
 *   canvas while the panel is open, so a stale view's entryId may point at
 *   the wrong entry. readBrief is cheap; old views are never trusted.
 * - Commit-before-act: uncommitted textarea drafts (changed but no change
 *   event yet) are committed before any apply runs, closing the
 *   "edited → clicked add-material without blur" timing hole.
 * - try/catch + rollback: failures restore the page snapshot and surface a
 *   panel-friendly error instead of leaving a half-mutated brief.
 * - No live sync and no tab-watch subscription: applies re-resolve the
 *   active store, so switching tabs naturally targets the new document
 *   (a document without a brief reads as the empty state).
 */

import { ref } from 'vue'

import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  addBriefMaterialEntry,
  createBrief,
  findBrief,
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from '@open-pencil/core/tools'
import type { BriefView } from '@open-pencil/core/tools'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

/** Undo labels, predefined as constants for a future undo panel display */
export const BRIEF_UNDO_LABELS = {
  editContent: 'edit-content',
  addMaterial: 'add-material',
  removeMaterial: 'remove-material',
  editCaption: 'edit-caption'
} as const

export const briefPanelOpen = ref(false)
/** Detail of the last failed apply (empty = no error); the panel shows a friendly generic message alongside */
export const briefPanelError = ref('')

export function openBriefPanel(): void {
  briefPanelError.value = ''
  briefPanelOpen.value = true
}

export function closeBriefPanel(): void {
  briefPanelOpen.value = false
}

export type BriefPanelState =
  | { kind: 'none' }
  | { kind: 'broken' }
  | { kind: 'ok'; view: BriefView }

/**
 * Rebuild the panel view from the canvas. Cheap — called on open, after
 * every apply, and before every apply (via the apply functions themselves).
 */
export function loadBrief(): BriefPanelState {
  const store = getActiveEditorStoreOrNull()
  if (!store) return { kind: 'none' }
  const figma = makeFigmaFromStore(store)
  const view = readBrief(figma)
  if (view) return { kind: 'ok', view }
  return findBrief(figma) ? { kind: 'broken' } : { kind: 'none' }
}

/**
 * Create the brief on the canvas as one undo transaction, then let the
 * caller open the panel. Single-brief semantics: a no-op when a brief
 * already exists.
 */
export function createBriefInStore(): boolean {
  const store = getActiveEditorStoreOrNull()
  if (!store) return false
  if (findBrief(makeFigmaFromStore(store))) return false
  const before = store.snapshotPage()
  const figma = makeFigmaFromStore(store)
  const center = store.viewportCanvasCenter()
  const brief = createBrief(figma, center.x - 180, center.y - 120)
  computeAllLayouts(store.graph, store.state.currentPageId)
  store.select([brief.id])
  store.requestRender()
  const after = store.snapshotPage()
  store.pushUndoEntry({
    label: '新建需求单',
    forward: () => store.restorePageFromSnapshot(after),
    inverse: () => store.restorePageFromSnapshot(before)
  })
  return true
}

// --- Uncommitted drafts (commit-before-act) ---

let draftContent: string | null = null
const draftCaptions = new Map<string, string>()

export function noteDraftContent(text: string): void {
  draftContent = text
}

export function clearDraftContent(): void {
  draftContent = null
}

export function noteDraftCaption(entryId: string, caption: string): void {
  draftCaptions.set(entryId, caption)
}

export function clearDraftCaption(entryId: string): void {
  draftCaptions.delete(entryId)
}

/** Drop all pending drafts (panel refresh/close — drafts only live between input and apply) */
export function clearDrafts(): void {
  draftContent = null
  draftCaptions.clear()
}

/** Commit pending drafts as their own undo entries. Drafts are cleared before each commit, so the nested commitDrafts() inside the apply functions is a no-op. */
function commitDrafts(): void {
  if (draftContent !== null) {
    const text = draftContent
    draftContent = null
    applyContent(text)
  }
  const captions = [...draftCaptions]
  draftCaptions.clear()
  for (const [entryId, caption] of captions) applyCaption(entryId, caption)
}

// --- Apply functions: one undo transaction each ---

function applyMutation(label: string, mutate: (figma: FigmaAPI) => boolean): boolean {
  const store = getActiveEditorStoreOrNull()
  if (!store) return false
  const figma = makeFigmaFromStore(store)
  const before = store.snapshotPage()
  try {
    if (!mutate(figma)) {
      store.restorePageFromSnapshot(before)
      briefPanelError.value ||= 'apply-failed'
      return false
    }
    computeAllLayouts(store.graph, store.state.currentPageId)
    store.requestRender()
    const after = store.snapshotPage()
    store.pushUndoEntry({
      label,
      forward: () => store.restorePageFromSnapshot(after),
      inverse: () => store.restorePageFromSnapshot(before)
    })
    briefPanelError.value = ''
    return true
  } catch (error) {
    console.error('[brief-panel] apply failed, rolled back:', error)
    store.restorePageFromSnapshot(before)
    briefPanelError.value = error instanceof Error ? error.message : String(error)
    return false
  }
}

export function applyContent(text: string): boolean {
  commitDrafts()
  const store = getActiveEditorStoreOrNull()
  if (!store) return false
  // Re-read before applying — never trust the view captured at panel open
  const current = readBrief(makeFigmaFromStore(store))
  if (!current) return false
  if (current.content === text) return true
  return applyMutation(BRIEF_UNDO_LABELS.editContent, (figma) =>
    updateBriefContent(figma, current.briefId, text)
  )
}

export function applyCaption(entryId: string, caption: string): boolean {
  commitDrafts()
  const store = getActiveEditorStoreOrNull()
  if (!store) return false
  const current = readBrief(makeFigmaFromStore(store))
  const material = current?.materials.find((m) => m.entryId === entryId)
  if (!material) return false
  if (material.caption === caption) return true
  return applyMutation(BRIEF_UNDO_LABELS.editCaption, (figma) =>
    updateMaterialCaption(figma, entryId, caption)
  )
}

export function applyAddMaterial(bytes: Uint8Array, caption: string): string | null {
  commitDrafts()
  let entryId: string | null = null
  const ok = applyMutation(BRIEF_UNDO_LABELS.addMaterial, (figma) => {
    const view = readBrief(figma)
    if (!view) return false
    const result = addBriefMaterialEntry(figma, view.briefId, bytes, caption)
    if ('error' in result) {
      briefPanelError.value = result.error
      return false
    }
    entryId = result.entryId
    return true
  })
  return ok ? entryId : null
}

export function applyRemoveMaterial(entryId: string): boolean {
  commitDrafts()
  const store = getActiveEditorStoreOrNull()
  if (!store) return false
  const current = readBrief(makeFigmaFromStore(store))
  if (!current?.materials.some((m) => m.entryId === entryId)) return false
  return applyMutation(BRIEF_UNDO_LABELS.removeMaterial, (figma) =>
    removeBriefMaterial(figma, entryId)
  )
}
