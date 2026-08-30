<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import ChatModeSelect from '@/components/chat/ChatModeSelect.vue'
import ChatStyleProfileSelect from '@/components/chat/ChatStyleProfileSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import InputGroup from '@/components/ui/InputGroup.vue'
import { piDesignAssignment } from '@/app/ai/pi-backend/assignment'
import { ensurePiStudioManifest, piChatMode } from '@/app/ai/pi-backend/mode-selection'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n } from '@open-pencil/vue'

import { useForkPi } from '@/app/i18n/fork'
const { dialogs } = useI18n()
const piDialogs = useForkPi()

const { status, disabled = false } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [text: string]
  stop: []
  error: [message: string]
}>()

const input = ref('')

const isStreaming = computed(() => disabled || status === 'streaming' || status === 'submitted')
// T21：模型由后端 catalog/指派决定，聊天输入只读展示当前指派
// T25：pi 已是唯一路径（门退役），旧模型/资料切换臂与图片附件流已切除
// （图片从不进 pi 后端——analyze 直通已随旧面删除，C4a 通道 B 落地时恢复）
const isMarketingMode = computed(() => piChatMode.value === 'marketing')

// T24：profile 下拉数据源（失败 → null → 空态降级，C5）
onMounted(() => {
  void ensurePiStudioManifest()
})
const piModelLabel = computed(
  // T38：useForkPi() 返回 Ref——script 内访问必须 .value（T35 曾丢 .value 致标签空白）
  () => piDesignAssignment.value?.modelId ?? piDialogs.value.designModelDefault
)

function handleInputKeydown(event: KeyboardEvent) {
  if (event.code !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  const target = event.currentTarget
  if (target instanceof HTMLElement) target.closest('form')?.requestSubmit()
}

function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}

// T27：父级在提交失败时回填草稿（emit 即清空是即时反馈设计，失败不该丢稿）；
// 用户已另起新输入时不覆盖
function restoreDraft(text: string) {
  if (!input.value.trim()) input.value = text
}
defineExpose({ restoreDraft })
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-2.5">
      <form @submit="handleSubmit">
        <InputGroup :disabled="isStreaming">
          <textarea
            v-model="input"
            data-test-id="chat-input"
            :placeholder="dialogs.describeChange"
            :disabled="isStreaming"
            rows="2"
            aria-label="Describe a change"
            class="block min-h-12 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-xs leading-relaxed text-surface outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            @keydown="handleInputKeydown"
            @copy.stop
            @cut.stop
          />

          <template #model>
            <div class="flex min-w-0 items-center">
              <div
                class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted"
                data-test-id="chat-pi-model-label"
              >
                <icon-lucide-bot class="size-3 shrink-0" />
                <span class="truncate">{{ piModelLabel }}</span>
                <!-- T24：AgentMode 切换 + profile 下拉（后者仅 marketing 模式，
                     注册表 acceptsProfile 语义） -->
                <ChatModeSelect :disabled="isStreaming" />
                <ChatStyleProfileSelect v-if="isMarketingMode" :disabled="isStreaming" />
              </div>
            </div>
          </template>

          <template #actions>
            <IconButton
              :label="dialogs.providerSettings"
              size="sm"
              data-test-id="provider-settings-trigger"
              @click="openSettingsDialog('ai')"
            >
              <icon-lucide-settings class="size-3.5" />
            </IconButton>
            <IconButton
              v-if="isStreaming"
              :label="dialogs.stopGenerating"
              size="sm"
              data-test-id="chat-stop-button"
              class="border border-border"
              @click="emit('stop')"
            >
              <icon-lucide-square class="size-3" />
            </IconButton>
            <IconButton
              v-else
              :label="dialogs.sendMessage"
              size="sm"
              type="submit"
              data-test-id="chat-send-button"
              class="bg-accent text-white hover:bg-accent/90 hover:text-white"
              :disabled="!input.trim()"
            >
              <icon-lucide-send class="size-3.5" />
            </IconButton>
          </template>
        </InputGroup>
      </form>
    </div>
  </TooltipProvider>
</template>
