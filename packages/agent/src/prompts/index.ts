import {
  SYSTEM_PROMPT_BASE,
  SYSTEM_PROMPT_DESIGN,
  SYSTEM_PROMPT_MARKETING
} from './generated/prompts.js'

export const SYSTEM_PROMPT = SYSTEM_PROMPT_DESIGN

// Mirrors the constant from src/app/ai/chat/transports.ts:61
export const SYSTEM_PROMPT_MARKETING_FULL = SYSTEM_PROMPT_BASE + SYSTEM_PROMPT_MARKETING

export { buildMarketingOverlay } from './brand-overlay.js'
export type { BrandSelection } from './brand-overlay.js'