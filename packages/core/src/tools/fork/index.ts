/**
 * Fork-owned tool registration seam (rebuild/v2).
 *
 * Fork tools are defined as NEW files under this directory and listed in
 * FORK_TOOLS. The upstream registry (registry-core.ts / registry-extended.ts)
 * stays pristine; the only upstream touch point is a single spread in
 * registry.ts (registered patch P22). Precedent in upstream's own style:
 * component-catalog.ts's registerComponentCatalog.
 *
 * W2 登记者：BRIEF_TOOLS（T52 brief 三件套）、lookTool（T55）、
 * IMAGE_GEN_TOOLS（T54 落图段桥端点——generate_image 本体在 pi-backend
 * 后端段装配，不经此表）。
 */
import type { ToolDef } from '#core/tools/schema'

import { IMAGE_GEN_TOOLS } from './image-gen'
import { BRIEF_TOOLS } from './marketing'
import { lookTool } from './marketing/look'

export const FORK_TOOLS: ToolDef[] = [...BRIEF_TOOLS, lookTool, ...IMAGE_GEN_TOOLS]
