import { describe, expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { loadLibrary } from '@open-pencil/core/tools'

import { expectDefined } from '#tests/helpers/assert'

import { buildDefaultLibraryGraph } from '../src/generate'

describe('default-library.fig round-trip', () => {
  test('exports four named pages, one per zone', () => {
    const graph = buildDefaultLibraryGraph()
    const pages = graph.getPages().map((page) => page.name).sort()
    expect(pages).toEqual(['Components', 'Profiles', 'References', 'Types'])
  })

  test('exported .fig re-parses into the expected LibraryIndex', async () => {
    const graph = buildDefaultLibraryGraph()
    const bytes = await exportFigFile(graph)
    const { index } = await loadLibrary(bytes, 'default-library.fig')

    expect(index.warnings).toEqual([])

    expect(index.types.map((type) => type.id)).toEqual([
      'wechat_moments',
      'wechat_article_cover',
      'xiaohongshu',
      'ecommerce_detail',
      'event_poster',
      'dsp_banner',
      'product_long'
    ])
    const productLong = expectDefined(index.types.find((type) => type.id === 'product_long'))
    expect(productLong.size).toEqual({ width: 750, height: null })
    expect(productLong.anchors).toEqual([
      { template: 'BrandBar', position: 'top' },
      { template: 'CTABar', position: 'bottom' }
    ])
    const xiaohongshu = expectDefined(index.types.find((type) => type.id === 'xiaohongshu'))
    expect(xiaohongshu.anchors).toEqual([{ template: 'BrandBar', position: 'bottom' }])

    expect(index.profiles.map((profile) => profile.id)).toEqual(['casual_v1'])
    expect(index.profiles[0].label).toBe('休闲活泼风格')
    expect(index.profiles[0].description).toContain('配色')
    expect(index.profiles[0].markdown).toContain('休闲活泼风格')
    expect(index.profiles[0].applicableTo).toContain('xiaohongshu')

    expect(index.components.map((component) => component.name)).toEqual(['BrandBar', 'CTABar'])
    const brandBar = expectDefined(
      index.components.find((component) => component.name === 'BrandBar')
    )
    expect(brandBar.readonlyNames).toEqual(['logo', 'brandName'])
    const ctaBar = expectDefined(index.components.find((component) => component.name === 'CTABar'))
    expect(ctaBar.readonlyNames).toEqual(['qrCode'])

    expect(index.references.map((reference) => reference.id)).toEqual(['ref-product-long-001'])
    expect(index.references[0].for).toBe('product_long')
    expect(index.references[0].tags).toEqual(['luxury_v1'])
  })

  test('library components survive the round-trip as COMPONENT nodes with image bytes', async () => {
    const graph = buildDefaultLibraryGraph()
    const bytes = await exportFigFile(graph)
    const { graph: parsed, index } = await loadLibrary(bytes, 'default-library.fig')

    const brandBar = expectDefined(
      index.components.find((component) => component.name === 'BrandBar')
    )
    const node = expectDefined(parsed.getNode(brandBar.nodeId))
    expect(node.type).toBe('COMPONENT')

    const logo = node.childIds
      .map((id) => parsed.getNode(id))
      .find((child) => child?.name === 'logo')
    const imageFill = logo?.fills.find((fill) => fill.type === 'IMAGE')
    expect(imageFill && 'imageHash' in imageFill ? imageFill.imageHash : undefined).toBeDefined()
    const hash = imageFill && 'imageHash' in imageFill ? imageFill.imageHash : undefined
    expect(hash && parsed.images.get(hash)).toBeDefined()

    // All library text uses Alibaba PuHuiTi
    const brandName = node.childIds
      .map((id) => parsed.getNode(id))
      .find((child) => child?.name === 'brandName')
    expect(brandName?.fontFamily).toBe('Alibaba PuHuiTi')
  })
})
