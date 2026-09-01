/**
 * T61（Phase 3 W3/T-B10）重写：active_design 同步态 + 未确认新建意向暂存。
 *
 * T24 旧链退役（S4 T-B10 / PD-16 翻案）：localStorage `open-pencil:pi-chat-mode`
 * 全局选择态删除——chips 不再是路由开关，而是 active_design 的回显 + 新建意图
 * 暂存（共享契约 5，与 T60 对账）：
 *
 *  - piActiveDesign：文档根 sharedPluginData `activeDesignNodeId` 单槽
 *    （namespace = BRIEF_PLUGIN_NAMESPACE，键面常量以 core active-design.ts
 *    为单一事实源，T60 写入侧经桥落地）读出 nodeId，再从设计区根框标记
 *    读穿身份三元组 {modeId, profileId, briefId}（typeId 已随 T62 删除，
 *    旧文档残留键天然忽略）。指针任何移动后自动同步（sceneVersion watch +
 *    graph:replaced + tab 切换）；系统同步不触发意图。无 active（槽空 /
 *    节点被删 / 标记缺失）→ null → chips 回显默认态（general + 无 profile）。
 *  - piPendingNewIntent：用户手动拨 chip 的未确认暂存（不持久化）——发消息时
 *    ChatPanel 拦为新建意图确认卡；确认发出或取消回滚后清空。
 *  - piStudioManifest：数据源不变（GET /api/pi/studio/manifest），但失败按
 *    08 P0-2 纪律显式暴露（piStudioManifestFailed=true → chips 禁用 + 错误条
 *    + 重试），不再静默 null 降级。
 *
 * sharedPluginData 读取经 core getSharedPluginData（figma-api/plugin-data 深路径，
 * 同 AskUserQuestionCard 的 core 深 import 先例；编码键 `${namespace}/${key}`）。
 */

import { computed, shallowRef, ref, watch } from 'vue'

import { getSharedPluginData } from '@open-pencil/core/figma-api/plugin-data'
import { ACTIVE_DESIGN_KEY } from '@open-pencil/core/tools/fork/marketing/active-design'
import {
  BRIEF_PLUGIN_NAMESPACE,
  DESIGN_BRIEF_KEY,
  DESIGN_MODE_KEY,
  DESIGN_PROFILE_KEY
} from '@open-pencil/core/tools/fork/marketing/brief'
import { isMarketingDesignRoot } from '@open-pencil/core/tools/fork/marketing/setup'

import type { PiStudioManifest } from '@/app/ai/pi-backend/studio/manifest'
import {
  getActiveEditorStoreOrNull,
  useActiveEditorStoreRef,
  type EditorStore
} from '@/app/editor/active-store'

// ── manifest（显式失败面） ───────────────────────────────────────────────────

export const piStudioManifest = ref<PiStudioManifest | null>(null)
/** 拉取失败显式暴露（chips 禁用 + 错误条 + 重试的判定源） */
export const piStudioManifestFailed = ref(false)

let manifestRequested = false

async function fetchPiStudioManifest(): Promise<void> {
  piStudioManifestFailed.value = false
  try {
    const res = await fetch('/api/pi/studio/manifest')
    if (!res.ok) {
      piStudioManifest.value = null
      piStudioManifestFailed.value = true
      return
    }
    piStudioManifest.value = (await res.json()) as PiStudioManifest
  } catch (error) {
    piStudioManifest.value = null
    piStudioManifestFailed.value = true
    console.warn('[pi-backend] studio manifest 拉取失败——chips 禁用并显式暴露', error)
  }
}

/** 拉取 manifest（进程内一次；失败 → piStudioManifestFailed 显式暴露，用重试恢复） */
export async function ensurePiStudioManifest(): Promise<void> {
  if (manifestRequested) return
  manifestRequested = true
  await fetchPiStudioManifest()
}

/** 错误条重试按钮通路：允许失败后再拉（成功后幂等——manifest 不变更） */
export async function retryPiStudioManifest(): Promise<void> {
  if (!piStudioManifestFailed.value) return
  await fetchPiStudioManifest()
}

// ── active_design 同步态（共享契约 5） ───────────────────────────────────────

/** chips 默认态：无 active 时回显（general + 无 profile） */
export const PI_DEFAULT_MODE_ID = 'general'

export interface PiActiveDesignIdentity {
  nodeId: string
  name: string
  modeId: string
  profileId: string | null
  briefId: string | null
}

/** 当前 active_design 身份（读穿，null = 无 active → chips 默认态） */
export const piActiveDesign = shallowRef<PiActiveDesignIdentity | null>(null)

function readActiveDesignIdentity(store: EditorStore | null): PiActiveDesignIdentity | null {
  const root = store?.graph.getNode(store.graph.rootId)
  const nodeId = root ? getSharedPluginData(root, BRIEF_PLUGIN_NAMESPACE, ACTIVE_DESIGN_KEY) : ''
  if (nodeId === '') return null
  const node = store?.graph.getNode(nodeId)
  // 槽内指针悬空（节点被删 / 已非设计区根框）→ 视为无 active（清槽与聊天提示归宿主/T60）
  if (!store || !isMarketingDesignRoot(node)) return null
  const design = node
  const read = (key: string) => getSharedPluginData(design, BRIEF_PLUGIN_NAMESPACE, key)
  return {
    nodeId: design.id,
    name: design.name,
    modeId: read(DESIGN_MODE_KEY) || PI_DEFAULT_MODE_ID,
    profileId: read(DESIGN_PROFILE_KEY) || null,
    briefId: read(DESIGN_BRIEF_KEY) || null
  }
}

/** 显式重同步（切换端点成功回包后调用；常规路径由下方 watcher 自动覆盖） */
export function resyncPiActiveDesign(): void {
  piActiveDesign.value = readActiveDesignIdentity(getActiveEditorStoreOrNull())
}

const activeStoreRef = useActiveEditorStoreRef()
watch(
  activeStoreRef,
  (store, _prev, onCleanup) => {
    piActiveDesign.value = readActiveDesignIdentity(store ?? null)
    if (!store) return
    const currentStore = store
    const stopGraphReplaced = currentStore.onEditorEvent('graph:replaced', () => {
      piActiveDesign.value = readActiveDesignIdentity(currentStore)
    })
    // 指针移动 / 标记写入都走 graph mutation → sceneVersion++（同 autosave 信号）
    const stopSceneWatch = watch(
      () => currentStore.state.sceneVersion,
      () => {
        piActiveDesign.value = readActiveDesignIdentity(currentStore)
      }
    )
    onCleanup(() => {
      stopGraphReplaced()
      stopSceneWatch()
    })
  },
  { immediate: true }
)

// ── 未确认新建意向暂存（chips 拨动；不持久化） ───────────────────────────────

/** chips 选择（两级：mode → profile；type 级已随 T62 删除，无专属逻辑） */
export interface PiNewIntentSelection {
  modeId: string
  profileId: string | null
}

export const piPendingNewIntent = ref<PiNewIntentSelection | null>(null)

/** active 身份 → chips 回显选择（无 active → null，调用方回落默认态） */
function activeToSelection(active: PiActiveDesignIdentity | null): PiNewIntentSelection | null {
  if (!active) return null
  return { modeId: active.modeId, profileId: active.profileId }
}

/** chips 回显的单一事实源：未确认意向 > active 读穿 > 默认态 */
export const piChipSelection = computed<PiNewIntentSelection>(
  () =>
    piPendingNewIntent.value ??
    activeToSelection(piActiveDesign.value) ?? {
      modeId: PI_DEFAULT_MODE_ID,
      profileId: null
    }
)

function sameSelection(a: PiNewIntentSelection, b: PiNewIntentSelection): boolean {
  return a.modeId === b.modeId && a.profileId === b.profileId
}

/**
 * chips 拨动写口：与回显相同 = 无意图（清空暂存）；不同 = 暂存新建意向，
 * 发消息时由 ChatPanel 拦为确认卡（只拨 chip 浏览不发消息 = 无意图事件）。
 */
export function setPiChipSelection(selection: PiNewIntentSelection): void {
  const echo = activeToSelection(piActiveDesign.value) ?? {
    modeId: PI_DEFAULT_MODE_ID,
    profileId: null
  }
  piPendingNewIntent.value = sameSelection(selection, echo) ? null : selection
}

/** 确认发出 / 取消回滚后清空暂存（chips 回落 active 回显） */
export function clearPiPendingNewIntent(): void {
  piPendingNewIntent.value = null
}
