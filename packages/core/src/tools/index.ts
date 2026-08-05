import codegenPrompt from './prompts/codegen.md'

export { ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS } from './registry'
export const CODEGEN_PROMPT: string = codegenPrompt
export { exportImage } from './vector'
export { defineTool, nodeToResult, nodeSummary, requireNode, NodeNotFoundError } from './schema'
export type { ToolDef, ParamDef, ParamType } from './schema'
export { toolsToAI, buildDebugLog } from './ai-adapter'
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
export { setPexelsApiKey, setUnsplashAccessKey } from './stock-photo'
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
  cloneSubtreeAcrossGraphs,
  listDocumentLibraryNames,
  markLibraryReference
} from './marketing'
export {
  getDefaultLibrary,
  getLibrarySession,
  injectLibraryReferences,
  listInjectedReferenceIds,
  loadLibrary,
  parseLibraryIndex,
  setDefaultLibrary,
  setLibrarySession
} from './marketing'
export type { InjectReferencesResult, LibraryIndex, LibrarySession } from './marketing'
export {
  BRIEF_CONCLUSIONS_NAME,
  BRIEF_EMPTY_HINT_NAME,
  BRIEF_EMPTY_STATE_NAME,
  BRIEF_ENTRY_NAME,
  BRIEF_NAME,
  BRIEF_ZONE_AI_NAME,
  BRIEF_ZONE_MATERIALS_NAME,
  BRIEF_ZONE_USER_NAME,
  addBriefMaterialEntry,
  appendToBriefAiZone,
  createBrief,
  findBrief,
  isBrief
} from './marketing'
export {
  readBrief,
  removeBriefMaterial,
  updateBriefContent,
  updateMaterialCaption
} from './marketing'
export type { BriefMaterialView, BriefView } from './marketing'
export { importSvg } from './create'
