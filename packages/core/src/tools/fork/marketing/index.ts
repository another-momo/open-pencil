/**
 * brief 三件套导出（T52）。集成纪律：FORK_TOOLS（fork/index.ts）与
 * pi-backend 暴露面由主 agent 集成期统一接线，本文件只交付 BRIEF_TOOLS 数组。
 */

import type { ToolDef } from '#core/tools/schema'

import { appendBriefConclusionTool, createBriefTool, readBriefTool } from './tools'

export const BRIEF_TOOLS: ToolDef[] = [createBriefTool, readBriefTool, appendBriefConclusionTool]

export { appendBriefConclusionTool, createBriefTool, readBriefTool } from './tools'
