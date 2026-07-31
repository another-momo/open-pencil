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
  const typesPage = graph.addPage('Types')
  const profilesPage = graph.addPage('Profiles')
  const componentsPage = graph.addPage('Components')
  const referencesPage = graph.addPage('References')

  const moments = graph.createNode('FRAME', typesPage.id, { name: 'wechat_moments' })
  graph.createNode('TEXT', moments.id, { text: 'id: wechat_moments' })
  graph.createNode('TEXT', moments.id, { text: 'label: 朋友圈广告' })
  graph.createNode('TEXT', moments.id, { text: 'size: 1080x1080' })

  const productLong = graph.createNode('FRAME', typesPage.id, { name: 'product_long' })
  graph.createNode('TEXT', productLong.id, { text: 'id: product_long' })
  graph.createNode('TEXT', productLong.id, { text: 'label: 产品长图' })
  graph.createNode('TEXT', productLong.id, { text: 'size: 750x' })
  graph.createNode('TEXT', productLong.id, { text: 'anchor_first: BrandBar' })
  graph.createNode('TEXT', productLong.id, { text: 'anchor_last: CTABar' })

  const casual = graph.createNode('FRAME', profilesPage.id, { name: 'casual_v1' })
  graph.createNode('TEXT', casual.id, {
    text: '# 休闲风格\n轻松活泼，年轻直接的促销感语言。\n\n- 配色：主色 #FF6B35\n- 字体：Alibaba PuHuiTi'
  })
  graph.createNode('TEXT', casual.id, { text: 'applicable_to: product_long' })
  const luxury = graph.createNode('FRAME', profilesPage.id, { name: 'luxury_v1' })
  graph.createNode('TEXT', luxury.id, {
    text: '# 高端风格\n深底金字，克制叙事的高级感。\n\n- 配色：#0F0F0F + #C9A66B\n- 字体：Alibaba PuHuiTi 700'
  })
  graph.createNode('TEXT', luxury.id, { text: 'applicable_to: wechat_moments' })

  const brandBar = graph.createNode('COMPONENT', componentsPage.id, { name: 'BrandBar' })
  graph.createNode('TEXT', brandBar.id, { text: 'readonly: logo, brandName' })
  graph.createNode('RECTANGLE', brandBar.id, { name: 'logo', width: 40, height: 40 })
  graph.createNode('TEXT', brandBar.id, { name: 'brandName', text: '品牌名' })

  const ctaBar = graph.createNode('COMPONENT', componentsPage.id, { name: 'CTABar' })
  graph.createNode('TEXT', ctaBar.id, { name: 'ctaText', text: '立即了解' })

  const ref = graph.createNode('FRAME', referencesPage.id, { name: 'ref-product-long-001' })
  graph.createNode('TEXT', ref.id, { text: 'applicable_to: product_long' })
  graph.createNode('TEXT', ref.id, { text: 'tag: luxury_v1' })

  return graph
}

/** Attach a parsed mini library as the document's library session */
export function attachMiniLibrary(docGraph: SceneGraph): void {
  const libGraph = makeMiniLibraryGraph()
  setLibrarySession(docGraph, {
    name: MINI_LIBRARY_NAME,
    graph: libGraph,
    index: parseLibraryIndex(libGraph)
  })
}
