<script setup lang="ts">
/**
 * T21 P2 pi 模式设置面板：provider 目录、凭据（只进不出）、自定义 provider、
 * design 模型指派——全部走后端 admin API（client.ts），前端不持有任何 key。
 * 旧 ToolLoop 的 profile/connection/assignment 三表在 pi 模式下不展示、不迁移。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { piDesignAssignment, setPiDesignAssignment } from '@/app/ai/pi-backend/assignment'
import {
  clearPiCredential,
  piCatalog,
  piCatalogError,
  piCatalogLoading,
  refreshPiCatalog,
  setPiCredential,
  upsertPiProvider
} from '@/app/ai/pi-backend/client'
import type { PiThinkingLevel } from '@/app/ai/pi-backend/client'

const { dialogs } = useI18n()

const expandedProviderId = ref<string | null>(null)
const keyDrafts = ref<Record<string, string>>({})
const busyProviderId = ref<string | null>(null)
const actionError = ref<string | null>(null)

const showAddProvider = ref(false)
const customId = ref('')
const customBaseURL = ref('')
const customAPI = ref('openai-completions')
const customModelIds = ref('')
const CUSTOM_API_TYPES = ['openai-completions', 'openai-responses', 'anthropic-messages']

const designProviderId = ref(piDesignAssignment.value?.providerId ?? '')
const designModelId = ref(piDesignAssignment.value?.modelId ?? '')
const designThinking = ref<PiThinkingLevel>(piDesignAssignment.value?.thinkingLevel ?? 'off')

const providers = computed(() => piCatalog.value?.providers ?? [])

const designModels = computed(() => {
  const provider = providers.value.find((entry) => entry.id === designProviderId.value)
  return provider?.models ?? []
})

const designCredentialMissing = computed(() => {
  if (!designProviderId.value) return false
  const provider = providers.value.find((entry) => entry.id === designProviderId.value)
  return provider ? !provider.auth.configured : false
})

function thinkingLabel(level: PiThinkingLevel): string {
  const labels: Record<PiThinkingLevel, string> = {
    off: dialogs.value.piThinkingOff,
    minimal: dialogs.value.piThinkingMinimal,
    low: dialogs.value.piThinkingLow,
    medium: dialogs.value.piThinkingMedium,
    high: dialogs.value.piThinkingHigh,
    xhigh: dialogs.value.piThinkingExtraHigh
  }
  return labels[level]
}

function toggleProvider(providerId: string): void {
  expandedProviderId.value = expandedProviderId.value === providerId ? null : providerId
}

async function saveKey(providerId: string): Promise<void> {
  const key = (keyDrafts.value[providerId] ?? '').trim()
  if (!key) return
  busyProviderId.value = providerId
  actionError.value = null
  try {
    await setPiCredential(providerId, key)
    keyDrafts.value[providerId] = ''
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    busyProviderId.value = null
  }
}

async function clearKey(providerId: string): Promise<void> {
  busyProviderId.value = providerId
  actionError.value = null
  try {
    await clearPiCredential(providerId)
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    busyProviderId.value = null
  }
}

async function saveCustomProvider(): Promise<void> {
  const models = customModelIds.value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  busyProviderId.value = '__custom__'
  actionError.value = null
  try {
    await upsertPiProvider({
      id: customId.value.trim(),
      baseUrl: customBaseURL.value.trim(),
      api: customAPI.value,
      models
    })
    customId.value = ''
    customBaseURL.value = ''
    customModelIds.value = ''
    showAddProvider.value = false
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    busyProviderId.value = null
  }
}

function selectDesignProvider(providerId: string): void {
  designProviderId.value = providerId
  const provider = providers.value.find((entry) => entry.id === providerId)
  const first = provider?.models[0]
  designModelId.value = first?.id ?? ''
}

function saveDesignModel(): void {
  if (!designProviderId.value || !designModelId.value) {
    setPiDesignAssignment(null)
    return
  }
  setPiDesignAssignment({
    providerId: designProviderId.value,
    modelId: designModelId.value,
    ...(designThinking.value !== 'off' ? { thinkingLevel: designThinking.value } : {})
  })
}

onMounted(() => void refreshPiCatalog())
</script>

<template>
  <div class="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
    <section data-test-id="pi-providers-panel">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h3 class="text-xs font-semibold text-surface">{{ dialogs.models }}</h3>
          <p class="text-[10px] text-muted">{{ dialogs.piModelsDescription }}</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-[11px] font-medium text-surface hover:bg-panel-field"
          data-test-id="pi-catalog-refresh"
          :disabled="piCatalogLoading"
          @click="refreshPiCatalog"
        >
          <icon-lucide-refresh-cw class="size-3" :class="{ 'animate-spin': piCatalogLoading }" />
          {{ dialogs.piCatalogRefresh }}
        </button>
      </div>

      <p
        v-if="piCatalogError"
        class="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400"
        data-test-id="pi-catalog-offline"
      >
        {{ dialogs.piCatalogOffline }} ({{ piCatalogError }})
      </p>
      <p v-if="actionError" class="mt-1 text-[10px] text-red-400" data-test-id="pi-action-error">
        {{ actionError }}
      </p>

      <div class="mt-2 flex flex-col gap-1.5">
        <div
          v-for="provider in providers"
          :key="provider.id"
          class="rounded border border-border bg-panel-field"
          :data-provider-id="provider.id"
          data-test-id="pi-provider-row"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-panel-field-hover"
            @click="toggleProvider(provider.id)"
          >
            <div
              class="flex size-8 shrink-0 items-center justify-center rounded bg-panel text-muted"
            >
              <icon-lucide-bot class="size-4" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[11px] font-medium text-surface">{{ provider.name }}</p>
              <p class="truncate text-[10px] text-muted">
                {{ provider.id }} ·
                {{ dialogs.piProviderModels({ count: provider.models.length }) }}
              </p>
            </div>
            <span
              class="mr-1 flex shrink-0 items-center gap-1 text-[9px] text-muted"
              :data-state="provider.auth.configured ? 'configured' : 'missing'"
            >
              <span
                class="size-1.5 rounded-full bg-muted data-[state=configured]:bg-[var(--color-success)]"
                :data-state="provider.auth.configured ? 'configured' : 'missing'"
              />
              {{ provider.auth.configured ? dialogs.connected : dialogs.modelNeedsCredential }}
            </span>
            <icon-lucide-chevron-right
              class="size-3.5 shrink-0 text-muted transition-transform"
              :class="{ 'rotate-90': expandedProviderId === provider.id }"
            />
          </button>

          <div v-if="expandedProviderId === provider.id" class="border-t border-border px-3 py-2">
            <div class="flex items-center gap-1.5">
              <input
                v-model="keyDrafts[provider.id]"
                type="password"
                class="min-w-0 flex-1 rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none focus:border-panel-focus"
                :placeholder="
                  provider.auth.configured
                    ? dialogs.piKeyPlaceholderConfigured
                    : dialogs.piKeyPlaceholderMissing
                "
                data-test-id="pi-key-input"
                @keydown.enter="saveKey(provider.id)"
              />
              <button
                type="button"
                class="rounded bg-accent px-2 py-1.5 text-[10px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                data-test-id="pi-key-save"
                :disabled="busyProviderId === provider.id"
                @click="saveKey(provider.id)"
              >
                {{ dialogs.piKeySave }}
              </button>
              <button
                v-if="provider.auth.configured"
                type="button"
                class="rounded border border-border px-2 py-1.5 text-[10px] text-muted hover:text-surface disabled:opacity-50"
                data-test-id="pi-key-clear"
                :disabled="busyProviderId === provider.id"
                @click="clearKey(provider.id)"
              >
                {{ dialogs.piKeyClear }}
              </button>
            </div>

            <div class="scrollbar-thin mt-2 max-h-40 overflow-y-auto rounded bg-panel p-1.5">
              <div
                v-for="model in provider.models"
                :key="model.id"
                class="flex items-center justify-between gap-2 px-1 py-0.5 text-[10px]"
              >
                <span class="truncate text-surface">{{ model.name }}</span>
                <span class="shrink-0 text-muted">
                  {{ model.id
                  }}<template v-if="model.contextWindow">
                    · {{ Math.round(model.contextWindow / 1024) }}k</template
                  >
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="mt-2 flex items-center gap-1 rounded border border-border px-2.5 py-1.5 text-[11px] font-medium text-surface hover:bg-panel-field"
        data-test-id="pi-add-provider"
        @click="showAddProvider = !showAddProvider"
      >
        <icon-lucide-plus class="size-3" />
        {{ dialogs.piAddProvider }}
      </button>

      <div
        v-if="showAddProvider"
        class="mt-2 flex flex-col gap-1.5 rounded border border-border bg-panel-field px-3 py-2"
        data-test-id="pi-provider-form"
      >
        <input
          v-model="customId"
          type="text"
          class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none focus:border-panel-focus"
          :placeholder="dialogs.piProviderId"
          data-test-id="pi-provider-id-input"
        />
        <input
          v-model="customBaseURL"
          type="text"
          class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none focus:border-panel-focus"
          :placeholder="dialogs.piProviderBaseUrl"
          data-test-id="pi-provider-baseurl-input"
        />
        <select
          v-model="customAPI"
          class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none"
          data-test-id="pi-provider-api-select"
        >
          <option v-for="api in CUSTOM_API_TYPES" :key="api" :value="api">{{ api }}</option>
        </select>
        <textarea
          v-model="customModelIds"
          rows="3"
          class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none focus:border-panel-focus"
          :placeholder="dialogs.piProviderModelIds"
          data-test-id="pi-provider-models-input"
        />
        <button
          type="button"
          class="self-start rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          data-test-id="pi-provider-save"
          :disabled="busyProviderId === '__custom__'"
          @click="saveCustomProvider"
        >
          {{ dialogs.piProviderSave }}
        </button>
      </div>
    </section>

    <section class="mt-5 border-t border-border pt-4">
      <div class="mb-3">
        <h3 class="text-xs font-semibold text-surface">{{ dialogs.piDesignModel }}</h3>
        <p class="text-[10px] text-muted">{{ dialogs.piDesignModelDescription }}</p>
      </div>

      <div class="flex flex-col gap-1.5" data-test-id="pi-design-model">
        <label class="text-[10px] text-muted">{{ dialogs.piDesignProvider }}</label>
        <select
          :value="designProviderId"
          class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none"
          data-test-id="pi-design-provider-select"
          @change="selectDesignProvider(($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ dialogs.piDesignModelDefault }}</option>
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">
            {{ provider.name }} ({{ provider.id }})
          </option>
        </select>

        <template v-if="designProviderId">
          <label class="mt-1 text-[10px] text-muted">{{ dialogs.piDesignModelField }}</label>
          <select
            v-model="designModelId"
            class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none"
            data-test-id="pi-design-model-select"
          >
            <option v-for="model in designModels" :key="model.id" :value="model.id">
              {{ model.name }} ({{ model.id }})
            </option>
          </select>

          <label class="mt-1 text-[10px] text-muted">{{ dialogs.piThinkingLevel }}</label>
          <select
            v-model="designThinking"
            class="rounded border border-border bg-panel px-2 py-1.5 text-[11px] text-surface outline-none"
            data-test-id="pi-design-thinking-select"
          >
            <option value="off">{{ thinkingLabel('off') }}</option>
            <option value="minimal">{{ thinkingLabel('minimal') }}</option>
            <option value="low">{{ thinkingLabel('low') }}</option>
            <option value="medium">{{ thinkingLabel('medium') }}</option>
            <option value="high">{{ thinkingLabel('high') }}</option>
            <option value="xhigh">{{ thinkingLabel('xhigh') }}</option>
          </select>

          <p
            v-if="designCredentialMissing"
            class="text-[10px] text-amber-400"
            data-test-id="pi-design-credential-missing"
          >
            {{ dialogs.modelNeedsCredential }}
          </p>
        </template>

        <button
          type="button"
          class="mt-1 self-start rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
          data-test-id="pi-design-save"
          @click="saveDesignModel"
        >
          {{ dialogs.piDesignModelSave }}
        </button>
      </div>
    </section>
  </div>
</template>
