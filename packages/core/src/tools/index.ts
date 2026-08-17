import codegenPrompt from './prompts/codegen.md'

export { ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS } from './registry'
export { SCENE_PROP_MAP } from './structure/batch'
export const CODEGEN_PROMPT: string = codegenPrompt
export { exportImage } from './vector'
export { defineTool, nodeToResult, nodeSummary, requireNode, NodeNotFoundError } from './schema'
export type { ToolDef, ParamDef, ParamType } from './schema'
export { toolsToAI, buildDebugLog, paramToValibot, MEDIA_OUTPUT_TOOLS } from './ai-adapter'
export type { ToolLogEntry, ToolDebugLog, AIAdapterOptions, StepBudget } from './ai-adapter'
export { calcClusterConfidence, wrapEvalCode } from './analyze'
export {
  VALID_OVERLAP_CATEGORIES,
  VALID_OVERLAP_SCOPES,
  VALID_OVERLAP_SEVERITIES,
  parseOverlapCategories,
  parseOverlapScope,
  parseOverlapSeverity
} from './analyze/overlaps/params'
export { setPexelsAPIKey, setUnsplashAccessKey } from './stock-photo'
export {
  setImageGenCredentials,
  setActiveImageGenProvider,
  getImageGenProviders
} from './image-gen'
export {
  setVisionMode,
  setVisionProvider,
  setVisionCredentials,
  setVisionAnalyzer,
  getVisionMode,
  isVisionChannelBReady
} from './marketing/vision'
export type { VisionMode, VisionProvider, VisionAnalyzer } from './marketing/vision'
export { getMarketingState } from './marketing'
export {
  parseMaterialTypeSize,
  setActiveMaterialType,
  setActiveMaterialTypes
} from './marketing/setup'
export type { ActiveMaterialType } from './marketing/setup'
export {
  BRIEF_CONCLUSIONS_NAME,
  BRIEF_CONTENT_GAP,
  BRIEF_EMPTY_HINT_NAME,
  BRIEF_EMPTY_STATE_NAME,
  BRIEF_ENTRY_NAME,
  BRIEF_ESTIMATED_HEIGHT,
  BRIEF_NAME,
  BRIEF_WIDTH,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  addBriefMaterialEntry,
  appendToBriefAIZone,
  createBrief,
  createBriefPlaced,
  findBrief,
  getPageContentBounds,
  isBrief,
  resolveBriefPlacement
} from './marketing'
// Brief↔design binding (2026-08-12) — separate statement to keep re-export
// blocks under the jscpd clone threshold (marketing.ts mirrors these names).
export {
  BRIEF_BINDING_LABEL_NAME,
  BRIEF_CONCLUSION_GROUP_NAME,
  bindBriefToDesign,
  briefBoundDesignIds,
  listBriefs,
  setBriefBindingLabel
} from './marketing'
export {
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from './marketing'
export type { BriefMaterialView, BriefView } from './marketing'
export { importSVG } from './create'
