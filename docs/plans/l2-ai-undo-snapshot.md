# AI Undo Snapshot 累积：方案设计

> 状态与执行顺序见 `README.md`。
> 上层架构见 `00-overview.md`；上下文工程见 `l2-context-engineering.md`；视觉回路见 `l2-visual-loop.md`。

## 问题

2026-07-27 OOM 排查发现 render 进程崩溃的 **嫌疑 1**：

[`src/app/ai/tools/index.ts:107-117`](open-pencil/src/app/ai/tools/index.ts#L107) 让 AI 工具的每次变更走全页 snapshot：

```ts
onAfterExecute: async (def) => {
  if (def.mutates) {
    if (beforeSnapshot) {
      const before = beforeSnapshot
      const after = store.snapshotPage()  // ← 全页 structuredClone
      store.pushUndoEntry({
        label: `AI: ${def.name}`,
        forward:  () => store.restorePageFromSnapshot(after),
        inverse: () => store.restorePageFromSnapshot(before)
      })
      beforeSnapshot = null
    }
  }
}
```

**核心问题**：
- 每次 AI tool 调用 → 2 份完整页 snapshot（前/后）→ 都闭包在 undo entry 的 forward/inverse 函数里
- AI 单 session 可调用 50 步工具（`MAX_AGENT_STEPS = 50`，见 [`src/app/ai/tools/index.ts:16`](open-pencil/src/app/ai/tools/index.ts#L16)），每个工具调用都独立 push 一条 undo entry
- 与现有 chat history media elision（嫌疑 2）叠加，单 session 总内存可达 **20-50 MB+ 仅 undo + chat**

## 实测数据（2026-07-27）

模拟典型营销 banner 设计（25 节点：root frame + 8 sections × {text, rectangle}），跑本地 snapshot 测量：

| 场景 | 累积内存 |
|---|---|
| 单次 snapshot 大小 | 76.6 KB |
| 每条 undo entry 占用（含 forward + inverse 闭包各持 1 份） | **153 KB** |
| 50 步 AI session | **7.48 MB** |
| 200 步填满 UndoManager 限制 | **30 MB** |
| 真实 banner（100+ 节点，含 textPicture） | 单 snapshot 200-500 KB，上限可达 **100 MB+** |

## 方案：按 burst 分组 coalesce

**核心思路**：给 AI 工具的 undo entry 加共享 `coalesceKey`，让 UndoManager 自然合并每次 burst 的所有工具调用为单条 entry。复用 [`UndoManager` 已有的 `coalesceKey` 合并逻辑](open-pencil/packages/scene-graph/src/undo.ts#L139-L148)：

```ts
private pushUndoEntry(entry: UndoEntry): void {
  const previous = this.undoStack.at(-1)
  if (entry.coalesceKey && previous?.coalesceKey === entry.coalesceKey) {
    this.undoStack[this.undoStack.length - 1] = {
      ...entry,
      inverse: previous.inverse  // ← 保留最老的 inverse
    }
  } else {
    this.undoStack.push(entry)
  }
  // ...
}
```

机制：相邻 entry 同 key 自动合并；合并时**保留最老的 inverse（前=最原始状态）+ 用最新的 forward（最新修改）**。

## 合并粒度的设计选择

合并粒度决定"一次 undo 撤销多大的范围"。**4 个候选**（从粗到细）：

### 选项 α：整个编辑器生命周期 1 份（static key）

```
每次 AI tool 调用都用同一字符串 'ai-session-tool'
   ↓
   全 session 几十次 send 全部 → 1 条 entry
```

- 内存：单 entry 153 KB（vs 旧 7.5 MB）= **50x 节省**
- UX：一次 Ctrl+Z 撤销所有 AI 改动（编辑器生命周期内）
- 问题：用户没法单独撤销"上一次 chat 发送"，只能整体撤销

### 选项 β：每次 chat send 1 份（per-burst key）

```
每次用户发新消息 → burstId++ → 同 burstId 的所有 op 共用
   ↓
   send 1 → burstId=0 → entry A
   send 2 → burstId=1 → entry B（不与 A 合并，因 key 不同）
   send 3 → burstId=2 → entry C
```

- 内存：~每 chat 几 KB~几 MB × chat 次数（被 200 上限压住）
- UX：一次 Ctrl+Z 撤销"上次 chat"——对齐用户的心智
- 实现：需要在 ChatInput 的 handleSubmit 钩子点

### 选项 γ：每次 LLM round trip 1 份

```
LLM 每轮 reply + tool calls → 一份 entry
   ↓
   多 turn tool calling 会拆成多份
```

- 内存：不稳定（一轮可能几个 op 或几十个 op）
- UX：跟 chat send 不对齐（用户视角是"我发了这条消息"，不关心 AI 内部几轮）
- 实现：需要在 transports.ts 跟 assistant message 边界耦合

### 选项 δ：不合并（原始行为）

- 内存：7.5 MB / session（OOM 嫌疑）
- UX：撤销粒度最细，但内存爆

### 选 β（per-burst）

理由：
- **心智对齐**：用户视角"我刚才发的这一条消息" = 一次 burst，撤销一次回退到那之前
- **内存可控**：200 上限压住，每次 burst 1 条 entry，旧的 burst 自动被 trim
- **不依赖 LLM**：跟 chat send 触发耦合即可，跟 LLM 决策解耦
- **不依赖工具协同**：每个 AI tool op push 时读当前 burstId，无需 LLM 主动声明边界
- 静态 key（α）实施更简但 UX 边界不对——没法撤销"上次 chat"

## 选 β 的细节

### burstId 来源

`runState`（[`src/app/ai/tools/index.ts:51`](open-pencil/src/app/ai/tools/index.ts#L51)）已经是 per-editor WeakMap 跟踪当前 AI session。复用它加一个 `burstId: number` 字段：

```ts
class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0
  burstId = 0  // ← 新增
  // ...
}
```

`burstId` 自增时机：**用户发新消息时**——通过 ChatInput 钩子触发。

### ChatInput 钩子（hook 点）

[`src/components/chat/ChatInput.vue:91-97`](open-pencil/src/components/chat/ChatInput.vue#L91)：

```ts
function handleSubmit(e: Event) {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  emit('submit', text)
  input.value = ''
}
```

`handleSubmit` 是 Enter 和 Send 按钮的唯一交汇点。在 emit('submit') 之前/之后，加一个 `runState.burstId++` 即可。

### 你可能担心的"hook 时机"问题

> "如果我不点击按钮了，那 AI 返回的最新一次改动就没有 undo 存档？"

答：AI 跑完 burst 1 后**已经在 undo stack 里有 1 条 entry**。用户接下来不点 send、停 5 分钟、停 1 小时、停 1 天——这条 entry **不会主动消失**（UndoManager 的 trimUndoStack 只在 push 新 entry 时按 LRU 清理，**不主动 trim**）。

> "AI 跑 burst 1 没跑完被中断（比如 Stop 按钮或网络断开）呢？"

答：每个**已完成**的 op 在 onAfterExecute 都 push 了 entry，合并进同一 burstId 的栈顶 entry。如果用户在 burst 1 中途按 Stop，剩下的"半成品 burst"entry 仍然在 stack 上，下次 burst 2 开始时用新 burstId，会**自然与半成品分隔**（key 不同）。

### pushUndoEntry 调用改动

[`src/app/ai/tools/index.ts:113`](open-pencil/src/app/ai/tools/index.ts#L113) 加 `coalesceKey`：

```ts
const burstKey = `ai-burst-${runState.burstId}`

store.pushUndoEntry({
  label: `AI: ${def.name}`,
  coalesceKey: burstKey,  // ← 新增
  forward:  () => store.restorePageFromSnapshot(after),
  inverse: () => store.restorePageFromSnapshot(before)
})
```

**总改动量**：`src/app/ai/tools/index.ts` 加 burstId 字段、pushUndoEntry 加 coalesceKey 参数；`src/components/chat/ChatInput.vue` hook 一处。约 **~10 LOC**。

## 内存效益

| 场景 | 旧（每 entry 独立） | 新（per-burst coalesce） | 节省 |
|---|---|---|---|
| 50 步 AI session | 7.48 MB | 153 KB | **~50x** |
| 100 次连续 send（理论上） | 几百 MB | 200 KB × 100（被 200 上限压） | **~1000x**（极限值） |
| 与 chat media elision 叠加 | 20-50 MB | 1-3 MB | **~20x** |
| 1 次 burst 实际占用 | 153 KB × 50 = 7.5 MB | 153 KB（合并） | **50x** |

## 边界情况

| 场景 | 行为 |
|---|---|
| 1 次 send 跑 50 op | 全部 coalesceKey=burst0 → 1 条 entry |
| send 1 → send 2 → send 3（用户每次都在 burst 跑完后发下一条） | 3 条 entry，burstId 分别为 0、1、2 |
| 用户在 burst 1 跑完后按 Ctrl+Z | 撤销 burst 1；burstId=1 已经生成过，下次 send 用 burstId=2 |
| burst 1 跑完，用户挪了一个节点，再 send 2 | burst 2 用 burstId=2，不与 burst 1 合并 → 2 条 AI entry + 1 条用户 entry |
| 用户 burst 跑到一半，按 Stop | 已完成的 op push 进 stack（同一 burstId 合并）；burstId 不变，下次 send 还是新 burstId |
| 200 次 send 累积 | LRU trim 掉最早的 burst（实际生活不太可能达到） |

## UX 行为变化

| 场景 | 旧行为 | 新行为 |
|---|---|---|
| AI 跑 50 op 改完后用户 Ctrl+Z | 撤销最后 1 个工具调用（如只改 1 个属性） | **撤销整段 burst**（全部 50 op 回退到 burst 前） |
| 用户挪了节点后 Ctrl+Z | 撤销挪节点 | 不变（同上） |
| burst 1 + 用户挪 + burst 2 后 Ctrl+Z | 撤销 burst 2（最新） | 同上 |

**用户视角**：撤销粒度从"工具级"变粗到"burst 级"——心智对齐"撤销 AI 刚做的"，且**粒度粗比细好**。

## 验收

### 单元测试（`tests/engine/editor/ai-undo-burst.test.ts`，新）

- 5 个 case：
  1. N 个连续 push 同 burstId → undoStack.length === 1
  2. 第 1 步 inverse = 最早 beforeSnapshot，第 N 步 forward = 最新 afterSnapshot
  3. 中间闭包引用的 snapshot 因合并被释放（WeakRef 不可达）
  4. 用户 push 的 entry（无 coalesceKey）不参与合并
  5. 不同 burstId 不合并，新 burstId 从 1 开始

### 集成测试

- 既有 `tests/engine/editor/undo.test.ts` 全部通过（无 burst 路径不变）
- AI 测试（`tests/engine/tools/marketing/`）全部通过

### 冒烟测试

- 第 4 轮护栏 + 朋友圈广告冒烟，DevTools memory snapshot：
  - 1 次 AI burst（50 op）后 undo ≤ 200 KB（vs 旧 7.5 MB）
  - 多次 burst 后总量 ≤ ~5 MB
  - 不再出现 Render process gone OOM
- 验证：Ctrl+Z 撤销整段 burst 行为符合预期

## 实施步骤

### Step 1：`src/app/ai/tools/index.ts` 加 burstId 字段 + 改 pushUndoEntry

- `RunState` 加 `burstId: number` 字段（默认 0）
- `clearToolLogEntries` 中 `this.burstId++`（现有 reset 逻辑里加一行）
- `onAfterExecute` 的 `pushUndoEntry` 加 `coalesceKey: ai-burst-${runState.burstId}`

预计改动：**~6 LOC**

### Step 2：`src/components/chat/ChatInput.vue` hook 触发

不实际在这里加代码——而是在父组件（消费 ChatInput 的地方）接 `submit` 事件处理时，**额外**调用 `runState.burstId++`。这样 ChatInput 不需要直接 import 工具层逻辑。

预计改动：**~5 LOC**

### Step 3：单元测试 `tests/engine/editor/ai-undo-burst.test.ts`

预计：**~100 LOC** 新文件

### Step 4：冒烟验证

预计：DevTools memory 监控 + 撤销行为验证

### 总工作量

| 步骤 | LOC | 风险 |
|---|---|---|
| Step 1: 工具层加 burstId | ~6 | **极低**（不破坏既有路径） |
| Step 2: ChatInput hook | ~5 | 低（仅事件计数） |
| Step 3: 单元测试 | ~100 新文件 | 低 |
| Step 4: 冒烟验证 | -- | -- |
| **总计** | **~110 LOC** | **低** |

## 与现有体系的关系

| 组件 | 影响 |
|---|---|
| `UndoManager` | 不变（已支持 coalesceKey） |
| `EditorContext.undo` | 不变（仍是单 manager） |
| 用户 Ctrl+Z / Ctrl+Y | 撤销粒度变粗，但与心智一致 |
| Undo UI 面板 | 显示 1 条 "AI: render" 替代 N 条单工具 entry——更清晰 |
| `RunState` | 新增 `burstId` 字段（1 行） |

## 扩展触发条件

实施后如果出现：

- **撤销粒度太粗**：用户反馈"想撤销 burst 中间某次 op"——升级为更精细的合并（如 G3 round-trip 粒度，但需 LLM 配合，主动声明 ops intent）
- **entry 体积过大**：实测单 burst undo 仍 > 5 MB（营销 banner 200+ 节点）——再叠加 diff snapshot，~300 LOC
- **burstId 边界不准**：ACP / automated run 触发 AI 不经过 ChatInput——补 hook 在那些入口

## 不在本次范围

- ❌ Diff snapshot（实施后仍超内存才做）
- ❌ 跨 session undo 持久化（已在 `l2-context-engineering.md` 方案 2 覆盖）
- ❌ AI undo UI 区分（如颜色标识 "AI: render" vs "Move"）—— UI 增强，非必需
- ❌ LLM 主动声明 logical step（粒度细化方案，本次不做）

## 验收 checklist

- [ ] Step 1-3 实施完成
- [ ] Step 4 单元测试通过（5 个 case）
- [ ] 既有 `tests/engine/editor/undo.test.ts` 不变通过
- [ ] 第 4 轮护栏冒烟 + 朋友圈广告冒烟通过
- [ ] DevTools memory：1 次 burst 后 undo ≤ 200 KB
- [ ] 行为：Ctrl+Z 撤销整段 burst 符合预期
- [ ] 实施记录记入 `README.md`
