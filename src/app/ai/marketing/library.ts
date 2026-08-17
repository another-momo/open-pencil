/**
 * Marketing brand-config service (P3: replaces library.ts).
 *
 * After P3 the frontend reads the brand config from the agent backend's
 * `/v1/brand/manifest` endpoint. The shipped default lives at
 * `public/default-brand/config.yaml` (loaded by the agent on first boot
 * and seeded into SQLite). This file is a thin shim around the
 * brand-config service: it tracks the active brand config in a shallow
 * ref, builds the system-prompt overlay per turn, and exposes the
 * MarketingConfigBar profile chip state.
 *
 * The brand config loads from `GET /v1/brand/manifest` (merged default +
 * user layers); the only per-request wire field is the user's picked
 * profile id (`BrandSelection` below). `setup_material_type` resolves
 * types from the brand config directly.
 *
 * The hook surface (`useMarketingLibrary`, `buildMarketingOverlay`,
 * `getActiveProfileId`, `maybeAutoOpenLibraryDialog`) is intentionally
 * preserved so existing callers (MarketingConfigBar.vue, transports.ts)
 * keep working with minimal churn.
 */

import { computed, type Ref, ref, shallowRef } from 'vue'

import type { EffectiveBrandConfig } from '@open-pencil/agent/brand'
import { parseMaterialTypeSize, setActiveMaterialTypes } from '@open-pencil/core/tools'
import type { ActiveMaterialType } from '@open-pencil/core/tools'

import { profileSelection } from '@/app/ai/marketing/settings'
import { getActiveEditorStore, type EditorStore } from '@/app/editor/active-store'

/**
 * Mirror of `BrandSelection` in `@open-pencil/agent/prompts`. P3: the
 * frontend only ships the user's profile pick — types and profiles live
 * in the agent's BrandRepository.
 */
export type BrandSelection = {
  pickedProfileId: string | null
} | null

const current = shallowRef<EffectiveBrandConfig | null>(null)
const brandLoadError = ref('')
const dialogOpen = ref(false)
let dialogAutoShown = false

/** Reactive handle to the current brand config (null until loaded) */
export function useMarketingLibrary() {
  return current
}

/** Non-empty when the brand config failed to load — surfaced in the UI */
export function useLibraryLoadError() {
  return brandLoadError
}

export function getMarketingLibrary(): EffectiveBrandConfig | null {
  return current.value
}

export function listMarketingTypes(): { id: string; label: string; description?: string }[] {
  return (current.value?.types ?? []).map((entry) => {
    const out: { id: string; label: string; description?: string } = {
      id: entry.id,
      label: entry.label
    }
    if (entry.description) out.description = entry.description
    return out
  })
}

/**
 * Replace the in-memory brand config (used after fetch / import). The
 * MarketingConfigBar reactively re-reads via `useMarketingLibrary()`.
 */
export function setBrandConfig(config: EffectiveBrandConfig): void {
  current.value = config
  pushActiveMaterialTypes(config)
}

/**
 * Push the brand config's material types into core's `setup_material_type`
 * registry, parsing the wire-format sizes ("1080x1080" / "750x" for HUG).
 * Both chat paths execute the tool in this process — Path B via the
 * in-browser ToolLoopAgent, Path A via the automation bridge's reverse-RPC
 * tool dispatch — so one push covers both. A null config (load failed)
 * clears the registry: only `custom` sizes work, matching the overlay's
 * no-types fallback. Types with malformed sizes are skipped individually.
 */
export function pushActiveMaterialTypes(config: EffectiveBrandConfig | null): void {
  if (!config) {
    setActiveMaterialTypes(undefined)
    return
  }
  const types: ActiveMaterialType[] = []
  for (const type of config.types) {
    const size = parseMaterialTypeSize(type.size)
    if (size) types.push({ id: type.id, label: type.label, size })
  }
  setActiveMaterialTypes(types)
}

/**
 * Read the user-picked profile id (if any). Returns undefined when the
 * user has not picked a profile in the MarketingConfigBar Profile chip.
 */
export function getActiveProfileId(_store: EditorStore): string | undefined {
  const selection = profileSelection.value
  if (!selection) return undefined
  return selection.id
}

/**
 * Marketing system-prompt overlay: types list + (when the user has
 * explicitly picked a profile) the active profile markdown. The profile
 * catalog is intentionally omitted when no profile is active — without a
 * user-picked profile the AI has no business knowing what profiles exist.
 */
export function buildMarketingOverlay(_graph: unknown): string {
  const parts: string[] = []

  const brand = current.value
  const types = brand?.types ?? []
  const profiles = brand?.profiles ?? []

  if (types.length > 0) {
    const lines = types.map(
      (type) => `- ${type.id} (${type.label})${type.description ? `: ${type.description}` : ''}`
    )
    parts.push(`## Material types in the current brand\n${lines.join('\n')}`)
  } else {
    parts.push(
      `## Material types in the current brand\n` +
        `_No material types available. The brand config may have failed to load, ` +
        `or the bound brand config has no Types. Use \`setup_material_type\` with ` +
        `\`materialType: "custom"\` and width+height._`
    )
  }

  const selection = profileSelection.value
  const userPicked = selection?.source === 'user'
  const profileId = selection?.id
  const profile = profileId ? profiles.find((entry) => entry.id === profileId) : undefined

  if (userPicked && profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  } else if (userPicked && profileId) {
    parts.push(
      `## Active style profile: (not in brand config)\n` +
        `_Profile "${profileId}" is not present in the loaded brand config. ` +
        `Ask the user to re-pick a profile that exists, or clear the chip ` +
        `in the MarketingConfigBar._`
    )
  }

  return `\n\n${parts.join('\n\n')}`
}

export function useLibraryDialogOpen() {
  return dialogOpen
}

export function openLibraryDialog(): void {
  dialogOpen.value = true
}

/**
 * Test-only: reset the in-memory brand config so the next call sees the
 * empty/initial state. Not part of the public API.
 */
export function __resetMarketingLibraryForTest(): void {
  current.value = null
  pushActiveMaterialTypes(null)
  brandLoadError.value = ''
  loadPromise = null
  dialogAutoShown = false
  profileSelection.value = null
}

let loadPromise: Promise<EffectiveBrandConfig | null> | null = null

/**
 * Marketing session start: load the brand config from the agent backend
 * (or fall back to hardcoded defaults when no agent is available — Path B
 * for the web build). The MarketingConfigBar reactively re-reads from
 * `useMarketingLibrary()`.
 */
export async function maybeAutoOpenLibraryDialog(graph: unknown): Promise<void> {
  await ensureBrandConfig()
  // `graph` is unused since P3 removed reference tracking — the parameter
  // stays so existing callers keep working without signature churn.
  void graph
  if (!dialogAutoShown) {
    dialogAutoShown = true
    dialogOpen.value = true
  }
}

/**
 * Load the brand config from the agent backend. When the agent is not
 * available (web preview without a local backend), fall back to a
 * hardcoded default that mirrors the shipped `public/default-brand/config.yaml`.
 */
import { resolveAgentBackendURL } from '@/app/ai/chat/agent-transport'

export async function ensureBrandConfig(): Promise<EffectiveBrandConfig | null> {
  if (current.value) return current.value
  loadPromise ??= (async () => {
    try {
      const baseUrl = resolveAgentBackendURL() ?? 'http://127.0.0.1:7601'
      const response = await fetch(`${baseUrl}/v1/brand/manifest`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const config = (await response.json()) as EffectiveBrandConfig
      current.value = config
      pushActiveMaterialTypes(config)
      brandLoadError.value = ''
      return config
    } catch (error) {
      current.value = null
      pushActiveMaterialTypes(null)
      brandLoadError.value = `brand config: ${error instanceof Error ? error.message : String(error)}`
      return null
    }
  })()
  return loadPromise
}

/** Retry after a failed brand config load. */
export function retryMarketingLibraryLoad(): Promise<EffectiveBrandConfig | null> {
  loadPromise = null
  return ensureBrandConfig()
}

// Re-export for tests / consumers that still reference the marketing store
// via the active-editor accessor.
export function useEditorStore() {
  return getActiveEditorStore()
}

// --- P3 no-op shims ---
//
// The library-injection / reference-tracking machinery was deleted in P3.
// Callers that imported these symbols — chiefly `MarketingConfigBar.vue` —
// keep working until the Bar is re-wired to the new BrandConfigPanel
// (mount entry is a follow-up). These shims return empty values so the
// module loads without breakage; their UI affordances (the References chip,
// the Upload button in the library dialog) become no-ops.

interface InjectLibraryReferencesResult {
  injected: string[]
  skipped: string[]
  warnings: string[]
}

/** @deprecated P3 removed library reference injection — kept as no-op for import compat. */
export function injectLibraryReferences(
  _store: EditorStore,
  _refIds: string[]
): InjectLibraryReferencesResult {
  return { injected: [], skipped: [], warnings: [] }
}

/** @deprecated P3 removed reference tracking — kept as no-op for import compat. */
export function useInjectedReferenceIds(): Readonly<Ref<Set<string>>> {
  return computed(() => new Set<string>())
}

/** @deprecated P3 removed per-document library mismatch — no library is bound any more. */
export function documentLibraryMismatch(_graph: unknown): string[] {
  return []
}

/** @deprecated P3 removed library file upload — BrandConfigPanel handles YAML import. */
export async function replaceMarketingLibrary(
  _file: File
): Promise<EffectiveBrandConfig | { error: string }> {
  return { error: 'P3 removed library file upload — use the BrandConfigPanel import tab.' }
}
