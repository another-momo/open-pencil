/** Shared result shapes for marketing tool tests (type-shapes dedupe). */

export interface SetupToolResult {
  error?: string
  rootFrameId?: string
  rootFrameName?: string
  page?: string
  adopted?: boolean
  existingChildren?: number
  note?: string
}
