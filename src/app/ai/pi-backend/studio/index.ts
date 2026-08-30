/**
 * T43 studio 资产文件机制——公共出口。
 *
 * 消费方：T-A3 manifest 投影（/api/pi/studio/manifest）、T-B9 每回合组装
 * （base+workflow 文本源）、T-B10 选择器数据面（modes/failures）。
 */

export { loadStudioFromDirs, reloadStudio, getStudioRegistry } from './registry'
export { PROFILE_REQUIRED_SECTIONS } from './validate'
export { splitFrontmatter, indexSections, isAssetId } from './parse'
export type {
  StudioAssetKind,
  StudioBase,
  StudioFailure,
  StudioMode,
  StudioOrigin,
  StudioProfile,
  StudioRegistry,
  StudioWorkflow,
  StudioWorkflowType
} from './types'
