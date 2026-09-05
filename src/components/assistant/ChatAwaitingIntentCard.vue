<script setup lang="ts">
/**
 * T91b：setup_design awaiting_new_intent_confirmation 信封卡片。
 *
 * 触发：AI 调 setup_design 但 args + pluginData 皆未确认 → core 返 awaiting 信封
 * （非错误）；前端 ChatMessage 检测到该信封 → 渲染本卡片（替换通用工具卡）。
 *
 * 形态分叉 vs T61 ChatNewIntentCard：宿主发起的卡让用户选择 mode / 尺寸 /
 * references；本卡是 AI 已提议完整三键（modeId / profileId / briefId），只
 * 暴露 confirm/cancel 二元决策——不重复选择面。
 *
 * Confirm → emit confirm；Cancel → emit cancel。ChatPanel 调
 * `postIntentConfirm`（写 pluginData 三键）→ `abort(sessionId)` →
 * AI 重放 setup_design 即放行（pluginData 已确认 + 清键后生效）。
 */
import { computed } from 'vue'

import { useForkConfirm } from '@/app/i18n/fork'

import type { SetupAwaitingIntentPayload } from './active-design'

const { payload, disabled = false } = defineProps<{
  payload: SetupAwaitingIntentPayload
  disabled?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirmText = useForkConfirm()

const isLocked = computed(() => disabled)

function handleConfirm() {
  if (isLocked.value) return
  emit('confirm')
}

function handleCancel() {
  if (isLocked.value) return
  emit('cancel')
}
</script>

<template>
  <!-- 系统样式（虚线边框无填充）——区别于用户/AI 气泡，与 ChatNewIntentCard 对齐 -->
  <div
    data-test-id="awaiting-intent-card"
    class="space-y-2 rounded-md border border-dashed border-border px-3 py-2.5"
  >
    <div class="flex items-center gap-2">
      <icon-lucide-sparkles class="size-3.5 shrink-0 text-muted" />
      <span class="text-[12px] font-medium text-surface">{{
        confirmText.awaitingIntentTitle
      }}</span>
    </div>

    <div class="space-y-0.5 text-[11px] text-surface">
      <div>
        <span class="text-muted">{{ confirmText.awaitingIntentMode }}:</span>
        <span data-test-id="awaiting-intent-mode" class="ml-1">{{ payload.modeId }}</span>
      </div>
      <div v-if="payload.profileId">
        <span class="text-muted">{{ confirmText.awaitingIntentProfile }}:</span>
        <span data-test-id="awaiting-intent-profile" class="ml-1">{{ payload.profileId }}</span>
      </div>
      <div v-if="payload.briefId">
        <span class="text-muted">{{ confirmText.awaitingIntentBrief }}:</span>
        <span data-test-id="awaiting-intent-brief" class="ml-1">{{ payload.briefId }}</span>
      </div>
    </div>

    <p v-if="payload.message" data-test-id="awaiting-intent-message" class="text-[11px] text-muted">
      {{ payload.message }}
    </p>

    <div class="flex items-center justify-end gap-2">
      <button
        type="button"
        :disabled="isLocked"
        data-test-id="awaiting-intent-cancel"
        class="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleCancel"
      >
        {{ confirmText.awaitingIntentCancel }}
      </button>
      <button
        type="button"
        :disabled="isLocked"
        data-test-id="awaiting-intent-confirm"
        class="rounded-md bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        @click="handleConfirm"
      >
        {{ confirmText.awaitingIntentConfirm }}
      </button>
    </div>
  </div>
</template>
