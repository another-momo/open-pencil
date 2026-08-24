<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { TooltipProvider } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ChatModeSelect from '@/components/chat/ChatModeSelect.vue'
import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ChatStyleProfileSelect from '@/components/chat/ChatStyleProfileSelect.vue'
import ProviderModelSelect from '@/components/chat/ProviderModelSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import InputGroup from '@/components/ui/InputGroup.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { designModelProfile, designModelProfiles } from '@/app/ai/models'
import { piDesignAssignment } from '@/app/ai/pi-backend/assignment'
import { ensurePiBrandManifest, piChatMode } from '@/app/ai/pi-backend/mode-selection'
import {
  createImagePreviewURL,
  revokeImagePreviewURL,
  validateImageAttachmentFile
} from '@/app/ai/attachment/image/prepare'
import { MAX_IMAGE_ATTACHMENTS, type ImageAttachmentDraft } from '@/app/ai/attachment/image/types'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useI18n } from '@open-pencil/vue'

const { providerID, providerDef, modelID, customModelID } = useAIChat()
const { dialogs } = useI18n()

const { status, disabled = false } = defineProps<{
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [text: string, images: ImageAttachmentDraft[]]
  stop: []
  error: [message: string]
}>()

const input = ref('')
const images = ref<ImageAttachmentDraft[]>([])
const {
  open: openImageDialog,
  reset: resetImageDialog,
  onChange: onImageChange
} = useFileDialog({
  accept: 'image/png,image/jpeg,image/webp',
  multiple: true,
  reset: true
})

function addImageFiles(files: File[]) {
  const available = MAX_IMAGE_ATTACHMENTS - images.value.length
  if (available <= 0) {
    emit('error', `You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`)
    resetImageDialog()
    return
  }

  for (const file of files.slice(0, available)) {
    const validationError = validateImageAttachmentFile(file)
    if (validationError) {
      emit('error', validationError)
      continue
    }
    images.value.push({ file, previewURL: createImagePreviewURL(file) })
  }
  if (files.length > available) {
    emit('error', `You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`)
  }
  resetImageDialog()
}

function removeImage(index: number) {
  const image = images.value[index]
  if (image) revokeImagePreviewURL(image.previewURL)
  images.value.splice(index, 1)
  resetImageDialog()
}

const isStreaming = computed(() => disabled || status === 'streaming' || status === 'submitted')
// T21：pi 模式下模型由后端 catalog/指派决定，聊天输入只读展示当前指派
const isPiBackend = import.meta.env.VITE_PI_BACKEND === '1'
const isMarketingMode = computed(() => piChatMode.value === 'marketing')

// T24：profile 下拉数据源（失败 → null → 空态降级，C5）；仅 pi 后端需要
onMounted(() => {
  if (isPiBackend) void ensurePiBrandManifest()
})
const piModelLabel = computed(
  () => piDesignAssignment.value?.modelId ?? dialogs.value.piDesignModelDefault
)
const isAgentProvider = computed(() => providerID.value === 'harness:pi')
const agentName = computed(() => 'Pi')
const isCustomProvider = computed(
  () => providerID.value === 'openai-compatible' || providerID.value === 'anthropic-compatible'
)
const customModelName = computed(() => customModelID.value.trim())
const usesCustomModel = computed(
  () => !!providerDef.value.supportsCustomModel && !!customModelName.value
)

const selectedModelName = computed(() => {
  if (usesCustomModel.value) return customModelName.value
  if (isCustomProvider.value) return 'No model'
  return providerDef.value.models.find((m) => m.id === modelID.value)?.name ?? modelID.value
})

// Switching between saved profiles only makes sense once more than one can drive the design agent.
const switchableProfiles = computed(designModelProfiles)
const canSwitchProfile = computed(() => switchableProfiles.value.length > 1)
const selectedProfileName = computed(
  () => designModelProfile.value?.name ?? selectedModelName.value
)

function clearImages() {
  for (const image of images.value) revokeImagePreviewURL(image.previewURL)
  images.value = []
  resetImageDialog()
}

onImageChange((selectedFiles) => {
  if (selectedFiles) addImageFiles([...selectedFiles])
})

function handlePaste(event: ClipboardEvent) {
  const files = event.clipboardData?.files
  const images = files ? [...files].filter((file) => file.type.startsWith('image/')) : []
  if (images.length === 0) return
  event.preventDefault()
  addImageFiles(images)
}

onBeforeUnmount(clearImages)

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
  const submittedImages = images.value
  images.value = []
  resetImageDialog()
  emit('submit', text, submittedImages)
  input.value = ''
}
</script>

<template>
  <TooltipProvider>
    <div class="shrink-0 border-t border-border p-2.5">
      <form @submit="handleSubmit" @paste.stop="handlePaste">
        <InputGroup :disabled="isStreaming">
          <template v-if="images.length" #attachment>
            <div class="flex flex-wrap gap-1.5">
              <div
                v-for="(image, index) in images"
                :key="image.previewURL"
                class="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-canvas p-1.5 shadow-xs"
              >
                <img
                  :src="image.previewURL"
                  :alt="image.file.name"
                  width="40"
                  height="40"
                  class="size-10 shrink-0 rounded-md border border-border object-cover"
                />
                <span class="min-w-0 flex-1 truncate text-[10px] text-surface">
                  {{ image.file.name }}
                </span>
                <IconButton
                  :label="`Remove image ${image.file.name}`"
                  size="xs"
                  @click="removeImage(index)"
                >
                  <icon-lucide-x class="size-3" />
                </IconButton>
              </div>
            </div>
          </template>

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

          <template #leading>
            <IconButton
              label="Attach images"
              size="sm"
              :disabled="isStreaming || images.length >= MAX_IMAGE_ATTACHMENTS"
              @click="openImageDialog()"
            >
              <icon-lucide-image-plus class="size-4" />
            </IconButton>
          </template>

          <template #model>
            <div class="flex min-w-0 items-center">
              <div
                v-if="isPiBackend"
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
              <template v-else-if="isAgentProvider">
                <div class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted">
                  <icon-lucide-bot class="size-3 shrink-0" />
                  <span class="truncate">{{ agentName }}</span>
                </div>
              </template>
              <ChatProfileSelect
                v-else-if="canSwitchProfile && (isCustomProvider || usesCustomModel)"
              >
                <template #value>
                  <span class="min-w-0 truncate">{{ selectedProfileName }}</span>
                </template>
              </ChatProfileSelect>
              <div
                v-else-if="isCustomProvider || usesCustomModel"
                class="flex min-w-0 items-center gap-1 px-1.5 text-[10px] text-muted"
                data-test-id="chat-custom-model-label"
              >
                <icon-lucide-bot class="size-3 shrink-0" />
                <span class="truncate">{{ selectedModelName }}</span>
              </div>
              <ProviderModelSelect v-else>
                <template #value>
                  <span class="min-w-0 truncate">{{ selectedModelName }}</span>
                </template>
              </ProviderModelSelect>
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
