import { useFileDialog } from '@vueuse/core'

import type { EditorStore } from '@/app/editor/active-store'
import { useForkToolbar } from '@/app/i18n/fork'
import { toast } from '@/app/shell/ui'

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml'
}

/** 部分系统给不出 MIME（Windows 上 .avif 常见）——按扩展名补齐，否则 core 按类型过滤时静默丢弃 */
function withRepairedMime(file: File): File {
  if (file.type) return file
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = EXT_MIME[ext]
  return mime ? new File([file], file.name, { type: mime }) : file
}

/** 「添加图片」：系统文件选择器选图 → 放到当前视口中心；一个都没放成功时 toast 反馈（placeFiles 覆盖 raster + SVG） */
export function useAddImage(store: EditorStore) {
  const toolbarText = useForkToolbar()
  const { open: openImagePicker, onChange } = useFileDialog({
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,.svg',
    multiple: true
  })

  onChange((files) => {
    if (!files?.length) return
    const cx = (-store.state.panX + window.innerWidth / 2) / store.state.zoom
    const cy = (-store.state.panY + window.innerHeight / 2) / store.state.zoom
    void store.placeFiles(Array.from(files).map(withRepairedMime), cx, cy).then((placed) => {
      if (placed === 0) toast.error(toolbarText.value.addImageFailed)
    })
  })

  return { openImagePicker }
}
