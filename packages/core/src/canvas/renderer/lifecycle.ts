import type { SkiaRenderer } from '#core/canvas/renderer'
import { clearSubtreePictureCache } from '#core/canvas/renderer/state'
import { fontManager } from '#core/text/fonts'

function clearRetainedSceneState(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function disposePathCaches(r: SkiaRenderer): void {
  for (const cache of [
    r.vectorPathCache,
    r.vectorStrokePathCache,
    r.vectorStrokeOutlineCache,
    r.fillGeometryCache,
    r.strokeGeometryCache
  ]) {
    for (const paths of cache.values()) {
      for (const p of paths) p.delete()
    }
    cache.clear()
  }
  // glyphSilhouetteCache maps to a single Path per entry (not an array).
  for (const p of r.glyphSilhouetteCache.values()) p.delete()
  r.glyphSilhouetteCache.clear()
}

function disposeFonts(r: SkiaRenderer): void {
  // Latin (Inter)
  r.textFont?.delete()
  r.labelFont?.delete()
  r.sizeFont?.delete()
  r.sectionTitleFont?.delete()
  r.componentLabelFont?.delete()
  // T88：CJK / Arabic 备用 Font 实例
  r.cjkTextFont?.delete()
  r.cjkLabelFont?.delete()
  r.cjkSizeFont?.delete()
  r.cjkSectionTitleFont?.delete()
  r.cjkComponentLabelFont?.delete()
  r.arabicTextFont?.delete()
  r.arabicLabelFont?.delete()
  r.arabicSizeFont?.delete()
  r.arabicSectionTitleFont?.delete()
  r.arabicComponentLabelFont?.delete()
  r.fontMgr?.delete()
  const fontProvider = r.fontProvider
  fontProvider?.delete()
  r.fontProvider = null
  r.fontsLoaded = false
  fontManager.detachProvider(fontProvider)
}

function disposePaints(r: SkiaRenderer): void {
  r.fillPaint.delete()
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.parentOutlinePaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  r.rulerBgPaint.delete()
  r.rulerTickPaint.delete()
  r.rulerTextPaint.delete()
  r.rulerHlPaint.delete()
  r.rulerBadgePaint.delete()
  r.rulerLabelPaint.delete()
  r.penPathPaint.delete()
  r.penLiveStrokePaint.delete()
  r.penHandlePaint.delete()
  r.penVertexFill.delete()
  r.penVertexStroke.delete()
  r.effectLayerPaint.delete()
  r._flashPaint?.delete()
}

function disposeResourceCaches(r: SkiaRenderer): void {
  for (const img of r.imageCache.values()) img.delete()
  r.imageCache.clear()
  for (const filter of r.imageFilterCache.values()) filter?.delete()
  r.imageFilterCache.clear()
  for (const filter of r.maskFilterCache.values()) filter?.delete()
  r.maskFilterCache.clear()
  for (const pic of r.nodePictureCache.values()) pic?.delete()
  r.nodePictureCache.clear()
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true

  disposeResourceCaches(r)
  disposePathCaches(r)
  disposeFonts(r)
  disposePaints(r)
  clearSubtreePictureCache(r)
  clearRetainedSceneState(r)
  r.profiler.destroy()
  r.surface.delete()
}
