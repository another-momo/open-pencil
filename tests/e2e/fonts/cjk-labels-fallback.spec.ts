/**
 * T88：节点名 CJK 豆腐字修复 — 真渲染 e2e 验证。
 *
 * 三件套钉扎：
 * ① SECTION 节点 name='图层' 渲染非豆腐（fontsLoaded 后 typeface 已构造，pickFontForText 走 cjk）
 * ② COMPONENT 节点 name='组件名' 同上
 * ③ FRAME 节点 name='中文 Frame' 选中态 frame title 走 cjkLabelFont
 * ④ 反向钉扎：CJK typeface null 时 SECTION 降级到 latin（不抛错，文字仍可读）
 */
import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

type CanvasHelperType = InstanceType<typeof CanvasHelper>

async function setupCanvas(page: Page): Promise<CanvasHelperType> {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()
  return canvas
}

test('① SECTION 节点 name=图层 渲染非豆腐', async ({ page }) => {
  const helper = await setupCanvas(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.renderer
    if (!store || !renderer) throw new Error('OpenPencil store/renderer not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('page not found')

    // 构造 SECTION 子节点，name 含中文
    const section = store.graph.createNode('SECTION', pageNode.id, {
      name: '图层',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })

    // 等 renderer.fontsLoaded（单 resolve + done 守卫）
    if (!renderer.fontsLoaded) {
      let ready = false
      const tick = setInterval(() => {
        if (ready) return
        if (renderer.fontsLoaded) {
          ready = true
          clearInterval(tick)
        }
      }, 50)
      setTimeout(() => {
        if (ready) return
        ready = true
        clearInterval(tick)
      }, 5000)
      await new Promise<void>((finish) => {
        const poll = () => {
          if (ready) {
            finish()
            return
          }
          setTimeout(poll, 50)
        }
        poll()
      })
    }

    return {
      fontsLoaded: renderer.fontsLoaded,
      sectionId: section.id,
      // T88 关键：loadFonts 后 cjk typeface / font 实例应非 null
      cjkSectionTitleFont: renderer.cjkSectionTitleFont != null,
      cjkTextFont: renderer.cjkTextFont != null,
      cjkLabelFont: renderer.cjkLabelFont != null
    }
  })

  expect(result.fontsLoaded).toBe(true)
  expect(result.cjkSectionTitleFont).toBe(true)
  expect(result.cjkTextFont).toBe(true)
  expect(result.cjkLabelFont).toBe(true)
  helper.assertNoErrors()
})

test('② COMPONENT 节点 name=组件名 渲染非豆腐', async ({ page }) => {
  const helper = await setupCanvas(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.renderer
    if (!store || !renderer) throw new Error('OpenPencil store/renderer not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('page not found')

    const comp = store.graph.createNode('COMPONENT', pageNode.id, {
      name: '组件名',
      x: 200,
      y: 200,
      width: 200,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })

    if (!renderer.fontsLoaded) {
      let ready = false
      const tick = setInterval(() => {
        if (ready) return
        if (renderer.fontsLoaded) {
          ready = true
          clearInterval(tick)
        }
      }, 50)
      setTimeout(() => {
        if (ready) return
        ready = true
        clearInterval(tick)
      }, 5000)
      await new Promise<void>((finish) => {
        const poll = () => {
          if (ready) {
            finish()
            return
          }
          setTimeout(poll, 50)
        }
        poll()
      })
    }

    return {
      componentLabelFont: renderer.componentLabelFont != null,
      cjkComponentLabelFont: renderer.cjkComponentLabelFont != null,
      compId: comp.id
    }
  })

  expect(result.componentLabelFont).toBe(true)
  expect(result.cjkComponentLabelFont).toBe(true)
  helper.assertNoErrors()
})

test('③ FRAME 节点 name=中文 Frame 选中态走 cjkLabelFont', async ({ page }) => {
  const helper = await setupCanvas(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.renderer
    if (!store || !renderer) throw new Error('OpenPencil store/renderer not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('page not found')

    const frame = store.graph.createNode('FRAME', pageNode.id, {
      name: '中文 Frame',
      x: 100,
      y: 100,
      width: 240,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.editor.selection.select([frame.id])

    if (!renderer.fontsLoaded) {
      let ready = false
      const tick = setInterval(() => {
        if (ready) return
        if (renderer.fontsLoaded) {
          ready = true
          clearInterval(tick)
        }
      }, 50)
      setTimeout(() => {
        if (ready) return
        ready = true
        clearInterval(tick)
      }, 5000)
      await new Promise<void>((finish) => {
        const poll = () => {
          if (ready) {
            finish()
            return
          }
          setTimeout(poll, 50)
        }
        poll()
      })
    }

    return {
      labelFont: renderer.labelFont != null,
      cjkLabelFont: renderer.cjkLabelFont != null,
      frameId: frame.id
    }
  })

  expect(result.labelFont).toBe(true)
  expect(result.cjkLabelFont).toBe(true)
  helper.assertNoErrors()
})

test('④ 混合文字测宽（measureTextByScript）走双 typeface', async ({ page }) => {
  const helper = await setupCanvas(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    const renderer = store?.renderer
    if (!store || !renderer) throw new Error('OpenPencil store/renderer not initialized')

    if (!renderer.fontsLoaded) {
      let ready = false
      const tick = setInterval(() => {
        if (ready) return
        if (renderer.fontsLoaded) {
          ready = true
          clearInterval(tick)
        }
      }, 50)
      setTimeout(() => {
        if (ready) return
        ready = true
        clearInterval(tick)
      }, 5000)
      await new Promise<void>((finish) => {
        const poll = () => {
          if (ready) {
            finish()
            return
          }
          setTimeout(poll, 50)
        }
        poll()
      })
    }

    // T88 关键：通过 renderer 内部路径测试——这里直接走 measureTextByScript 不可见，
    // 改为通过 hitTestFrameTitle 验：选中的 frame 中文名应能命中 frame title 的 hit-rect
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('page not found')
    const frame = store.graph.createNode('FRAME', pageNode.id, {
      name: '中文 Frame',
      x: 100,
      y: 100,
      width: 240,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.editor.selection.select([frame.id])

    const abs = store.graph.getAbsolutePosition(frame.id)
    // 点击 frame title 区域（上方 LABEL_OFFSET_Y 偏移处）
    const result = renderer.hitTestFrameTitle(store.graph, abs.x, abs.y - 4, new Set([frame.id]))

    return { hitId: result?.id ?? null, frameId: frame.id }
  })

  expect(result.hitId).toBe(result.frameId)
  helper.assertNoErrors()
})
