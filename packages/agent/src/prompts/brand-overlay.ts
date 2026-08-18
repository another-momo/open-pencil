/**
 * Marketing brand overlay builder.
 *
 * The agent reads brand config from the BrandRepository; the only thing
 * the frontend ships per chat request is the picked profile id.
 * `buildMarketingOverlay` takes the repo + that pick and produces the
 * system prompt overlay for the marketing mode.
 */

import type { BrandRepository } from '../brand/index.js'

/**
 * The only field the frontend ships with the chat request after C7. The
 * brand config itself lives in the agent's BrandRepository.
 */
export interface BrandSelection {
  /** Profile id the user picked in the BrandConfigPanel; null = no profile active. */
  pickedProfileId: string | null
}

/**
 * Build the system-prompt overlay from the brand config repo + the user's
 * profile pick. Frontend and backend MUST stay byte-for-byte identical —
 * the same source file is imported from `src/app/ai/marketing/library.ts`
 * for the equivalent frontend hook to guarantee parity.
 *
 * The selection's `pickedProfileId` doubles as the frontend's userPicked
 * distinction: the frontend only ships a non-null id when the user
 * explicitly picked a profile, so a non-null id here means "user-picked".
 */
export function buildMarketingOverlay(
  selection: BrandSelection | null,
  repo: BrandRepository
): string {
  const parts: string[] = []

  const types = repo.effectiveTypes()
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

  const profileId = selection?.pickedProfileId ?? null
  const profile = profileId
    ? repo.effectiveProfiles().find((entry) => entry.id === profileId)
    : undefined

  if (profileId && profile) {
    parts.push(`## Active style profile: ${profile.id}\n${profile.markdown}`)
  } else if (profileId) {
    parts.push(
      `## Active style profile: (not in brand config)\n` +
        `_Profile "${profileId}" is not present in the loaded brand config. ` +
        `Ask the user to re-pick a profile that exists, or clear the chip ` +
        `in the MarketingConfigBar._`
    )
  }

  return `\n\n${parts.join('\n\n')}`
}