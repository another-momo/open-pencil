import {
  analyzeClusters,
  analyzeColors,
  analyzeOverlaps,
  analyzeSpacing,
  analyzeTypography,
  diffCreate,
  diffShow
} from './analyze'
import { designToComponentMap, designToTokens } from './codegen'
import {
  createComponent,
  createInstance,
  createPage,
  createShape,
  createSlice,
  createVector,
  fetchIconsTool,
  importSVG,
  insertIcon,
  searchIconsTool
} from './create'
import {
  diffJSX,
  getComponents,
  getCurrentPage,
  getPageTree,
  listAvailableFonts,
  listFonts,
  pageBounds,
  queryNodes,
  selectNodes,
  switchPage
} from './read'
import type { ToolDef } from './schema'
import {
  arrangeNodes,
  flattenNodes,
  nodeAncestors,
  nodeBindings,
  nodeBounds,
  nodeChildren,
  nodeMove,
  nodeReplaceWith,
  nodeToComponent,
  nodeTree
} from './structure'
import {
  bindVariable,
  createCollection,
  createVariable,
  deleteCollection,
  deleteVariable,
  findVariables,
  getCollection,
  getVariable,
  listCollections,
  listVariables,
  setVariable,
  unbindVariable
} from './variables'
import {
  booleanExclude,
  booleanIntersect,
  booleanSubtract,
  booleanUnion,
  exportImage,
  exportPDF,
  exportSVG,
  pathFlip,
  pathGet,
  pathMove,
  pathScale,
  pathSet,
  viewportGet,
  viewportSet
} from './vector'

/**
 * Extended tools not in CORE_TOOLS — variables, vector ops, analysis,
 * codegen, advanced structure and graph reads, path manipulation, export.
 * The full modify stack and common structure ops (clone/rename/group)
 * live in CORE_TOOLS. (list_pages lives in CORE_TOOLS.)
 */
export const EXTENDED_TOOLS: ToolDef[] = [
  // Read (advanced)
  getPageTree,
  getCurrentPage,
  selectNodes,
  queryNodes,
  getComponents,
  switchPage,
  pageBounds,
  listFonts,
  listAvailableFonts,
  diffJSX,
  // Create (advanced)
  createShape,
  searchIconsTool,
  insertIcon,
  fetchIconsTool,
  createComponent,
  createInstance,
  createPage,
  createVector,
  createSlice,
  importSVG,
  // Structure (advanced)
  nodeMove,
  arrangeNodes,
  flattenNodes,
  nodeToComponent,
  nodeBounds,
  nodeAncestors,
  nodeChildren,
  nodeTree,
  nodeBindings,
  nodeReplaceWith,
  // Variables
  listVariables,
  listCollections,
  getVariable,
  findVariables,
  createVariable,
  setVariable,
  deleteVariable,
  bindVariable,
  unbindVariable,
  getCollection,
  createCollection,
  deleteCollection,
  // Vector & export
  booleanUnion,
  booleanSubtract,
  booleanIntersect,
  booleanExclude,
  pathGet,
  pathSet,
  pathScale,
  pathFlip,
  pathMove,
  viewportGet,
  viewportSet,
  exportSVG,
  exportPDF,
  exportImage,
  // Analyze & diff
  analyzeColors,
  analyzeTypography,
  analyzeSpacing,
  analyzeClusters,
  analyzeOverlaps,
  diffCreate,
  diffShow,
  // Codegen
  designToTokens,
  designToComponentMap
]
