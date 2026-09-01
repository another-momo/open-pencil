<script setup lang="ts">
/**
 * T61（Phase 3 W3/T-B10）：新建意图确认卡——用户手动改 chip + 发消息时，
 * ChatPanel 拦截发送并注入宿主发起的 data part（非工具 part，T56 卡片范式），
 * 本卡片渲染之。
 *
 * 话术分叉（共享契约 4 物化判据）：
 *  - Case A（物化前）：一行——方向草稿作废提示。
 *  - Case B（物化后）四项：旧产物保留说明 / 新设计区启动 / 携带物勾选
 *    （brief 素材区自动继承 + 已生成图片可选 references，opt-in）/ 废弃半径声明。
 *
 * T65：
 *  - 尺寸行（决策 C）：预设 chips（data.sizeChoices = 选中 mode 的 manifest.sizes
 *    投影 [{label,canvas}]）+ 自定义输入（`Wx`/`WxH`）；选择随 confirm 上抛，
 *    进信封 canvas 字段；缺省 = 自动（AI 按语义决定，信封省略字段）。
 *  - Case B references 加缩略图（T56 renderExportImage 先例；失败 → 占位图标）。
 *  - 视觉从气泡降权为系统样式（决策 D3 衍生：虚线边框 + 无填充，区别用户/AI 气泡）。
 *
 * 确认 → emit confirm {referenceNodeIds, canvas}；取消 → emit cancel（chips 回滚
 * 回显、消息留输入框——由 ChatPanel 执行）。决断写回 part data 的 resolved
 * 字段（重载后保持置灰，同 answeredFormIds 的派生纪律）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useForkConfirm } from '@/app/i18n/fork'

import { CANVAS_VALUE_PATTERN, type NewIntentPartData } from './active-design'

const { data, disabled = false } = defineProps<{
  data: NewIntentPartData
  disabled?: boolean
}>()

const emit = defineEmits<{
  confirm: [payload: { referenceNodeIds: string[]; canvas: string | null }]
  cancel: []
}>()

const confirmText = useForkConfirm()

const isLocked = computed(() => data.resolved !== null || disabled)
const selectedRefs = reactive(new Set<string>())

function toggleRef(nodeId: string) {
  if (isLocked.value) return
  if (selectedRefs.has(nodeId)) {
    selectedRefs.delete(nodeId)
  } else {
    selectedRefs.add(nodeId)
  }
}

// ── T65：尺寸行（预设 chips + 自定义输入；空 = 自动） ──

const canvasDraft = ref('')

const canvasDraftValid = computed(
  () => canvasDraft.value.trim() === '' || CANVAS_VALUE_PATTERN.test(canvasDraft.value.trim())
)

function pickSize(canvas: string) {
  if (isLocked.value) return
  canvasDraft.value = canvas
}

function pickAutoSize() {
  if (isLocked.value) return
  canvasDraft.value = ''
}

function handleConfirm() {
  if (isLocked.value) return
  const canvas = canvasDraft.value.trim()
  emit('confirm', {
    referenceNodeIds: [...selectedRefs],
    canvas: CANVAS_VALUE_PATTERN.test(canvas) ? canvas : null
  })
}

function handleCancel() {
  if (isLocked.value) return
  emit('cancel')
}

// ── T65：Case B references 缩略图（renderExportImage 先例；失败 → null → 占位图标） ──

const THUMBNAIL_RENDER_SIZE = 96
const thumbnails = reactive<Record<string, string | null | undefined>>({})
const createdUrls: string[] = []

function thumbnailURL(nodeId: string): string | undefined {
  const url = thumbnails[nodeId]
  return typeof url === 'string' ? url : undefined
}

async function loadThumbnail(nodeId: string) {
  const store = getActiveEditorStoreOrNull()
  const node = store?.graph.getNode(nodeId)
  if (!store || !node) {
    thumbnails[nodeId] = null
    return
  }
  const scale = THUMBNAIL_RENDER_SIZE / Math.max(node.width, node.height, 1)
  try {
    const data = await store.renderExportImage([nodeId], scale, 'PNG')
    if (!data) {
      thumbnails[nodeId] = null
      return
    }
    const url = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
    createdUrls.push(url)
    thumbnails[nodeId] = url
  } catch {
    thumbnails[nodeId] = null
  }
}

onMounted(() => {
  for (const refCandidate of data.references) void loadThumbnail(refCandidate.nodeId)
})

onBeforeUnmount(() => {
  for (const url of createdUrls) URL.revokeObjectURL(url)
})
</script>

<template>
  <!-- T65：系统视觉（虚线边框无填充）——宿主发起，区别于用户/AI 气泡 -->
  <div
    data-test-id="new-intent-card"
    class="space-y-2 rounded-md border border-dashed border-border px-3 py-2.5"
  >
    <div class="flex items-center gap-2">
      <icon-lucide-sparkles class="size-3.5 shrink-0 text-muted" />
      <span class="text-[12px] font-medium text-surface">{{ confirmText.intentTitle }}</span>
      <span
        v-if="data.resolved !== null"
        data-test-id="new-intent-resolved-badge"
        class="rounded bg-hover px-1.5 py-0.5 text-[11px] text-muted"
      >
        {{
          data.resolved === 'confirmed'
            ? confirmText.intentConfirmedBadge
            : confirmText.intentCancelledBadge
        }}
      </span>
    </div>

    <!-- Case A（物化前）：方向草稿作废提示一行 -->
    <div v-if="data.caseKind === 'A'" class="text-[11px] text-surface">
      {{ confirmText.intentCaseALine }}
    </div>

    <!-- Case B（物化后）四项 -->
    <template v-else>
      <ul class="list-inside space-y-1 text-[11px] text-surface">
        <li>· {{ confirmText.intentCaseBKeep }}</li>
        <li>· {{ confirmText.intentCaseBNew }}</li>
        <li>· {{ confirmText.intentCaseBMaterials }}</li>
        <li>· {{ confirmText.intentCaseBRadius }}</li>
      </ul>
      <div v-if="data.references.length > 0" class="space-y-1">
        <div class="text-[11px] font-medium text-muted">
          {{ confirmText.intentCaseBReferences }}
        </div>
        <label
          v-for="ref in data.references"
          :key="ref.nodeId"
          class="flex items-center gap-1.5 text-[11px] text-surface"
          :class="isLocked ? 'opacity-60' : 'cursor-pointer'"
          :data-test-id="`new-intent-reference`"
          :data-node-id="ref.nodeId"
        >
          <input
            type="checkbox"
            :checked="selectedRefs.has(ref.nodeId)"
            :disabled="isLocked"
            class="size-3 shrink-0 accent-accent"
            @change="toggleRef(ref.nodeId)"
          />
          <span
            class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-input"
          >
            <img
              v-if="thumbnailURL(ref.nodeId)"
              :src="thumbnailURL(ref.nodeId)"
              :alt="ref.label"
              class="max-h-full max-w-full object-contain"
              draggable="false"
            />
            <icon-lucide-loader-circle
              v-else-if="thumbnails[ref.nodeId] === undefined"
              class="size-3 animate-spin text-muted"
            />
            <icon-lucide-image-off v-else class="size-3 text-muted" />
          </span>
          <span class="min-w-0 truncate">{{ ref.label }}</span>
        </label>
      </div>
    </template>

    <!-- T65：尺寸行（预设 chips + 自定义输入；空 = 自动由 AI 决定） -->
    <div class="space-y-1">
      <div class="text-[11px] font-medium text-muted">{{ confirmText.intentSizeSection }}</div>
      <div class="flex flex-wrap items-center gap-1">
        <button
          type="button"
          :disabled="isLocked"
          data-test-id="new-intent-size-auto"
          class="rounded-md border px-2 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          :class="
            canvasDraft === ''
              ? 'border-accent bg-accent/10 text-surface'
              : 'border-border bg-input text-muted hover:bg-hover'
          "
          @click="pickAutoSize"
        >
          {{ confirmText.intentSizeAuto }}
        </button>
        <button
          v-for="choice in data.sizeChoices"
          :key="choice.canvas"
          type="button"
          :disabled="isLocked"
          :data-test-id="`new-intent-size-preset`"
          :data-canvas="choice.canvas"
          class="rounded-md border px-2 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          :class="
            canvasDraft === choice.canvas
              ? 'border-accent bg-accent/10 text-surface'
              : 'border-border bg-input text-muted hover:bg-hover'
          "
          @click="pickSize(choice.canvas)"
        >
          {{ choice.label }}
          <span class="text-muted">{{ choice.canvas }}</span>
        </button>
      </div>
      <input
        v-model="canvasDraft"
        type="text"
        :disabled="isLocked"
        :placeholder="confirmText.intentSizeCustomPlaceholder"
        data-test-id="new-intent-size-custom"
        class="block w-full rounded-md border border-border bg-input px-2.5 py-1 text-[11px] text-surface outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
      />
      <div
        v-if="!canvasDraftValid"
        data-test-id="new-intent-size-invalid"
        class="text-[11px] text-red-400"
      >
        {{ confirmText.intentSizeInvalid }}
      </div>
    </div>

    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        :disabled="isLocked"
        data-test-id="new-intent-cancel"
        class="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleCancel"
      >
        {{ confirmText.intentCancel }}
      </button>
      <button
        type="button"
        :disabled="isLocked"
        data-test-id="new-intent-confirm"
        class="rounded-md bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleConfirm"
      >
        {{ confirmText.intentConfirm }}
      </button>
    </div>
  </div>
</template>
