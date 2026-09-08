/**
 * T43 studio 资产文件机制——公共出口。
 *
 * 消费方：T-A3 manifest 投影（/api/pi/studio/manifest）、T-B9 每回合组装
 * （base+workflow 文本源）、T-B10 选择器数据面（modes/failures）。
 *
 * P2-6（2026-09-07）：移除 `indexSections` 导出（sections 字段随 P2-6 删除）。
 */

export { loadStudioFromDirs, reloadStudio, getStudioRegistry } from './registry'
export { splitFrontmatter, isAssetId } from './parse'
export { referenceBucketKey } from './types'
export type {
  StudioAssetKind,
  StudioAssetReference,
  StudioBase,
  StudioFailure,
  StudioMode,
  StudioOrigin,
  StudioProfile,
  StudioRegistry,
  StudioSizePreset,
  StudioWorkflow
} from './types'
