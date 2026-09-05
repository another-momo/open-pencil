<script setup lang="ts">
// Batch 2g：节点缩略图（上游 ChatNodePreview 改造版，owner 2026-09-05 拍板
// 收编——upstream/master src/components/chat/ChatNodePreview.vue）。
// 数据入口从上游 ReferencedNode（@/app/ai/chat/context，已随旧 chat 栈删除）
// 改为我们的 selection token 形状：nodeId + pageId（采集页）+ fallbackName；
// graph/renderer 由调用方（PiChatInput）从活动 store 透传，缺席即降级。
// 保留上游 request-id 防竞态与渲染失败降级（box 图标）；适配/守卫/降级
// 决策抽在 ./node-preview.ts 纯函数面（组件本体做最薄，逻辑钉扎见
// tests/engine/rebuild/chat/node-preview.test.ts）。
// 尺寸从上游 size-10 附件卡调整为 size-4，与 PiChatInput chip 行
// （text-[11px]、size-3~3.5 图标）视觉协调；渲染目标仍是 40px PNG
// （NODE_PREVIEW_TARGET_SIZE），object-contain 缩到 16px 显示，hidpi 清晰。
import { useObjectUrl } from '@vueuse/core'
import { shallowRef, watch } from 'vue'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderNodesToImage } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  createPreviewRequestGuard,
  resolvePreviewRender
} from '@/components/assistant/node-preview'

const { nodeId, pageId, graph, renderer } = defineProps<{
  /** 渲染目标节点（token 首节点） */
  nodeId: string
  /** 采集时页 id（renderNodesToImage 单页契约；不用当前页——采集后可翻页） */
  pageId: string
  graph: SceneGraph | null
  renderer: SkiaRenderer | null
}>()

const blob = shallowRef<Blob | null>(null)
const previewURL = useObjectUrl(blob)
const guard = createPreviewRequestGuard()

watch(
  () => [nodeId, pageId, graph, renderer],
  async () => {
    const request = guard.next()
    const plan = resolvePreviewRender(renderer, graph?.getNode(nodeId))
    if (!plan || !graph || !renderer) {
      if (guard.isCurrent(request)) blob.value = null
      return
    }
    // 渲染同步执行（本 fork renderNodesToImage 非异步），await 仅为与上游
    // 形状对齐；节点跨页/渲染内部失败 → catch 落 null 走降级
    let data: Uint8Array | null = null
    try {
      data = await renderNodesToImage(renderer.ck, renderer, graph, pageId, [nodeId], {
        scale: plan.scale,
        format: 'PNG'
      })
    } catch {
      data = null
    }
    if (guard.isCurrent(request)) {
      blob.value = data ? new Blob([data], { type: 'image/png' }) : null
    }
  },
  { immediate: true }
)
</script>

<template>
  <img
    v-if="previewURL"
    :src="previewURL"
    alt=""
    class="size-4 shrink-0 rounded-[3px] border border-border bg-canvas object-contain"
  />
  <div
    v-else
    class="flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-border bg-canvas"
  >
    <icon-lucide-box class="size-3 text-muted" aria-hidden="true" />
  </div>
</template>
