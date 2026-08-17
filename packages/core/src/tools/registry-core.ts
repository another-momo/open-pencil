import { evalCode } from './analyze'
import { calc } from './calc'
import { render } from './create'
import { describe } from './describe'
import { generateImage } from './image-gen'
import {
  lookTool,
  appendBriefConclusionTool,
  composeBackdropTool,
  createBriefTool,
  derivePaletteTool,
  prepareHeroScaffoldTool,
  readBriefTool,
  sampleHeroColorTool,
  setupMaterialTypeTool
} from './marketing'
import {
  setBlend,
  setConstraints,
  setEffects,
  setFill,
  setFont,
  setFontRange,
  setImageFill,
  setLayout,
  setLayoutChild,
  setLocked,
  setMinMax,
  setOpacity,
  setRadius,
  setRotation,
  setStroke,
  setStrokeAlign,
  setText,
  setTextProperties,
  setTextResize,
  setVisible,
  updateNode
} from './modify'
import { findNodes, getJSX, getNode, getSelection, listPages } from './read'
import type { ToolDef } from './schema'
import { stockPhoto } from './stock-photo'
import {
  batchUpdate,
  cloneNode,
  deleteNode,
  groupNodes,
  nodeResize,
  renameNode,
  reparentNode,
  ungroupNode
} from './structure'
import { viewportZoomToFit } from './vector'

/**
 * Core tools registered by default in AI chat (~47 tools, ~4K schema tokens).
 * Covers 90%+ of design sessions: render, describe, the full modify stack,
 * common structure ops, marketing workflow, icons.
 *
 * Exposure rule: prompt files may only reference tools in this list — the
 * built-in agent (ui + marketing chat modes) sees nothing else. Extended
 * domains (variables, vector ops, codegen, advanced structure/graph reads)
 * stay MCP/CLI-only in registry-extended.ts.
 */
export const CORE_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getNode,
  findNodes,
  getJSX,
  // list_pages: page enumeration for multi-page documents
  listPages,
  // Create
  render,
  // Modify
  updateNode,
  setLayout,
  setLayoutChild,
  setRadius,
  setFill,
  setImageFill,
  setStroke,
  setStrokeAlign,
  setEffects,
  setOpacity,
  setVisible,
  setRotation,
  setBlend,
  setLocked,
  setConstraints,
  setMinMax,
  setText,
  setTextProperties,
  setTextResize,
  setFont,
  setFontRange,
  // Structure
  deleteNode,
  reparentNode,
  nodeResize,
  cloneNode,
  renameNode,
  groupNodes,
  ungroupNode,
  batchUpdate,
  // Stock photos
  stockPhoto,
  // Image generation / editing
  generateImage,
  // Marketing
  setupMaterialTypeTool,
  lookTool,
  readBriefTool,
  createBriefTool,
  appendBriefConclusionTool,
  sampleHeroColorTool,
  composeBackdropTool,
  prepareHeroScaffoldTool,
  derivePaletteTool,
  // Inspect & utility
  describe,
  calc,
  evalCode,
  viewportZoomToFit
]
