<script setup lang="ts">
/**
 * T56（Phase 3 W2/T-B5）：ask_user_question 聊天内表单卡片——全新建。
 *
 * 数据源 = tool part：`input.questions` 渲染表单（经 core validateAskUserQuestions
 * 归一；校验失败 → 无效定义降级提示，不崩），`output.formId`（awaiting 信封
 * details 骑 mapping 到 output）决定可提交态——formId 未就位时提交/跳过禁用。
 *
 * 作答 → emit submit {formId, aborted:false, answers}；逃生口自由文本 + 跳过 →
 * emit submit {formId, aborted:true, freeText}。提交后本地禁用态；重载后由父级
 * answered prop（formId 相关性，ChatPanel answeredFormIds 派生）置灰。
 *
 * 图像候选：nodeId → 当前编辑器 store renderExportImage（T55）缩略图；
 * 节点缺失/导出失败 → 占位块显 label（不崩）。v1 仅当前编辑器文档。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import {
  validateAskUserQuestions,
  type AskFormSubmission,
  type AskImageOption,
  type AskQuestionSpec
} from '@open-pencil/core/tools/fork/marketing/ask-user-question'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { useForkAsk } from '@/app/i18n/fork'

import type { UIDataTypes, UIMessagePart, UITools } from 'ai'

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>

const {
  part,
  answered = false,
  disabled = false
} = defineProps<{
  part: ToolPart
  answered?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  submit: [submission: AskFormSubmission]
}>()

const askDialogs = useForkAsk()

// 归一表单定义（required 缺省 true 等由 core 校验层补齐）；非法定义 → 降级提示
const parsed = computed(() => validateAskUserQuestions(part.input))
const questions = computed<AskQuestionSpec[]>(() =>
  'questions' in parsed.value ? parsed.value.questions : []
)
const definitionError = computed(() => ('error' in parsed.value ? parsed.value.message : null))

const formId = computed(() => {
  if (part.state !== 'output-available') return null
  const output = part.output
  if (typeof output === 'object' && output !== null && 'formId' in output) {
    const id = (output as { formId?: unknown }).formId
    return typeof id === 'string' ? id : null
  }
  return null
})

const selections = reactive<Record<string, string>>({})
const textAnswers = reactive<Record<string, string>>({})
const freeText = ref('')
const submittedKind = ref<'answer' | 'skip' | null>(null)
const showRequiredHint = ref(false)

const isLocked = computed(() => answered || submittedKind.value !== null || disabled)

function answerOf(question: AskQuestionSpec): string {
  if (question.kind === 'text') return (textAnswers[question.id] ?? '').trim()
  return selections[question.id] ?? ''
}

const missingRequired = computed(() =>
  questions.value.filter((question) => question.required && answerOf(question) === '')
)

function handleSubmit() {
  if (isLocked.value || !formId.value) return
  if (missingRequired.value.length > 0) {
    showRequiredHint.value = true
    return
  }
  const answers: Record<string, string> = {}
  for (const question of questions.value) {
    const value = answerOf(question)
    if (value) answers[question.id] = value
  }
  submittedKind.value = 'answer'
  emit('submit', { formId: formId.value, aborted: false, answers })
}

function handleSkip() {
  if (isLocked.value || !formId.value) return
  submittedKind.value = 'skip'
  emit('submit', { formId: formId.value, aborted: true, freeText: freeText.value.trim() })
}

// ── 图像候选缩略图（当前编辑器文档；失败 → null → 占位块） ──

const THUMBNAIL_RENDER_SIZE = 192
const thumbnails = reactive<Record<string, string | null | undefined>>({})
const createdUrls: string[] = []

const imageOptionList = computed(() =>
  questions.value.flatMap((question) => question.imageOptions ?? [])
)

function setThumbnail(nodeId: string, url: string | null) {
  thumbnails[nodeId] = url
}

function thumbnailURL(nodeId: string): string | undefined {
  const url = thumbnails[nodeId]
  return typeof url === 'string' ? url : undefined
}

async function loadThumbnail(option: AskImageOption) {
  const store = getActiveEditorStoreOrNull()
  const node = store?.graph.getNode(option.nodeId)
  if (!store || !node) {
    setThumbnail(option.nodeId, null)
    return
  }
  const scale = THUMBNAIL_RENDER_SIZE / Math.max(node.width, node.height, 1)
  try {
    const data = await store.renderExportImage([option.nodeId], scale, 'PNG')
    if (!data) {
      setThumbnail(option.nodeId, null)
      return
    }
    const url = URL.createObjectURL(new Blob([data], { type: 'image/png' }))
    createdUrls.push(url)
    setThumbnail(option.nodeId, url)
  } catch {
    setThumbnail(option.nodeId, null)
  }
}

onMounted(() => {
  for (const option of imageOptionList.value) void loadThumbnail(option)
})

onBeforeUnmount(() => {
  for (const url of createdUrls) URL.revokeObjectURL(url)
})
</script>

<template>
  <div data-test-id="ask-form-card" class="space-y-3 rounded-lg border border-border bg-canvas p-3">
    <div class="flex items-center gap-2">
      <icon-lucide-list-checks class="size-3.5 shrink-0 text-accent" />
      <span class="text-[11px] font-medium text-surface">{{ askDialogs.askFormTitle }}</span>
      <span
        v-if="isLocked"
        data-test-id="ask-form-answered-badge"
        class="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted"
      >
        {{ submittedKind === 'skip' ? askDialogs.askSkipped : askDialogs.askAnswered }}
      </span>
    </div>

    <div v-if="definitionError" class="text-[11px] text-muted">
      {{ askDialogs.askInvalidDefinition }}
    </div>

    <template v-else>
      <div
        v-for="question in questions"
        :key="question.id"
        class="space-y-1.5"
        :data-test-id="`ask-question-${question.id}`"
      >
        <div class="text-[11px] text-surface">
          <span v-if="question.required" class="mr-0.5 text-accent">*</span>
          {{ question.label }}
          <span v-if="!question.required" class="ml-1 text-[10px] text-muted">{{
            askDialogs.askOptional
          }}</span>
        </div>

        <!-- single_select：选项卡片组 -->
        <div v-if="question.kind === 'single_select'" class="flex flex-col gap-1">
          <button
            v-for="option in question.options ?? []"
            :key="option.id"
            type="button"
            :disabled="isLocked"
            :data-test-id="`ask-option-${question.id}-${option.id}`"
            class="rounded-md border px-2.5 py-1.5 text-left text-[11px] transition-colors"
            :class="
              selections[question.id] === option.id
                ? 'border-accent bg-accent/10 text-surface'
                : 'border-border bg-input text-surface hover:bg-hover'
            "
            @click="selections[question.id] = option.id"
          >
            <div>{{ option.label }}</div>
            <div v-if="option.hint" class="mt-0.5 text-[10px] text-muted">{{ option.hint }}</div>
          </button>
        </div>

        <!-- image_select：画布节点缩略图网格 -->
        <div v-else-if="question.kind === 'image_select'" class="grid grid-cols-3 gap-1.5">
          <button
            v-for="option in question.imageOptions ?? []"
            :key="option.nodeId"
            type="button"
            :disabled="isLocked"
            :data-test-id="`ask-image-option-${question.id}-${option.nodeId}`"
            class="overflow-hidden rounded-md border transition-colors"
            :class="
              selections[question.id] === option.nodeId
                ? 'border-accent'
                : 'border-border hover:border-accent/50'
            "
            @click="selections[question.id] = option.nodeId"
          >
            <div class="flex h-20 items-center justify-center bg-input">
              <img
                v-if="thumbnailURL(option.nodeId)"
                :src="thumbnailURL(option.nodeId)"
                :alt="option.label ?? option.nodeId"
                class="max-h-full max-w-full object-contain"
                draggable="false"
              />
              <div v-else class="flex flex-col items-center gap-1 px-1 text-[10px] text-muted">
                <icon-lucide-loader-circle
                  v-if="thumbnails[option.nodeId] === undefined"
                  class="size-3 animate-spin"
                />
                <template v-else>
                  <icon-lucide-image-off class="size-3" />
                  <span>{{ askDialogs.askImageUnavailable }}</span>
                </template>
              </div>
            </div>
            <div class="truncate px-1.5 py-1 text-[10px] text-surface">
              {{ option.label ?? option.nodeId }}
            </div>
          </button>
        </div>

        <!-- text：自由文本输入 -->
        <input
          v-else
          v-model="textAnswers[question.id]"
          type="text"
          :disabled="isLocked"
          :placeholder="askDialogs.askTextPlaceholder"
          :data-test-id="`ask-text-${question.id}`"
          class="block w-full rounded-md border border-border bg-input px-2.5 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
      </div>

      <div v-if="showRequiredHint && !isLocked" class="text-[10px] text-red-400">
        {{ askDialogs.askRequiredHint }}
      </div>

      <!-- 逃生口：自由文本 + 跳过（必带，S3 §6） -->
      <textarea
        v-model="freeText"
        rows="2"
        :disabled="isLocked"
        :placeholder="askDialogs.askSkipPlaceholder"
        data-test-id="ask-form-freetext"
        class="block w-full resize-none rounded-md border border-border bg-input px-2.5 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
      />

      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          :disabled="isLocked || !formId"
          data-test-id="ask-form-skip"
          class="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleSkip"
        >
          {{ askDialogs.askSkip }}
        </button>
        <button
          type="button"
          :disabled="isLocked || !formId"
          data-test-id="ask-form-submit"
          class="rounded-md bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          @click="handleSubmit"
        >
          {{ askDialogs.askSubmit }}
        </button>
      </div>
    </template>
  </div>
</template>
