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

import { ref, shallowRef, computed, type Ref } from 'vue'

import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  getLibrarySession,
  injectLibraryReferences as injectLibraryReferencesCore,
  listDocumentLibraryNames,
  listInjectedReferenceIds,
  loadLibrary,
  setLibrarySession,
  setMarketingPrefs,
  type InjectReferencesResult,
  type LibrarySession
} from '@open-pencil/core/tools'

import { profileSelection, setAiProfile } from '@/app/ai/chat/storage'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { getActiveEditorStore, type EditorStore } from '@/app/editor/active-store'

const DEFAULT_LIBRARY_URL = 'default-library.fig'
const DEFAULT_LIBRARY_NAME = 'default-library.fig'

const current = shallowRef<LibrarySession | null>(null)
const libraryLoadError = ref('')
let loadPromise: Promise<LibrarySession | null> | null = null
// Reflects the saved library reference ids on the current document's
// 参考区 page. Bumped after each injection / re-bind so subscribers (the
// References chip counter) re-evaluate. The actual ids are read fresh from
// graph markers inside `useInjectedReferenceIds` — this ref just acts as
// the change signal.
const injectionTick = ref(0)

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
  return { name, graph, index }
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

/**
 * Test-only: clear the in-memory library session so the next call sees the
 * empty/initial state. Not part of the public API.
 */
export function __resetMarketingLibraryForTest(): void {
  current.value = null
  loadPromise = null
  profileSelection.value = null
}

/** Bind the current library session to a document graph (idempotent) */
export function bindMarketingLibrary(graph: SceneGraph): void {
  const session = current.value
  if (session && getLibrarySession(graph) !== session) setLibrarySession(graph, session)
  // Push the user-locked profile into core prefs so it deterministically
  // wins over setup's auto-pick on the next setup call. AI-echoed profiles
  // are intentionally NOT persisted — those are per-setup signals, not
  // long-lived locks.
  setMarketingPrefs(graph, {
    profileId: profileSelection.value?.source === 'user' ? profileSelection.value.id : undefined
  })
  // The 参考区 page's marker set may have changed since the last injection
  // (e.g. user deleted a reference node) — refresh the reactive tick so
  // the chip counter re-reads from the graph.
  injectionTick.value++
}

/**
 * Reactive Set of library reference ids currently injected into the active
 * document's 参考区 page. Derived from graph markers, so it survives
 * session replacement and document reopen. The Vue chip counter and the
 * references dropdown base their checked-state on this.
 */
export function useInjectedReferenceIds(): Readonly<Ref<Set<string>>> {
  const graph = getActiveEditorStore().graph
  return computed(() => {
    void injectionTick.value
    void current.value
    return listInjectedReferenceIds(graph)
  })
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

/**
 * Record the AI's choice from setup_material_type's return value. Delegates
 * to storage so the chip and overlay share one source. `store` is the
 * editor store — kept in the signature for caller compatibility (the
 * `setActiveProfile(store, id)` hook shape is used by tools/index.ts).
 */
export function setActiveProfile(_store: EditorStore, profileId: string): void {
  setAiProfile(profileId)
}

export function getActiveProfileId(_store: EditorStore): string | undefined {
  // Kept for callers that read the active profile from a store handle. The
  // single source is `profileSelection` in chat storage.
  const selection = profileSelection.value
  if (!selection) return undefined
  return selection.id
}

/**
 * Library context for marketing mode: the system prompt's "Material types in
 * the current library" section (so the AI can infer type ids) plus the
 * "Active style profile" markdown (Q6). Recomputed per turn so a profile
 * switch via re-setup takes effect on the next call.
 *
 * Both section headers are ALWAYS emitted so the prompt does not lie about
 * "are listed below" when the library has not loaded yet (e.g. .fig fetch
 * failed, user replaced with a broken file, or the bound library has no
 * types/profiles). The system prompt's wording is intentionally tolerant
 * of the empty-state text — see system-prompt-marketing.md.
 */
export function buildMarketingOverlay(_store: EditorStore): string {
  const parts: string[] = []

  const library = current.value
  const types = library?.index.types ?? []
  const profiles = library?.index.profiles ?? []

  if (types.length > 0) {
    const lines = types.map(
      (type) => `- ${type.id} (${type.label})${type.description ? `: ${type.description}` : ''}`
    )
    parts.push(`## Material types in the current library\n${lines.join('\n')}`)
  } else {
    parts.push(
      `## Material types in the current library\n` +
        `_No material types available. The default marketing library may have failed to load, ` +
        `or the bound library has no Types page. Ask the user to reopen the library dialog ` +
        `or use \`setup_material_type\` with \`materialType: "custom"\` and width+height._`
    )
  }

  if (profiles.length > 0) {
    const lines = profiles.map(
      (profile) =>
        `- ${profile.id}${profile.label ? ` (${profile.label})` : ''}` +
        (profile.applicableTo.length > 0 ? ` — applies to: ${profile.applicableTo.join(', ')}` : '')
    )
    parts.push(`## Profiles in the current library\n${lines.join('\n')}`)
  } else {
    parts.push(
      `## Profiles in the current library\n` +
        `_No style profiles available. The library has no Profiles page — ` +
        `output will use the brief's 风格 section as guidance._`
    )
  }

  const selection = profileSelection.value
  const profileId = selection?.id
  const profile = profileId ? profiles.find((entry) => entry.id === profileId) : undefined
  if (profile) {
    const chosenBy = selection?.source === 'ai' ? ' (chosen by AI this turn)' : ''
    parts.push(`## Active style profile: ${profile.id}${chosenBy}\n${profile.markdown}`)
  } else {
    const profileNote = profileId
      ? `_Profile "${profileId}" is not present in the loaded library. The selected ` +
        `profile id may not exist in the current library file — fall back to the "auto" / ` +
        `first-profile default unless the user re-selects._`
      : `_No style profile is active for this turn. Marketing output has no library-supplied ` +
        `style guidance; rely on the brief's "风格" section or ask the user to pick a profile._`
    parts.push(`## Active style profile: (none)\n${profileNote}`)
  }

  return `\n\n${parts.join('\n\n')}`
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
  // Even when nothing was injected (all already present), the dialog closes
  // and the chip counter should still reflect the current state — bump the
  // tick so the references dropdown re-reads the marker set.
  injectionTick.value++
  return result
}
