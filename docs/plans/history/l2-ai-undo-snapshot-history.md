## 实测数据（2026-07-27）

模拟典型营销 banner 设计（25 节点：root frame + 8 sections × {text, rectangle}），跑本地 snapshot 测量：

| 场景 | 累积内存 |
|---|---|
| 单次 snapshot 大小 | 76.6 KB |
| 每条 undo entry 占用（含 forward + inverse 闭包各持 1 份） | **153 KB** |
| 50 步 AI session | **7.48 MB** |
| 200 步填满 UndoManager 限制 | **30 MB** |
| 真实 banner（100+ 节点，含 textPicture） | 单 snapshot 200-500 KB，上限可达 **100 MB+** |

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

## 验收 checklist

- [x] Step 1-3 实施完成
- [x] Step 4 单元测试通过（5 个 case）
- [x] 既有 `tests/engine/editor/undo.test.ts` 不变通过
- [ ] 第 4 轮护栏冒烟 + 朋友圈广告冒烟通过
- [ ] DevTools memory：1 次 burst 后 undo ≤ 200 KB
- [ ] 行为：Ctrl+Z 撤销整段 burst 符合预期
- [x] 实施记录记入 `README.md`