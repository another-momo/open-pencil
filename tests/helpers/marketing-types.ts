/** Shared result shapes for marketing tool tests (type-shapes dedupe). */

export interface AnchorResult {
  template: string
  position: string
  instanceId: string
}

export interface SetupToolResult {
  error?: string
  rootFrameId?: string
  anchors?: AnchorResult[]
}
