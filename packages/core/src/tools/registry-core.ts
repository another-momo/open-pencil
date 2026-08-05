import { evalCode } from './analyze'
import { calc } from './calc'
import { render } from './create'
import { describe } from './describe'
import { generateImage } from './image-gen'
import {
  lookTool,
  createBriefTool,
  readBriefTool,
  setupMaterialTypeTool,
  validateTool
} from './marketing'
import {
  setFill,
  setLayout,
  setLayoutChild,
  setRadius,
  setStroke,
  setText,
  setTextProperties,
  updateNode
} from './modify'
import { findNodes, getJsx, getNode, getSelection, listPages } from './read'
import type { ToolDef } from './schema'
import { stockPhoto } from './stock-photo'
import { batchUpdate, deleteNode, nodeResize, reparentNode } from './structure'
import { viewportZoomToFit } from './vector'

/**
 * Core tools registered by default in AI chat (~30 tools, ~3K schema tokens).
 * Covers 90%+ of design sessions: render, describe, modify, structure, icons.
 */
export const CORE_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getNode,
  findNodes,
  getJsx,
  // list_pages: the marketing prompt's 参考区 check needs page enumeration
  listPages,
  // Create
  render,
  // Modify
  updateNode,
  setLayout,
  setLayoutChild,
  setRadius,
  setFill,
  setStroke,
  setText,
  setTextProperties,
  // Structure
  deleteNode,
  reparentNode,
  nodeResize,
  batchUpdate,
  // Stock photos
  stockPhoto,
  // Image generation / editing
  generateImage,
  // Marketing
  setupMaterialTypeTool,
  validateTool,
  lookTool,
  readBriefTool,
  createBriefTool,
  // Inspect & utility
  describe,
  calc,
  evalCode,
  viewportZoomToFit
]
