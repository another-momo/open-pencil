/**
 * Batch 2g：节点缩略图 chip——selection token「@画布选区-N」→ chip 数据的
 * 纯函数适配面，外加 ChatNodePreview 的竞态守卫与渲染降级决策。
 *
 * 与上游 ChatNodePreview（upstream/master src/components/chat/ChatNodePreview.vue）
 * 的关系：上游数据入口是 ReferencedNode（@/app/ai/chat/context，已随旧 chat
 * 栈删除），组件直取 editor prop；我们把「token 文本 + 登记表 → chip props」
 * 的适配抽到这里做成纯函数，组件本体只留渲染/watch 壳（组件难单测的部分
 * 全部下沉本文件，钉扎在 tests/engine/rebuild/chat/node-preview.test.ts）。
 *
 * 纪律（与 selection-capture.ts 头部契约一致）：
 *  - chip 只承载**已采集**（登记表有条目）的引用 token；手打无登记占位串
 *    不进 chip 条——backdrop 高亮已提示它是个 token，清单行会如实标
 *    「未采集的引用」，chip 条不重复表达。
 *  - 节点名以读取瞬间的 graph 实况为准（live 优先），已删节点回落采集
 *    快照名——与 serializeSelectionManifest 同口径。
 *  - 缩略图目标 = token 首节点；多节点 token 只渲一张（chip 是 token 的
 *    视觉代理，不是节点清单）。
 */

import { scanSelectionTokens } from '@/components/assistant/selection-capture'
import type {
  SelectionNodeReader,
  SelectionTokenRegistry
} from '@/components/assistant/selection-capture'

// ── token → chip 适配 ────────────────────────────────────────────────────────

/** chip 的缩略图渲染目标（ChatNodePreview 的 props 形状） */
export interface NodePreviewTarget {
  nodeId: string
  /** 采集时页 id（renderNodesToImage 单页契约；采集后可翻页，不能用当前页） */
  pageId: string
  /** 节点名兜底（渲染失败/已删除时组件侧 tooltip/alt 语义用） */
  fallbackName: string
}

export interface SelectionTokenChip {
  /** token 序号（chip key） */
  n: number
  /** 缩略图目标（token 首节点；登记表条目契约上恒有 ≥1 节点） */
  preview: NodePreviewTarget
  /** chip 文本：节点名 ` + ` 连接（live 优先、快照兜底） */
  label: string
}

/**
 * 文本流实扫占位串 → chip 列表（首现序、按 n 去重——与 serialize 的
 * referencedNs 口径一致）。reader 传 null（store 缺席的 storybook/测试面）
 * 时全部用采集快照名。
 */
export function resolveSelectionTokenChips(
  text: string,
  registry: SelectionTokenRegistry,
  reader: SelectionNodeReader | null
): SelectionTokenChip[] {
  const chips: SelectionTokenChip[] = []
  const seen = new Set<number>()
  for (const token of scanSelectionTokens(text)) {
    if (seen.has(token.n)) continue
    seen.add(token.n)
    const entry = registry.get(token.n)
    if (!entry) continue
    // snapshot 与 nodeIds 等长（captureSelection 同步构建），下标访问安全
    const names = entry.nodeIds.map(
      (nodeId, i) => reader?.getNode(nodeId)?.name ?? entry.snapshot[i].name
    )
    chips.push({
      n: entry.n,
      preview: { nodeId: entry.nodeIds[0], pageId: entry.pageId, fallbackName: names[0] },
      label: names.join(' + ')
    })
  }
  return chips
}

// ── 竞态守卫（上游 request-id 同款） ─────────────────────────────────────────

/**
 * ChatNodePreview watch 重入守卫：每次渲染尝试取一个递增 id，回调落盘前
 * 校验仍是最新 id——watch 源快速变化（chip 复用/props 切换）时旧请求的
 * 结果不会覆盖新请求。组件每个实例持一个守卫。
 */
export function createPreviewRequestGuard(): {
  next(): number
  isCurrent(request: number): boolean
} {
  let current = 0
  return {
    next: () => ++current,
    isCurrent: (request) => request === current
  }
}

// ── 渲染尝试决策（降级路径） ─────────────────────────────────────────────────

/** 缩略图渲染目标边长（px，最长边）——同上游 40；chip 内以 size-4 显示 */
export const NODE_PREVIEW_TARGET_SIZE = 40

/**
 * 是否发起渲染 + 渲染 scale：renderer 缺席（canvas 未挂载/测试面）或节点
 * 已删 → null（组件降级为 box 图标 + 名称文本）；可渲染 → 最长边压到
 * 40px 的 scale（0 尺寸钳 1 防除零，同上游 Math.max(w, h, 1)）。
 * renderer 形参只判在场性，类型放宽为 unknown——真值渲染调用在组件里。
 */
export function resolvePreviewRender(
  renderer: unknown,
  node: { width: number; height: number } | undefined
): { scale: number } | null {
  if (!renderer || !node) return null
  const maxDimension = Math.max(node.width, node.height, 1)
  return { scale: NODE_PREVIEW_TARGET_SIZE / maxDimension }
}
