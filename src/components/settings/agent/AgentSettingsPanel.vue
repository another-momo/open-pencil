<!--
  T87：Agent 能力开关面板（settings 面板 ai 区下小节）——单 AppSwitch 控管
  agentSkills（pi 原生 skill 加载 + 内建 read/bash/edit/write 工具同闸）。
  缺省 OFF；PUT 失败显示错误文案。启动时按 GET 端点初值。
-->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useForkAgentCapabilities } from '@/app/i18n/fork'
import { applyPiCapabilities, piCapabilities } from '@/app/ai/pi-backend/mode-selection'

const msgs = useForkAgentCapabilities()

const localAgentSkills = ref<boolean>(piCapabilities.value?.agentSkills ?? false)
const saving = ref(false)
const errorText = ref<string | null>(null)

onMounted(() => {
  // ensurePiStudioManifest 已统一拉取 capabilities（与 manifest 同 fetch
  // 调用面）；面板挂载时再读一次以覆盖 settings 面板 open 时机晚于 ChatInput
  // 的场景
  if (piCapabilities.value) {
    localAgentSkills.value = piCapabilities.value.agentSkills
  }
})

const agentSkills = computed({
  get: () => localAgentSkills.value,
  set: async (next: boolean) => {
    if (saving.value) return
    saving.value = true
    errorText.value = null
    const prev = localAgentSkills.value
    // 乐观更新：失败回滚
    localAgentSkills.value = next
    try {
      const res = await fetch('/api/pi/capabilities', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentSkills: next })
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as { agentSkills: boolean }
      applyPiCapabilities(body)
      localAgentSkills.value = body.agentSkills
    } catch (error) {
      localAgentSkills.value = prev
      errorText.value = error instanceof Error ? error.message : String(error)
    } finally {
      saving.value = false
    }
  }
})
</script>

<template>
  <!-- T89：去繁就简——title + description 二键删除；AppSwitch label 留作唯一文案 -->
  <section class="flex flex-col gap-1.5" data-test-id="settings-agent-panel">
    <div class="flex items-center gap-2">
      <AppSwitch
        v-model="agentSkills"
        :label="msgs.agentCapabilitiesSkillLabel"
        :disabled="saving"
        data-test-id="settings-agent-skills-switch"
      />
      <span v-if="saving" class="text-[10px] text-muted" data-test-id="settings-agent-saving">
        {{ msgs.agentCapabilitiesSaving }}
      </span>
    </div>
    <p
      v-if="errorText"
      class="text-[11px] text-red-400"
      data-test-id="settings-agent-error"
      role="alert"
    >
      {{ msgs.agentCapabilitiesError({ message: errorText }) }}
    </p>
  </section>
</template>
