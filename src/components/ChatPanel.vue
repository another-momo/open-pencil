<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport
} from 'reka-ui'
import { refAutoReset } from '@vueuse/core'
import { computed, markRaw, nextTick, ref, watch } from 'vue'

import { copyChatLog } from '@/app/ai/debug'
import {
  getPiCurrentSessionId,
  hasPiDocId,
  listPiSessionFamily,
  switchPiSession,
  type PiSessionSummary
} from '@/app/ai/pi-backend/document-key'
import { activeTab } from '@/app/tabs'
import { getActiveEditorStore } from '@/app/editor/active-store'
import ChatInput from '@/components/chat/ChatInput.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'
import Tip from '@/components/ui/Tip.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import { useAIChat } from '@/app/ai/chat/use'
import { toast } from '@/app/shell/ui'
import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

const IS_DEV = import.meta.env.DEV

const { ensureChat, resetChat, chatFailure, clearChatFailure } = useAIChat()
const { dialogs } = useI18n()
const notifications = useNotificationMessages()

const chat = ref<Chat<UIMessage> | null>(null)
// T27：提交失败时经此把草稿回填进输入框（ChatInput 提交即清空——见 restoreDraft）；
// 结构化类型即可，不 import 组件类型（避免 script 侧只剩类型引用触发 consistent-type-imports）
const chatInputRef = ref<{ restoreDraft: (text: string) => void } | null>(null)

void ensureChat()
  .then((c) => {
    if (c) chat.value = markRaw(c)
    refreshSessionMeta()
    return undefined
  })
  .catch((error: unknown) => {
    toast.error(
      notifications.value.chatInitializationFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  })
const messagesEnd = ref<HTMLDivElement>()
const debugCopied = refAutoReset(false, 1500)

const messages = computed(() => chat.value?.messages ?? [])
const failureMessage = computed(() => {
  switch (chatFailure.value?.reason) {
    case 'insufficient-credit':
      return dialogs.value.chatInsufficientCredit
    case 'output-limit':
      return dialogs.value.chatOutputLimit
    case 'request-failed':
      return dialogs.value.chatRequestFailed
    default:
      return null
  }
})
const status = computed(() => chat.value?.status ?? 'ready')
function isStreamingMessage(message: UIMessage, index: number): boolean {
  return (
    message.role === 'assistant' &&
    index === messages.value.length - 1 &&
    (status.value === 'submitted' || status.value === 'streaming')
  )
}
const isThinking = computed(() => {
  const s = status.value
  if (s !== 'submitted' && s !== 'streaming') return false
  if (messages.value.length === 0) return true
  const last = messages.value[messages.value.length - 1]
  if (last.role !== 'assistant') return true
  const parts = last.parts
  if (parts.length === 0) return true
  const lastPart = parts[parts.length - 1] as JSONObject
  if (lastPart.type === 'step-start') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-available') return true
  if ('toolCallId' in lastPart && lastPart.state === 'output-error') return true
  return s === 'submitted'
})

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

watch(messages, scrollToBottom, { deep: true })
watch(
  () => chatFailure.value?.reason,
  (reason) => {
    if (!reason) return
    toast.error(failureMessage.value ?? dialogs.value.chatRequestFailed)
  }
)
watch(
  () => activeTab.value?.id,
  async () => {
    const nextChat = await ensureChat()
    chat.value = nextChat ? markRaw(nextChat) : null
    refreshSessionMeta()
  }
)
// T22：restore/打开文件在同 store 上 replaceGraph（tab id 不变，上面的 watcher
// 不触发）——图替换后 docId 才就位，重跑 ensureChat 补上历史回填
watch(
  () => activeTab.value?.store,
  (store, _prev, onCleanup) => {
    if (!store) return
    const stop = store.onEditorEvent('graph:replaced', () => {
      void ensureChat().then((nextChat) => {
        if (nextChat) chat.value = markRaw(nextChat)
        refreshSessionMeta()
        return undefined
      })
    })
    onCleanup(stop)
  },
  { immediate: true }
)

// T23：会话查看/切换（E3/E5）——下拉打开时实时拉族谱清单（不做轮询/缓存）；
// 切换即采用该 sessionId 并整体替换消息（后续发送续写被选会话）
const sessionMenuCls = useMenuUI({ content: 'min-w-56 max-w-72' })
const sessionItemCls = menuItem({ justify: 'start' })
const sessionList = ref<PiSessionSummary[]>([])
const currentSessionId = ref<string | null>(null)
const sessionMenuReady = ref(false)

function refreshSessionMeta() {
  const store = getActiveEditorStore()
  sessionMenuReady.value = hasPiDocId(store)
  currentSessionId.value = getPiCurrentSessionId(store)
}

async function handleSessionMenuOpen(open: boolean) {
  if (!open) return
  refreshSessionMeta()
  const list = await listPiSessionFamily(getActiveEditorStore())
  if (list) sessionList.value = list
}

const sessionTriggerLabel = computed(() =>
  currentSessionId.value ? sessionTimeLabel(currentSessionId.value) : 'Sessions'
)
const currentSessionMissing = computed(
  () =>
    currentSessionId.value !== null &&
    !sessionList.value.some((s) => s.sessionId === currentSessionId.value)
)

function sessionTimeLabel(sessionId: string): string {
  const match = /-(\d{8})T(\d{6})Z$/.exec(sessionId)
  if (!match) return sessionId
  const [, day, time] = match
  const date = new Date(
    `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T` +
      `${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`
  )
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function handleSwitchSession(sessionId: string) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  if (sessionId === currentSessionId.value) return
  const switched = await switchPiSession(getActiveEditorStore(), sessionId)
  if (!switched) {
    toast.error(dialogs.value.chatRequestFailed)
    return
  }
  const currentChat = chat.value ?? (await ensureChat())
  if (!currentChat) return
  currentChat.messages = switched
  chat.value = markRaw(currentChat)
  currentSessionId.value = sessionId
  sessionMenuReady.value = true
}

async function handleSubmit(text: string) {
  if (status.value === 'streaming' || status.value === 'submitted') return
  clearChatFailure()
  try {
    // 恒走 ensureChat：transport dirty（如 e2e mock 后注入）时重建会话，
    // 避免持有旧 transport 的 stale Chat
    const currentChat = await ensureChat()
    if (!currentChat) {
      toast.error(dialogs.value.chatRequestFailed)
      chatInputRef.value?.restoreDraft(text)
      return
    }
    chat.value = markRaw(currentChat)
    await currentChat.sendMessage({ text })
    // T27：ai SDK 的 sendMessage 内部吞错（错误走 onError + status='error'，
    // 不 reject——node_modules/ai AbstractChat.makeRequest 实证）——失败时回填草稿
    if (currentChat.status === 'error') chatInputRef.value?.restoreDraft(text)
    refreshSessionMeta()
  } catch (e) {
    console.error('Chat error:', e)
    toast.error(dialogs.value.chatRequestFailed)
    chatInputRef.value?.restoreDraft(text)
  }
}

function handleStop() {
  chat.value?.stop()
}

async function handleCopyDebug() {
  await copyChatLog(messages.value, chatFailure.value)
  debugCopied.value = true
}

function handleClearChat() {
  clearChatFailure()
  chat.value = null
  // T27：resetChat 现在 await 铸新会话完成（onSessionReset 返回 Promise），
  // then 里确定性刷新会话栏元信息——替代原 setTimeout(100) 魔法数等待
  void resetChat()
    .then(() => {
      refreshSessionMeta()
      return undefined
    })
    .catch((error: unknown) => {
      console.error('Chat reset error:', error)
    })
}
</script>

<template>
  <div data-test-id="chat-panel" class="flex min-w-0 flex-1 flex-col overflow-hidden select-text">
    <!-- T23 会话栏：族谱查看/切换（docId 未铸造或族为空时菜单内空态项） -->
    <div
      data-test-id="chat-session-bar"
      class="flex shrink-0 items-center border-b border-border px-3 py-1"
    >
      <DropdownMenuRoot @update:open="handleSessionMenuOpen">
        <Tip :label="currentSessionId ?? undefined">
          <DropdownMenuTrigger as-child>
            <AppTextButton
              data-test-id="chat-session-trigger"
              :ui="{ base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover' }"
            >
              <icon-lucide-history class="size-3" />
              {{ sessionTriggerLabel }}
              <icon-lucide-chevron-down class="size-3" />
            </AppTextButton>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuPortal>
          <DropdownMenuContent
            side="bottom"
            align="start"
            :side-offset="3"
            :class="sessionMenuCls.content"
            data-test-id="chat-session-menu"
          >
            <DropdownMenuItem
              v-if="!sessionMenuReady || sessionList.length === 0"
              disabled
              :class="sessionItemCls"
            >
              <span>No sessions yet</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="currentSessionMissing"
              disabled
              :class="sessionItemCls"
              data-test-id="chat-session-current-unsent"
            >
              <icon-lucide-check :class="sessionMenuCls.icon" />
              <span>{{ sessionTriggerLabel }} · new session</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              v-for="session in sessionList"
              :key="session.sessionId"
              :class="sessionItemCls"
              :data-test-id="`chat-session-item`"
              :data-session-id="session.sessionId"
              @select="handleSwitchSession(session.sessionId)"
            >
              <icon-lucide-check
                v-if="session.sessionId === currentSessionId"
                :class="sessionMenuCls.icon"
              />
              <span v-else class="size-3 shrink-0" />
              <span class="min-w-0 truncate">
                {{ sessionTimeLabel(session.sessionId) }} · {{ session.title || '(empty)' }} ·
                {{ session.messageCount }} msgs
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <ScrollAreaRoot class="min-h-0 flex-1">
      <ScrollAreaViewport class="h-full px-3 py-3 [&>div]:h-full">
        <AppPlaceholder
          v-if="messages.length === 0"
          data-test-id="chat-empty-state"
          :label="dialogs.describeCreateOrChange"
          :ui="{ root: 'h-full' }"
        >
          <template #icon>
            <icon-lucide-message-circle class="size-5" />
          </template>
        </AppPlaceholder>

        <!-- Messages -->
        <div v-else data-test-id="chat-messages" class="flex flex-col gap-3">
          <ChatMessage
            v-for="(msg, index) in messages"
            :key="msg.id"
            :message="msg"
            :streaming="isStreamingMessage(msg, index)"
          />

          <!-- Thinking indicator: shown when AI is working but no visible activity -->
          <div v-if="isThinking" data-test-id="chat-typing-indicator" class="flex gap-2">
            <div
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/20 text-[10px] font-bold text-muted"
            >
              AI
            </div>
            <div class="flex items-center gap-1 py-2">
              <span
                class="size-1.5 animate-bounce rounded-full bg-muted"
                style="animation-delay: 0ms"
              />
              <span
                class="size-1.5 animate-bounce rounded-full bg-muted"
                style="animation-delay: 150ms"
              />
              <span
                class="size-1.5 animate-bounce rounded-full bg-muted"
                style="animation-delay: 300ms"
              />
            </div>
          </div>

          <div ref="messagesEnd" />
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="vertical" class="flex w-1.5 touch-none p-px select-none">
        <ScrollAreaThumb class="relative flex-1 rounded-full bg-muted/30" />
      </ScrollAreaScrollbar>
    </ScrollAreaRoot>

    <!-- Chat toolbar -->
    <div
      v-if="messages.length > 0"
      class="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1"
    >
      <AppTextButton
        v-if="IS_DEV"
        :ui="{
          base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover'
        }"
        @click="handleCopyDebug"
      >
        <icon-lucide-clipboard-copy v-if="!debugCopied" class="size-3" />
        <icon-lucide-check v-else class="size-3 text-green-400" />
        {{ debugCopied ? 'Copied' : 'Copy log' }}
      </AppTextButton>
      <AppTextButton
        :ui="{
          base: 'flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover'
        }"
        @click="handleClearChat"
      >
        <icon-lucide-trash-2 class="size-3" />
        Clear
      </AppTextButton>
    </div>

    <ChatInput
      ref="chatInputRef"
      :status="status"
      @submit="handleSubmit"
      @stop="handleStop"
      @error="toast.error"
    />
  </div>
</template>
