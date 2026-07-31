/**
 * Marketing library session service (app layer; docs/plans/l2-resource-library.md).
 *
 * The shipped default-library.fig (public/ build-time asset, Q11) loads on
 * first marketing use and binds to each document's SceneGraph so core tools
 * resolve types and components. Users can replace it with their own .fig.
 * Also owns the per-store active-profile pointer: setup_material_type
 * returns activeProfileId, the chat tool-log hook records it here, and the
 * The transport appends the profile markdown to the system prompt's "Active
 * style profile" section on each turn, so the AI sees the active style guidance.
 * the next turn (Q6). Marketing runs only in the built-in AI chat (Q12).
 */

import { ref, shallowRef } from 'vue'

import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  getLibrarySession,
  injectLibraryReferences as injectLibraryReferencesCore,
  listDocumentLibraryNames,
  loadLibrary,
  setLibrarySession,
  setMarketingPrefs,
  type InjectReferencesResult,
  type LibrarySession
} from '@open-pencil/core/tools'

import { profileSelection } from '@/app/ai/chat/storage'
import type { SceneGraph } from '@open-pencil/scene-graph'

import type { EditorStore } from '@/app/editor/active-store'

const DEFAULT_LIBRARY_URL = 'default-library.fig'
const DEFAULT_LIBRARY_NAME = 'default-library.fig'

const current = shallowRef<LibrarySession | null>(null)
const libraryLoadError = ref('')
let loadPromise: Promise<LibrarySession | null> | null = null

/** Reactive handle to the current library session (null until loaded) */
export function useMarketingLibrary() {
  return current
}

/** Non-empty when the default library failed to load — shown in the dialog */
export function useLibraryLoadError() {
  return libraryLoadError
}

export function getMarketingLibrary(): LibrarySession | null {
  return current.value
}

async function loadFromBytes(bytes: Uint8Array, name: string): Promise<LibrarySession> {
  const { graph, index } = await loadLibrary(bytes, name)
  return { name, graph, index, refInjections: new Map() }
}

/** Load the shipped default library on first call; subsequent calls return the current one */
export async function ensureMarketingLibrary(): Promise<LibrarySession | null> {
  if (current.value) return current.value
  loadPromise ??= (async () => {
    try {
      const response = await fetch(DEFAULT_LIBRARY_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      current.value = await loadFromBytes(bytes, DEFAULT_LIBRARY_NAME)
      libraryLoadError.value = ''
    } catch (error) {
      current.value = null
      libraryLoadError.value = `${DEFAULT_LIBRARY_URL}: ${error instanceof Error ? error.message : String(error)}`
    }
    return current.value
  })()
  return loadPromise
}

/** Retry after a failed default-library load */
export function retryMarketingLibraryLoad(): Promise<LibrarySession | null> {
  loadPromise = null
  return ensureMarketingLibrary()
}

/** Replace the current library with a user-submitted .fig (dialog 上传替换) */
export async function replaceMarketingLibrary(
  file: File
): Promise<LibrarySession | { error: string }> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const session = await loadFromBytes(bytes, file.name)
    current.value = session
    loadPromise = Promise.resolve(session)
    return session
  } catch (error) {
    return {
      error: `无法解析库文件 ${file.name}: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/** Bind the current library session to a document graph (idempotent) */
export function bindMarketingLibrary(graph: SceneGraph): void {
  const session = current.value
  if (session && getLibrarySession(graph) !== session) setLibrarySession(graph, session)
  // Push the user-locked profile into core prefs so it deterministically
  // wins over setup's auto-pick on the next setup call
  setMarketingPrefs(graph, { profileId: profileSelection.value ?? undefined })
}

// --- Types for chips + reference injection context ---

export function listMarketingTypes(): { id: string; label: string; description?: string }[] {
  return (current.value?.index.types ?? []).map(({ id, label, description }) => ({
    id,
    label,
    ...(description ? { description } : {})
  }))
}

// --- Active profile (Q6) ---

const activeProfiles = new WeakMap<EditorStore, string>()
const profileVersion = ref(0)

export function setActiveProfile(store: EditorStore, profileId: string): void {
  if (activeProfiles.get(store) === profileId) return
  activeProfiles.set(store, profileId)
  profileVersion.value++
}

export function getActiveProfileId(store: EditorStore): string | undefined {
  return activeProfiles.get(store)
}

/**
 * Library context for marketing mode: the system prompt's "Material types in
 * the current library" section (so the AI can infer type ids) plus the
 * "Active style profile" markdown (Q6). Recomputed per turn so a profile
 * switch via re-setup takes effect on the next call.
 */
export function buildMarketingOverlay(store: EditorStore): string {
  void profileVersion.value
  const parts: string[] = []

  const types = current.value?.index.types ?? []
  if (types.length > 0) {
    const lines = types.map(
      (type) => `- ${type.id} (${type.label})${type.description ? `: ${type.description}` : ''}`
    )
    parts.push(`## Material types in the current library\n${lines.join('\n')}`)
  }

  const profileId = profileSelection.value ?? activeProfiles.get(store)
  const profile = profileId
    ? current.value?.index.profiles.find((entry) => entry.id === profileId)
    : undefined
  if (profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  }

  return parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''
}

// --- Library dialog state + session-start detection (§6.1) ---

const libraryDialogOpen = ref(false)
let dialogAutoShown = false

export function useLibraryDialogOpen() {
  return libraryDialogOpen
}

export function openLibraryDialog(): void {
  libraryDialogOpen.value = true
}

/**
 * Libraries the document's marketing designs were made with, minus the
 * currently loaded one — non-empty means a custom library is missing (§6.1).
 */
export function documentLibraryMismatch(graph: SceneGraph): string[] {
  const currentName = current.value?.name
  return listDocumentLibraryNames(graph).filter((name) => name !== currentName)
}

/**
 * Marketing session start: load the default library, bind it, and open the
 * dialog once per app run — or again whenever the document references a
 * library that is no longer loaded.
 */
export async function maybeAutoOpenLibraryDialog(graph: SceneGraph): Promise<void> {
  await ensureMarketingLibrary()
  bindMarketingLibrary(graph)
  if (!dialogAutoShown || documentLibraryMismatch(graph).length > 0) {
    dialogAutoShown = true
    libraryDialogOpen.value = true
  }
}

// --- Reference injection into the 素材区 page (§5) ---

/**
 * Inject the selected library references into the document's 素材区 page
 * (core does the cloning/dedup/marking); records the injection in a single
 * undo entry.
 */
export function injectLibraryReferences(
  store: EditorStore,
  refIds: string[]
): InjectReferencesResult {
  const graph = store.graph
  bindMarketingLibrary(graph)
  const before = store.snapshotPage()
  const result = injectLibraryReferencesCore(graph, refIds)
  if (result.injected.length > 0) {
    computeAllLayouts(graph, store.state.currentPageId)
    store.requestRender()
    const after = store.snapshotPage()
    store.pushUndoEntry({
      label: '注入素材参考',
      forward: () => store.restorePageFromSnapshot(after),
      inverse: () => store.restorePageFromSnapshot(before)
    })
  }
  return result
}
