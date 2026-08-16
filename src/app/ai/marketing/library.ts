/**
 * Marketing library session service (app layer; docs/plans/l2-resource-library.md).
 *
 * The shipped default-library.fig (public/ build-time asset, Q11) loads on
 * first marketing use and binds to each document's SceneGraph so core tools
 * resolve types and components. Users can replace it with their own .fig.
 * Also builds the per-turn system-prompt overlay: the transport appends the
 * active profile markdown to the prompt's "Active style profile" section on
 * each turn (buildMarketingOverlay), so the AI sees the active style
 * guidance. The profile selection lives in marketing/settings
 * (`profileSelection`) and is written only by the MarketingConfigBar —
 * setup_material_type no longer echoes any profile information (P8v3,
 * 2026-08-01). Marketing runs only in the built-in AI chat (Q12).
 */

import { ref, shallowRef, computed, type Ref } from 'vue'

import { computeAllLayouts } from '@open-pencil/core/layout'
import {
  MATERIALS_PAGE_NAME,
  getLibrarySession,
  injectLibraryReferences as injectLibraryReferencesCore,
  listDocumentLibraryNames,
  listInjectedReferenceIds,
  loadLibrary,
  setLibrarySession,
  type InjectReferencesResult,
  type LibrarySession
} from '@open-pencil/core/tools'
import type { SceneGraph } from '@open-pencil/scene-graph'

// Mirror of `LibrarySnapshot` in `@open-pencil/agent/prompts`. Kept
// inline so the frontend bundle doesn't depend on the agent package —
// the wire shape is identical by construction.
type LibraryTypeEntry = {
  id: string
  label: string
  description: string
}
type LibraryProfileEntry = {
  id: string
  label: string
  applicableTo: string[]
  markdown: string
}
type LibraryReferenceEntry = {
  id: string
  name: string
  applicableTo: string[]
}
export type LibrarySnapshot = {
  /** id of the profile the user has locked; null when nothing is picked */
  userPickedProfileId: string | null
  types: LibraryTypeEntry[]
  profiles: LibraryProfileEntry[]
  references: LibraryReferenceEntry[]
  /** True when the document has a 参考区 page (mirrors `MATERIALS_PAGE_NAME`). */
  hasReferencesPage: boolean
} | null

import { profileSelection } from '@/app/ai/marketing/settings'
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
  // Profile state is read directly from `profileSelection` (the single
  // source of truth) by `buildMarketingOverlay` per turn. No per-graph
  // cache is maintained here — chip state is always reflected as-is.
  //
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
 * Read the user-picked profile id (if any). Returns `undefined` when the
 * user has not picked a profile in the MarketingConfigBar Profile chip —
 * per P8 (2026-08-01) there is no AI-driven path to set the active
 * profile any more; setup never auto-picks.
 */
export function getActiveProfileId(_store: EditorStore): string | undefined {
  const selection = profileSelection.value
  if (!selection) return undefined
  return selection.id
}

/**
 * Library context for marketing mode: the system prompt's "Material types in
 * the current library" section (so the AI can infer type ids), a 参考区
 * presence note (only when the page exists — the AI never needs to probe for
 * it), plus, when the user has locked a profile, the "Active style profile"
 * markdown (Q6).
 *
 * Profile information is ONLY injected into the agent context when the user
 * has explicitly picked one (per review §2.5.8 / P8, 2026-08-01). Without a
 * user-picked profile:
 *   - The "Profiles in the current library" listing is OMITTED (no profile
 *     catalog leak — the AI has no business knowing what profiles exist if
 *     the user has not chosen any).
 *   - The "Active style profile" section is OMITTED entirely. The system
 *     prompt's wording assumes this section is absent when no profile is
 *     active (see system-prompt-marketing.md).
 *
 * The Material types section is ALWAYS emitted (so the AI can still infer
 * type ids and surface library-load failures to the user).
 */
export function buildMarketingOverlay(graph: SceneGraph): string {
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

  // 参考区 presence: emitted only when the page exists, so the AI never has
  // to probe for it (the overlay is rebuilt per model call, so mid-session
  // injection is reflected on the next call).
  const hasReferencePage = graph.getPages().some((page) => page.name === MATERIALS_PAGE_NAME)
  if (hasReferencePage) {
    parts.push(
      `## 参考区 (library references)\n` +
        `This document has a 参考区 page with library reference designs the user injected. ` +
        `They are reference-only: extract style, palette, composition, and structure ideas ` +
        `(\`look\` for appearance, \`describe\` for layout details) — never copy their content ` +
        `onto the design canvas, and never modify nodes on that page.`
    )
  }

  const selection = profileSelection.value
  const userPicked = selection?.source === 'user'
  const profileId = selection?.id
  const profile = profileId ? profiles.find((entry) => entry.id === profileId) : undefined

  if (userPicked && profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  } else if (userPicked && profileId) {
    // The user picked a profile id that is NOT in the loaded library.
    // Surface the inconsistency rather than silently dropping the pick.
    parts.push(
      `## Active style profile: (not in library)\n` +
        `_Profile "${profileId}" is not present in the loaded library. The user has ` +
        `picked this profile id but the current library file does not contain it. ` +
        `Ask the user to reopen the library dialog and re-pick a profile that exists, ` +
        `or clear the chip in the MarketingConfigBar._`
    )
  }
  // No user-picked profile → emit no profile sections at all. The catalog
  // (## Profiles in the current library) is intentionally omitted so the
  // agent has no visibility into the profile catalog until the user picks.

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

/**
 * Serialize the current library state into a plain-data snapshot the
 * agent backend can consume without touching the editor's SceneGraph.
 * Shipped via the `x-op-library-snapshot` header on `/v1/chat`.
 *
 * Returns null when no library is loaded — the backend then emits no
 * marketing overlay. The reference page flag is captured so the
 * backend can emit the 参考区 paragraph even when no references are
 * present yet (mirrors the frontend `buildMarketingOverlay` semantics).
 *
 * Shape must stay in lockstep with `packages/agent/src/prompts/library-snapshot.ts`
 * `LibrarySnapshot` — see the comment there for the field contract.
 */
export function serializeLibrarySnapshot(graph: SceneGraph): LibrarySnapshot {
  const session = getLibrarySession(graph)
  if (!session) return null
  const index = session.index
  const selection = profileSelection.value
  const userPicked = selection?.source === 'user'
  const profileId = userPicked ? selection.id : null
  const hasReferencesPage = graph.getPages().some((page) => page.name === MATERIALS_PAGE_NAME)

  return {
    userPickedProfileId: profileId ?? null,
    types: index.types.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description ?? ''
    })),
    profiles: index.profiles.map((p) => ({
      id: p.id,
      label: p.label,
      applicableTo: [...p.applicableTo],
      markdown: p.markdown
    })),
    references: index.references.map((r) => ({
      id: r.id,
      name: r.id, // references don't carry a display name; id is the most useful label
      applicableTo: [...r.applicableTo]
    })),
    hasReferencesPage
  }
}
