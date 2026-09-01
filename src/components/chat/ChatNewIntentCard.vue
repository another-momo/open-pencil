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
 * 确认 → emit confirm（选中 references 的 nodeId 列表）；取消 → emit cancel
 * （chips 回滚回显、消息留输入框——由 ChatPanel 执行）。决断写回 part data
 * 的 resolved 字段（重载后保持置灰，同 answeredFormIds 的派生纪律）。
 */
import { computed, reactive } from 'vue'

import { useForkConfirm } from '@/app/i18n/fork'

import type { NewIntentPartData } from './active-design'

const { data, disabled = false } = defineProps<{
  data: NewIntentPartData
  disabled?: boolean
}>()

const emit = defineEmits<{
  confirm: [referenceNodeIds: string[]]
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

function handleConfirm() {
  if (isLocked.value) return
  emit('confirm', [...selectedRefs])
}

function handleCancel() {
  if (isLocked.value) return
  emit('cancel')
}
</script>

<template>
  <div
    data-test-id="new-intent-card"
    class="space-y-2 rounded-lg border border-border bg-canvas p-3"
  >
    <div class="flex items-center gap-2">
      <icon-lucide-sparkles class="size-3.5 shrink-0 text-accent" />
      <span class="text-[11px] font-medium text-surface">{{ confirmText.intentTitle }}</span>
      <span
        v-if="data.resolved !== null"
        data-test-id="new-intent-resolved-badge"
        class="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted"
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
        <div class="text-[10px] font-medium text-muted">
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
            class="size-3 accent-accent"
            @change="toggleRef(ref.nodeId)"
          />
          <span class="min-w-0 truncate">{{ ref.label }}</span>
        </label>
      </div>
    </template>

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
