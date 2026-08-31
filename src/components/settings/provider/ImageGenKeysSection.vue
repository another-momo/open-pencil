<script setup lang="ts">
/**
 * T54（Phase 3 W2/T-B3）：generate_image 凭证面板——预设下拉 + 单 key 输入
 * （08 §I 收敛形态）。key 直送 pi 后端凭证面（image-gen/routes.ts），前端
 * 不持久化、不回显（状态只有 configured/presetId/baseUrl/model 元数据）。
 * 空 key 保存 = 清除（00 #7：清除必须生效）。默认预设 = OpenAI 官方端点
 * （默认无第三方中转，08 P0-5b）。
 */
import { computed, onMounted, ref } from 'vue'

import {
  clearImageGenCredential,
  DEFAULT_IMAGE_GEN_PRESET_ID,
  IMAGE_GEN_PRESETS,
  imageGenCredentialError,
  imageGenCredentialLoading,
  imageGenCredentialStatus,
  refreshImageGenCredentialStatus,
  setImageGenCredential
} from '@/app/ai/pi-backend/image-gen/client'
import { useForkImageGen } from '@/app/i18n/fork'

const msgs = useForkImageGen()

const presetId = ref(imageGenCredentialStatus.value?.presetId ?? DEFAULT_IMAGE_GEN_PRESET_ID)
const keyInput = ref('')
const busy = ref(false)
const actionError = ref<string | null>(null)

const configured = computed(() => imageGenCredentialStatus.value?.configured === true)

async function save(): Promise<void> {
  busy.value = true
  actionError.value = null
  try {
    // 空 key = 清除（后端 store.set 内部分派）
    await setImageGenCredential(presetId.value, keyInput.value.trim())
    keyInput.value = ''
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = false
  }
}

async function clear(): Promise<void> {
  busy.value = true
  actionError.value = null
  try {
    await clearImageGenCredential()
    keyInput.value = ''
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = false
  }
}

onMounted(() => void refreshImageGenCredentialStatus())
</script>

<template>
  <section class="flex flex-col gap-1.5" data-test-id="image-gen-keys-section">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ msgs.imageGenTitle }}</h3>
      <p class="text-[10px] text-muted">{{ msgs.imageGenDescription }}</p>
    </div>

    <p
      v-if="imageGenCredentialError"
      class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400"
      data-test-id="image-gen-offline"
    >
      {{ msgs.imageGenOffline }} ({{ imageGenCredentialError }})
    </p>

    <label class="text-[10px] text-muted">{{ msgs.imageGenProvider }}</label>
    <select
      v-model="presetId"
      class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none"
      data-test-id="image-gen-preset-select"
    >
      <option v-for="preset in IMAGE_GEN_PRESETS" :key="preset.id" :value="preset.id">
        {{ preset.label }}
      </option>
    </select>

    <div class="flex items-center gap-1.5">
      <input
        v-model="keyInput"
        type="password"
        class="min-w-0 flex-1 rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none focus:border-panel-focus"
        :placeholder="
          configured ? msgs.imageGenKeyPlaceholderConfigured : msgs.imageGenKeyPlaceholderMissing
        "
        data-test-id="image-gen-key-input"
        @keydown.enter="save"
      />
      <button
        type="button"
        class="rounded bg-accent px-2 py-1.5 text-[10px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        data-test-id="image-gen-key-save"
        :disabled="busy || imageGenCredentialLoading"
        @click="save"
      >
        {{ msgs.imageGenKeySave }}
      </button>
      <button
        v-if="configured"
        type="button"
        class="rounded border border-border px-2 py-1.5 text-[10px] text-muted hover:text-surface disabled:opacity-50"
        data-test-id="image-gen-key-clear"
        :disabled="busy"
        @click="clear"
      >
        {{ msgs.imageGenKeyClear }}
      </button>
    </div>

    <p
      class="flex items-center gap-1 text-[9px] text-muted"
      :data-state="configured ? 'configured' : 'missing'"
      data-test-id="image-gen-key-status"
    >
      <span
        class="size-1.5 rounded-full bg-muted data-[state=configured]:bg-[var(--color-success)]"
        :data-state="configured ? 'configured' : 'missing'"
      />
      {{ configured ? msgs.imageGenConfigured : msgs.imageGenNotConfigured }}
      <template v-if="configured && imageGenCredentialStatus?.model">
        · {{ imageGenCredentialStatus.model }}
      </template>
    </p>

    <p v-if="actionError" class="text-[10px] text-red-400" data-test-id="image-gen-action-error">
      {{ actionError }}
    </p>
  </section>
</template>
