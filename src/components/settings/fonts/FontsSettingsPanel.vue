<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { fontManager, fontRegistryEntry } from '@open-pencil/core/text'
import type { FontFamilyOption } from '@open-pencil/core/text'

import {
  disabledFontFamilies,
  listAllFamilies,
  localFontAccessState,
  requestLocalFontAccess
} from '@/app/editor/fonts'
import { useForkFonts } from '@/app/i18n/fork'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * T41 S5：字体白名单可视化管理面板（SettingsDialog fonts 分区）。
 * 覆盖 bundled/cdn/provider/local 全来源；bundled 兜底族锁定恒开（D-d，core 同样拒关）。
 * 关停语义 = 视为未安装：picker 消失 + 文档走回退链（core 加载门禁）。
 */
const msgs = useForkFonts()

const families = ref<FontFamilyOption[]>([])
const loading = ref(true)
const search = ref('')
const requestingLocal = ref(false)
const localAccess = ref(localFontAccessState())

type SourceGroup = 'bundled' | 'cdn' | 'online' | 'local'
const GROUP_ORDER: SourceGroup[] = ['bundled', 'cdn', 'online', 'local']

function groupOf(source: string): SourceGroup {
  if (source === 'bundled') return 'bundled'
  if (source === 'cdn') return 'cdn'
  if (source === 'local') return 'local'
  return 'online'
}

const groupLabels = computed<Record<SourceGroup, string>>(() => ({
  bundled: msgs.value.fontsSourceBundled,
  cdn: msgs.value.fontsSourceCdn,
  online: msgs.value.fontsSourceOnline,
  local: msgs.value.fontsSourceLocal
}))

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return families.value
  return families.value.filter((option) => option.family.toLowerCase().includes(term))
})

const grouped = computed(() => {
  const groups = new Map<SourceGroup, FontFamilyOption[]>()
  for (const option of filtered.value) {
    const group = groupOf(option.source)
    groups.set(group, [...(groups.get(group) ?? []), option])
  }
  return GROUP_ORDER.flatMap((group) => {
    const options = groups.get(group)
    return options ? [{ group, options }] : []
  })
})

const enabledCount = computed(
  () => families.value.filter((option) => isEnabled(option.family)).length
)

function isLocked(family: string): boolean {
  return fontManager.isFontFamilyLocked(family)
}

function isEnabled(family: string): boolean {
  return isLocked(family) || !disabledFontFamilies.value.includes(family)
}

function isVariable(family: string): boolean {
  return fontRegistryEntry(family)?.variable === true
}

function toggle(family: string, enabled: boolean): void {
  if (isLocked(family)) return
  const next = new Set(disabledFontFamilies.value)
  if (enabled) next.delete(family)
  else next.add(family)
  disabledFontFamilies.value = [...next]
}

async function allowLocalFonts(): Promise<void> {
  requestingLocal.value = true
  try {
    // 面板必须用不过滤的枚举：listFamilies（requestLocalFontAccess 的返回）
    // 会按白名单过滤，关停行会连同本地族一起从面板消失，无法重开。
    await requestLocalFontAccess()
    families.value = await listAllFamilies()
    localAccess.value = localFontAccessState()
  } finally {
    requestingLocal.value = false
  }
}

onMounted(async () => {
  try {
    families.value = await listAllFamilies()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-fonts-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ msgs.fontsPanelTitle }}</h3>
      <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
        {{ msgs.fontsPanelDescription }}
      </p>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="search"
        type="text"
        data-test-id="fonts-allowlist-search"
        :placeholder="msgs.fontsSearchPlaceholder"
        class="w-full rounded border border-border bg-input px-2 py-1 text-xs text-surface outline-none placeholder:text-muted"
      />
      <span class="shrink-0 text-[10px] text-muted" data-test-id="fonts-allowlist-summary">
        {{ msgs.fontsEnabledSummary({ enabled: enabledCount, total: families.length }) }}
      </span>
    </div>

    <div
      v-if="localAccess !== 'granted' && localAccess !== 'unsupported'"
      class="flex items-center justify-between gap-2 rounded border border-border p-2"
      data-test-id="fonts-local-access"
    >
      <p class="text-[10px] text-muted">{{ msgs.fontsLocalAccessPrompt }}</p>
      <AppButton
        type="button"
        color="neutral"
        variant="soft"
        size="xs"
        :disabled="requestingLocal"
        data-test-id="fonts-local-allow"
        @click="allowLocalFonts"
      >
        {{ msgs.fontsLocalAllow }}
      </AppButton>
    </div>

    <p v-if="loading" class="text-[10px] text-muted">{{ msgs.fontsLoading }}</p>
    <p v-else-if="grouped.length === 0" class="text-[10px] text-muted">{{ msgs.fontsEmpty }}</p>

    <div v-for="{ group, options } in grouped" v-else :key="group" class="flex flex-col gap-1">
      <p
        class="text-[10px] font-medium uppercase tracking-wide text-muted"
        :data-test-id="`fonts-group-${group}`"
      >
        {{ groupLabels[group] }} · {{ options.length }}
      </p>
      <div
        v-for="option in options"
        :key="option.family"
        class="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-hover"
        data-test-id="font-allowlist-row"
        :data-family="option.family"
      >
        <span class="min-w-0 flex-1 truncate text-xs text-surface">{{ option.family }}</span>
        <span
          v-if="isVariable(option.family)"
          class="shrink-0 rounded bg-input px-1 py-0.5 text-[9px] uppercase text-muted"
        >
          {{ msgs.fontsVariableBadge }}
        </span>
        <span
          v-if="isLocked(option.family)"
          class="shrink-0 text-[9px] text-muted"
          :title="msgs.fontsLockedHint"
          >🔒</span
        >
        <AppSwitch
          :model-value="isEnabled(option.family)"
          :label="option.family"
          :disabled="isLocked(option.family)"
          :data-test-id="`font-allowlist-toggle`"
          :data-family="option.family"
          @update:model-value="toggle(option.family, $event)"
        />
      </div>
    </div>

    <p class="text-[10px] leading-relaxed text-muted">{{ msgs.fontsLockedHint }}</p>
  </section>
</template>
