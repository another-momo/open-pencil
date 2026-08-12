/** Shared result shapes for marketing tool tests (type-shapes dedupe). */

export interface AnchorResult {
  template: string
  position: string
  instanceId: string
}

export interface SetupToolResult {
  error?: string
  rootFrameId?: string
  rootFrameName?: string
  page?: string
  adopted?: boolean
  existingChildren?: number
  note?: string
  anchors?: AnchorResult[]
  repaired?: string[]
}
