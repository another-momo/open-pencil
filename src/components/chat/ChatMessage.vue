<script setup lang="ts">
import { computed } from 'vue'
import { isFileUIPart, isTextUIPart, isToolUIPart, getToolName } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Markdown } from 'vue-stream-markdown'
import { useI18n, vTestId } from '@open-pencil/vue'
import 'vue-stream-markdown/index.css'

import { resolvedAppTheme } from '@/app/shell/theme'

import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'
import type { AskFormSubmission } from '@open-pencil/core/tools/fork/marketing/ask-user-question'

import AskUserQuestionCard from './AskUserQuestionCard.vue'
import {
  CONTEXT_SWITCH_PART_TYPE,
  NEW_INTENT_PART_TYPE,
  normalizeSizeChoices,
  parseSetupAwaitingIntent,
  type ContextSwitchPartData,
  type NewIntentPartData
} from './active-design'
import ChatAwaitingIntentCard from './ChatAwaitingIntentCard.vue'
import ChatNewIntentCard from './ChatNewIntentCard.vue'
import ChatSetActiveDesignCard from './ChatSetActiveDesignCard.vue'
import { classifyToolState } from './tool-state'

import { useForkConfirm } from '@/app/i18n/fork'

const {
  message,
  streaming = false,
  answeredFormIds,
  consentDecisions
} = defineProps<{
  message: UIMessage
  streaming?: boolean
  /** T56：已作答/已跳过表单的 formId 集（ChatPanel 扫用户消息信封派生） */
  answeredFormIds?: ReadonlySet<string>
  /** T61：set_active_design 同意决定（ChatPanel 扫 data part 记录派生，按 toolCallId） */
  consentDecisions?: ReadonlyMap<string, 'agreed' | 'declined'>
}>()
const emit = defineEmits<{
  formSubmit: [submission: AskFormSubmission]
  /** T61：新建意图确认卡决断（ChatPanel 发信封 / 回滚 chips）；T65：canvas 随确认进信封 */
  intentConfirm: [payload: { messageId: string; referenceNodeIds: string[]; canvas: string | null }]
  intentCancel: [payload: { messageId: string }]
  /** T61：set_active_design 同意卡决断（同意调端点 / 不同意本地系统行） */
  consentDecide: [payload: { toolCallId: string; agree: boolean }]
  /** T91b：setup_design awaiting_new_intent_confirmation 信封 → ChatPanel 调 intent-confirm + abort */
  intentAwaitingConfirm: [payload: { toolCallId: string; modeId: string; profileId: string }]
  intentAwaitingCancel: [payload: { toolCallId: string; modeId: string; profileId: string }]
}>()
const { dialogs } = useI18n()
const confirmText = useForkConfirm()
const isDark = computed(() => resolvedAppTheme.value === 'dark')
const markdownMode = computed(() => (streaming ? 'streaming' : 'static'))

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>

/** T56：awaiting 信封 details（骑 mapping 到 part.output）里的 formId */
function askFormId(part: ToolPart): string | null {
  if (part.state !== 'output-available') return null
  const output = part.output
  if (typeof output === 'object' && output !== null && 'formId' in output) {
    const id = (output as { formId?: unknown }).formId
    return typeof id === 'string' ? id : null
  }
  return null
}

function isAskFormAnswered(part: ToolPart): boolean {
  const id = askFormId(part)
  return id !== null && (answeredFormIds?.has(id) ?? false)
}

/** T61：宿主发起的新建意图确认卡 data part 判定 + 载荷防御性归一 */
function isNewIntentPart(part: UIMessagePart<UIDataTypes, UITools>): boolean {
  return part.type === NEW_INTENT_PART_TYPE && 'data' in part
}

function newIntentData(part: UIMessagePart<UIDataTypes, UITools>): NewIntentPartData {
  const raw = ('data' in part ? part.data : null) as Partial<NewIntentPartData> | null
  return {
    modeId: typeof raw?.modeId === 'string' ? raw.modeId : null,
    profileId: typeof raw?.profileId === 'string' ? raw.profileId : null,
    caseKind: raw?.caseKind === 'B' ? 'B' : 'A',
    activeDesignName: typeof raw?.activeDesignName === 'string' ? raw.activeDesignName : null,
    sizeChoices: normalizeSizeChoices(raw?.sizeChoices),
    references: Array.isArray(raw?.references) ? raw.references : [],
    resolved: raw?.resolved === 'confirmed' || raw?.resolved === 'cancelled' ? raw.resolved : null
  }
}

/** T65（决策 D3）：上下文切换分割线 data part 判定 + 载荷防御性归一 */
function isContextSwitchPart(part: UIMessagePart<UIDataTypes, UITools>): boolean {
  return part.type === CONTEXT_SWITCH_PART_TYPE && 'data' in part
}

function contextSwitchName(part: UIMessagePart<UIDataTypes, UITools>): string {
  const raw = ('data' in part ? part.data : null) as Partial<ContextSwitchPartData> | null
  return typeof raw?.name === 'string' && raw.name !== '' ? raw.name : '—'
}

function toolDisplayName(part: ToolPart): string {
  return getToolName(part)
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  // 委托上游 classifyToolState（b65b1bd4：MCP output-available+isError:true 不再误判 done）
  return classifyToolState({
    toolName: getToolName(part),
    state: part.state,
    output: part.output
  })
}

function partKey(part: UIMessagePart<UIDataTypes, UITools>, index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}

/** T81 P-01：AI SDK `file` chunk（media-output.ts:48-70 产 base64 data URL）的展示。
 * 图像直渲；非图像（视频/音频/...）保守回落文件名占位（不再吞）。 */
type FilePart = Extract<UIMessagePart<UIDataTypes, UITools>, { type: 'file' }>

function filePartAlt(part: FilePart): string {
  const tail = part.url.split('/').pop() ?? ''
  const isImage = part.mediaType.startsWith('image/')
  return isImage ? `AI attachment (${part.mediaType})` : `AI attachment: ${tail || part.mediaType}`
}

function filePartFilename(part: FilePart): string {
  return part.url.split('/').pop() || part.mediaType
}
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div
      class="min-w-0 space-y-2 select-text"
      :class="message.role === 'user' ? 'max-w-[85%]' : ''"
    >
      <template v-if="message.role === 'assistant'">
        <template v-for="(part, i) in message.parts" :key="partKey(part, i)">
          <!-- T56：ask_user_question → 聊天内表单卡片（先于通用折叠工具卡） -->
          <AskUserQuestionCard
            v-if="isToolUIPart(part) && getToolName(part) === 'ask_user_question'"
            :part="part"
            :answered="isAskFormAnswered(part)"
            :disabled="streaming"
            @submit="emit('formSubmit', $event)"
          />
          <!-- T61：set_active_design → 同意卡（同意/不同意均不伪装用户消息） -->
          <ChatSetActiveDesignCard
            v-else-if="isToolUIPart(part) && getToolName(part) === 'set_active_design'"
            :part="part"
            :resolved="consentDecisions?.get(part.toolCallId) ?? null"
            :disabled="streaming"
            @decide="emit('consentDecide', { toolCallId: part.toolCallId, agree: $event })"
          />
          <!-- T61：宿主发起的新建意图确认卡（data part，非工具 part） -->
          <ChatNewIntentCard
            v-else-if="isNewIntentPart(part)"
            :data="newIntentData(part)"
            :disabled="streaming"
            @confirm="
              emit('intentConfirm', {
                messageId: message.id,
                referenceNodeIds: $event.referenceNodeIds,
                canvas: $event.canvas
              })
            "
            @cancel="emit('intentCancel', { messageId: message.id })"
          />
          <!-- T91b：setup_design awaiting_new_intent_confirmation 信封 → ChatAwaitingIntentCard。
            先于通用折叠工具卡——core 返的 awaiting 信封不是 error，不能落进 error 视觉。 -->
          <ChatAwaitingIntentCard
            v-else-if="
              isToolUIPart(part) &&
              getToolName(part) === 'setup_design' &&
              part.state === 'output-available' &&
              parseSetupAwaitingIntent(part.output) !== null
            "
            :payload="parseSetupAwaitingIntent(part.output)!"
            :disabled="streaming"
            @confirm="
              emit('intentAwaitingConfirm', {
                toolCallId: part.toolCallId,
                modeId: parseSetupAwaitingIntent(part.output)!.modeId,
                profileId: parseSetupAwaitingIntent(part.output)!.profileId
              })
            "
            @cancel="
              emit('intentAwaitingCancel', {
                toolCallId: part.toolCallId,
                modeId: parseSetupAwaitingIntent(part.output)!.modeId,
                profileId: parseSetupAwaitingIntent(part.output)!.profileId
              })
            "
          />
          <!-- T65（决策 D3）：上下文切换回执 → 对话流分割线（非气泡） -->
          <div
            v-else-if="isContextSwitchPart(part)"
            data-test-id="chat-context-switch"
            class="flex items-center gap-2 py-0.5"
          >
            <div class="h-px flex-1 bg-border" />
            <span class="shrink-0 text-[11px] text-muted">{{
              confirmText.contextSwitchLine({ name: contextSwitchName(part) })
            }}</span>
            <div class="h-px flex-1 bg-border" />
          </div>
          <!-- Tool call -->
          <div v-else-if="isToolUIPart(part)" class="rounded-lg border border-border bg-canvas p-2">
            <CollapsibleRoot>
              <CollapsibleTrigger
                class="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
              >
                <div
                  class="flex size-4 items-center justify-center rounded-full"
                  :class="{
                    'bg-accent/20 text-accent': toolState(part) === 'pending',
                    'bg-green-500/20 text-green-400': toolState(part) === 'done',
                    'bg-red-500/20 text-red-400': toolState(part) === 'error'
                  }"
                >
                  <icon-lucide-loader-circle
                    v-if="toolState(part) === 'pending'"
                    class="size-3 animate-spin"
                  />
                  <icon-lucide-check v-else-if="toolState(part) === 'done'" class="size-3" />
                  <icon-lucide-triangle-alert v-else class="size-3" />
                </div>
                <span class="text-[11px] text-surface">
                  {{ toolDisplayName(part) }}
                </span>
                <span class="text-[10px] text-muted">
                  {{
                    toolState(part) === 'pending'
                      ? dialogs.toolRunning
                      : toolState(part) === 'done'
                        ? dialogs.toolFinished
                        : dialogs.toolError
                  }}
                </span>
                <icon-lucide-chevron-down
                  v-if="toolState(part) !== 'pending'"
                  class="ml-auto size-3 text-muted transition-transform [[data-state=open]>&]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent
                v-if="toolState(part) !== 'pending'"
                class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden text-[10px]"
              >
                <pre class="mt-1 overflow-x-auto rounded bg-input p-2 text-muted">{{
                  part.state === 'output-error' && part.errorText
                    ? part.errorText
                    : hasErrorOutput(part)
                      ? (part.output as { error: string }).error
                      : JSON.stringify(part.output, null, 2)
                }}</pre>
              </CollapsibleContent>
            </CollapsibleRoot>
          </div>

          <!-- Text -->
          <div
            v-else-if="isTextUIPart(part) && part.text"
            data-test-id="chat-text-bubble"
            class="rounded-xl rounded-tl-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface"
          >
            <Markdown
              :key="markdownMode"
              :content="part.text"
              :is-dark="isDark"
              :mermaid="false"
              :mode="markdownMode"
              :data-chat-markdown-mode="markdownMode"
              class="chat-markdown [&_[data-stream-markdown=code]]:!bg-input"
            />
          </div>
          <!-- T81 P-01：AI SDK `file` chunk（media-output.ts:48-70）补位渲染。
            图像直渲 data URL；非图像（视频/音频）回落文件名占位，不吞。 -->
          <div
            v-else-if="isFileUIPart(part)"
            data-test-id="chat-file-attachment"
            class="rounded-lg border border-border bg-canvas p-2"
          >
            <img
              v-if="part.mediaType.startsWith('image/')"
              :src="part.url"
              :alt="filePartAlt(part)"
              class="mt-1 max-h-48 rounded border border-border"
            />
            <div
              v-else
              class="flex items-center gap-2 rounded bg-input px-2 py-1 text-[11px] text-muted"
            >
              <icon-lucide-paperclip class="size-3" />
              <span class="truncate">{{ filePartFilename(part) }}</span>
              <span class="shrink-0 text-[10px]">{{ part.mediaType }}</span>
            </div>
          </div>
        </template>
      </template>

      <!-- User message -->
      <template v-else-if="message.role === 'user'">
        <div
          data-test-id="chat-text-bubble"
          class="rounded-xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-white"
        >
          {{
            message.parts
              .filter(isTextUIPart)
              .map((p) => p.text)
              .join('')
          }}
        </div>
      </template>
    </div>
  </div>
</template>
