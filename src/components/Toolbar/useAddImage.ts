import { useFileDialog } from '@vueuse/core'

import type { EditorStore } from '@/app/editor/active-store'

/** 「添加图片」：系统文件选择器选图 → 放到当前视口中心（raster 过滤由 placeImageFiles 负责） */
export function useAddImage(store: EditorStore) {
  const { open: openImagePicker, onChange } = useFileDialog({
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml',
    multiple: true
  })

  onChange((files) => {
    if (!files?.length) return
    const cx = (-store.state.panX + window.innerWidth / 2) / store.state.zoom
    const cy = (-store.state.panY + window.innerHeight / 2) / store.state.zoom
    void store.placeImageFiles(Array.from(files), cx, cy)
  })

  return { openImagePicker }
}
