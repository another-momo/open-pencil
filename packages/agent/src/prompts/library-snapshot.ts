/**
 * Serializable snapshot of the marketing library state at message-send time.
 *
 * The agent backend doesn't have access to the editor's SceneGraph, so the
 * frontend serializes what `prepareCall` needs (profile markdown, types,
 * profiles, references) into this shape and ships it via the
 * `x-op-library-snapshot` header on `/v1/chat`.
 */
export type LibraryTypeEntry = {
  id: string
  label: string
  description: string
}

export type LibraryProfileEntry = {
  id: string
  label: string
  applicableTo: string[]
  markdown: string
}

export type LibraryReferenceEntry = {
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

/**
 * Build the marketing system-prompt overlay from a LibrarySnapshot.
 *
 * Mirrors `src/app/ai/marketing/library.ts#buildMarketingOverlay` byte-for-byte
 * so Path A (agent backend) and Path B (browser-in-process) produce identical
 * prompts. Profile information is only injected when the user has explicitly
 * picked one — the AI has no business knowing which profiles exist otherwise.
 */
export function buildMarketingOverlay(snapshot: LibrarySnapshot): string {
  if (!snapshot) return ''

  const parts: string[] = []

  if (snapshot.types.length > 0) {
    const lines = snapshot.types.map(
      (type) =>
        `- ${type.id} (${type.label})${type.description ? `: ${type.description}` : ''}`
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

  if (snapshot.hasReferencesPage) {
    parts.push(
      `## 参考区 (library references)\n` +
        'This document has a 参考区 page with library reference designs the user injected. ' +
        'They are reference-only: extract style, palette, composition, and structure ideas ' +
        '(`look` for appearance, `describe` for layout details) — never copy their content ' +
        'onto the design canvas, and never modify nodes on that page.'
    )
  }

  const userPicked = typeof snapshot.userPickedProfileId === 'string'
  const profileId = snapshot.userPickedProfileId
  const profile =
    profileId !== null && profileId !== undefined
      ? snapshot.profiles.find((entry) => entry.id === profileId)
      : undefined

  if (userPicked && profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  } else if (userPicked && profileId) {
    // User picked a profile id that is NOT in the loaded library. Surface
    // the inconsistency rather than silently dropping the pick.
    parts.push(
      `## Active style profile: (not in library)\n` +
        `_Profile "${profileId}" is not present in the loaded library. The user has ` +
        'picked this profile id but the current library file does not contain it. ' +
        'Ask the user to reopen the library dialog and re-pick a profile that exists, ' +
        'or clear the chip in the MarketingConfigBar._'
    )
  }
  // No user-picked profile → emit no profile sections at all. The catalog
  // ("## Profiles in the current library") is intentionally omitted so the
  // agent has no visibility into the profile catalog until the user picks.

  return `\n\n${parts.join('\n\n')}`
}