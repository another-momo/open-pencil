/**
 * T54（Phase 3 W2/T-B3）：fork image-gen 模块出口。
 *
 * IMAGE_GEN_TOOLS = 落图段桥端点（image_gen_begin / image_gen_commit）。
 * 接线（注册进 FORK_TOOLS → ALL_TOOLS）是主 agent 集成期动作——本任务
 * 不改 fork/index.ts（并行波次纪律）。
 */

import type { ToolDef } from '#core/tools/schema'

import { imageGenBegin, imageGenCommit } from './tools'

export const IMAGE_GEN_TOOLS: ToolDef[] = [imageGenBegin, imageGenCommit]

export {
  beginImageGen,
  commitImageGen,
  extractReferenceImages,
  protectedRedirect,
  type ImageGenBeginResult,
  type ImageGenCommitResult
} from './apply'
export { isInImageHistory, snapshotBeforeOverwrite, type HistorySnapshot } from './history'
export {
  findPlacementPosition,
  getPageContentBounds,
  PLACEMENT_GAP
} from '#core/tools/fork/placement'
export {
  normalizeDimensions,
  normalizeSize,
  parseImageGenRequests,
  parseReferences,
  type ImageGenBackground,
  type ImageGenFormat,
  type ImageGenProvider,
  type ImageGenQuality,
  type ImageGenReference,
  type ImageGenRequest,
  type ImageGenResult,
  type ParsedImageGenRequests
} from './requests'
export { imageGenBegin, imageGenCommit } from './tools'
