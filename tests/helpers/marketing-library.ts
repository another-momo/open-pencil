/**
 * Mini marketing library for engine tests (docs/plans/l2-resource-library.md
 * 任务 12): built programmatically — no real .fig fixture, so tests never
 * touch the parser or LFS assets.
 */

import { SceneGraph } from '@open-pencil/core'

import { parseLibraryIndex, setLibrarySession } from '#core/tools/marketing/library'

export const MINI_LIBRARY_NAME = 'test-library.fig'

export function makeMiniLibraryGraph(): SceneGraph {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id

  const types = graph.createNode('FRAME', pageId, { name: 'Types' })

  const moments = graph.createNode('FRAME', types.id, { name: 'wechat_moments' })
  graph.createNode('TEXT', moments.id, { text: 'id: wechat_moments' })
  graph.createNode('TEXT', moments.id, { text: 'label: 朋友圈广告' })
  graph.createNode('TEXT', moments.id, { text: 'size: 1080x1080' })

  const productLong = graph.createNode('FRAME', types.id, { name: 'product_long' })
  graph.createNode('TEXT', productLong.id, { text: 'id: product_long' })
  graph.createNode('TEXT', productLong.id, { text: 'label: 产品长图' })
  graph.createNode('TEXT', productLong.id, { text: 'size: 750x' })
  graph.createNode('TEXT', productLong.id, { text: 'anchor_first: BrandBar' })
  graph.createNode('TEXT', productLong.id, { text: 'anchor_last: CTABar' })

  const profiles = graph.createNode('FRAME', pageId, { name: 'Profiles' })
  const casual = graph.createNode('FRAME', profiles.id, { name: 'casual_v1' })
  graph.createNode('TEXT', casual.id, { text: '# 休闲风格\n轻松活泼' })
  graph.createNode('TEXT', casual.id, { text: 'applicable_to: product_long' })
  const luxury = graph.createNode('FRAME', profiles.id, { name: 'luxury_v1' })
  graph.createNode('TEXT', luxury.id, { text: '# 高端风格\n深底金字' })
  graph.createNode('TEXT', luxury.id, { text: 'applicable_to: wechat_moments' })

  const components = graph.createNode('FRAME', pageId, { name: 'Components' })

  const brandBar = graph.createNode('COMPONENT', components.id, { name: 'BrandBar' })
  graph.createNode('TEXT', brandBar.id, { text: 'readonly: logo, brandName' })
  graph.createNode('RECTANGLE', brandBar.id, { name: 'logo', width: 40, height: 40 })
  graph.createNode('TEXT', brandBar.id, { name: 'brandName', text: '品牌名' })

  const ctaBar = graph.createNode('COMPONENT', components.id, { name: 'CTABar' })
  graph.createNode('TEXT', ctaBar.id, { name: 'ctaText', text: '立即了解' })

  const references = graph.createNode('FRAME', pageId, { name: 'References' })
  const ref = graph.createNode('FRAME', references.id, { name: 'ref-product-long-001' })
  graph.createNode('TEXT', ref.id, { text: 'for: product_long' })
  graph.createNode('TEXT', ref.id, { text: 'tag: luxury_v1' })

  return graph
}

/** Attach a parsed mini library as the document's library session */
export function attachMiniLibrary(docGraph: SceneGraph): void {
  const libGraph = makeMiniLibraryGraph()
  setLibrarySession(docGraph, {
    name: MINI_LIBRARY_NAME,
    graph: libGraph,
    index: parseLibraryIndex(libGraph),
    refInjections: new Map()
  })
}
