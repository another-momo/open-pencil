/**
 * Shared helpers for the hero-slot marketing tools (compose_backdrop,
 * prepare_hero_scaffold). Both key off the HeroContent flow slot of an
 * auto-layout root frame and accept the same hero_bleed parameter, so the
 * lookup and validation live here once.
 */

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Name of the root's flow child that reserves the hero slot and hosts the hero copy. */
export const HERO_CONTENT_NAME = 'HeroContent'

export function findChildByName(
  parent: SceneNode,
  graph: SceneGraph,
  name: string
): SceneNode | undefined {
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (child?.name === name) return child
  }
  return undefined
}

export function validateHeroBleed(heroBleed: number): string | undefined {
  if (!Number.isFinite(heroBleed) || heroBleed < 0) {
    return `hero_bleed must be a finite number ≥ 0 (got ${heroBleed}).`
  }
  if (heroBleed > 1000) {
    return `hero_bleed ${heroBleed} exceeds the 1000px maximum — check for a typo.`
  }
  return undefined
}

/**
 * Resolve the long-image root frame: must exist, be a FRAME, and carry
 * auto-layout. `noAutoLayoutError` is tool-specific — each caller explains
 * why ITS topology needs a flow layout.
 */
export function requireAutoLayoutRootFrame(
  graph: SceneGraph,
  rootId: string,
  noAutoLayoutError: string
): { root: SceneNode } | { error: string } {
  const root = graph.getNode(rootId)
  if (!root) return { error: `Root frame "${rootId}" not found.` }
  if (root.type !== 'FRAME') {
    return {
      error: `Root "${rootId}" is a ${root.type}, not a FRAME. Pass the long-image canvas frame.`
    }
  }
  if (root.layoutMode === 'NONE') return { error: noAutoLayoutError }
  return { root }
}
