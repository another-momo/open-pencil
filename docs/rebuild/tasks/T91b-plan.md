# T91b-plan · newIntent pluginData + ChatPanel 拦截 + abort

> **任务来源**：owner 实测三个 bug + 仓外 `docs/202609031650-new-intent-plugindata-design.md` 设计文档
> **关联**：T91a 节点 ID 稳定性 + brief 接口合并（已 commit d1809c1df），本任务解决 bug 3（pluginData 时序错配）+ bug 2 的另一半（AI 发起新建意图的确认机制）
> **设计真源**：仓外 `docs/202609031650-new-intent-plugindata-design.md` 已全量描述，本任务仅补充实操细节

### 背景与动机

owner 实测发现三个 bug，T91a 已解决 bug 1（节点 ID 稳定性）和 bug 2（brief 视图歧义）。本任务解决 bug 3 + bug 2 另一半：

**Bug 3**：pluginData 时序错配导致装配错误（用户选 `editable-design-full` 后，AI 没有按该 workflow 执行）

- 根因：`envelope.modeId` 比装配点更早到达，但 `assembleTurn` 用 `slot.modeId`（旧值），等 `setup_design` 写入正确 modeId 时已经太晚
- 修复：新建意图的 workflow/profile 写入 pluginData，**装配时优先读 pluginData**（不依赖 envelope）

**Bug 2 另一半**：AI 发起新建意图无确认机制（用户说"根据需求单，再创作一张" → AI 调 `setup_design` → `unconfirmed_new_intent` → 死循环）

- 根因：`newIntentConfirmed()` 是内存闭包变量，只能由 envelope 触发；AI 提议后用户答"是"也无入口触发
- 修复：`setup_design` 检查 pluginData，未确认时返回 `{ status: 'awaiting_new_intent_confirmation' }` → 前端显示确认卡 + `abort(sessionId)` → 用户确认后前端写 pluginData → AI 再次调 `setup_design` 通过

### 关键事实

1. **pluginData 写入必须由 core 工具完成**（T91a 已确认）——前端 Vue 组件不能直写 pluginData
2. **新 server endpoint 需要** `POST /api/pi/intent-confirm`——让前端调用，core 写 pluginData
3. **assembleTurn 改造必须不破坏现有路径**——`newIntent` pluginData 为空时降级到 activeDesign/general
4. **abort 行为必须 100% 可靠**——前端主动检测 `awaiting_new_intent_confirmation` + 调 `abort()`（不依赖 LLM 遵从 prompt）

### 方案概览

#### 1. pluginData 键协议

新增键（document root `sharedPluginData` namespace=`open-pencil-marketing`）：

- `newIntentModeId` — 新建意图的 mode（如 `editable-design-full`）
- `newIntentProfileId` — 新建意图的 profile（如 `poster-v1`），可空
- `newIntentConfirmed` — 意图确认旗标（`"true"` 表示已确认，替代内存变量）

写入调用方：

- 前端确认按钮点击 → POST `/api/pi/intent-confirm` → core 写三键
- `setup_design` 成功 → 清三键
- 用户取消意图 → 前端 POST 清除

读取调用方：

- `assembleTurn` 装配时——优先读 `newIntentModeId`，覆盖 slot
- `setup_design` 执行时——读 `newIntentConfirmed` 替代 `intentConfirmed` 内存变量

#### 2. setup_design 改造

| 场景                                           | 旧行为              | 新行为                                          |
| ---------------------------------------------- | ------------------- | ----------------------------------------------- |
| 用户发起 + 已确认（pluginData 写了 confirmed） | 执行                | 执行（不变）                                    |
| 用户发起 + 未确认                              | 返回 error          | 返回 `awaiting_new_intent_confirmation` 信封    |
| AI 发起 + 未确认                               | 返回 error → 死循环 | 返回 `awaiting_new_intent_confirmation` + abort |
| AI 发起 + 已确认                               | 永远 error          | 执行（pluginData 已写）                         |

信封结构（与 ask_user_question `awaiting_user` 模式同构）：

```ts
{
  status: 'awaiting_new_intent_confirmation',
  proposed: { nodeId: string, name: string, modeId: string, profileId: string, briefId: string | null },
  catalog?: { modes: [...] }
}
```

#### 3. ChatPanel 拦截

```ts
if (toolResult.status === 'awaiting_new_intent_confirmation') {
  showNewIntentConfirmationCard(toolResult.proposed, toolResult.catalog)
  abort(sessionId) // 停止 agent loop
}
```

#### 4. server endpoint

新增 `POST /api/pi/intent-confirm`：

- 入参 `{ modeId, profileId }`
- core 工具 `confirmNewIntent(figma, { modeId, profileId })` 写三键到 document root
- 返 `{ success: true }`

#### 5. assembleTurn 优先级

```
newIntent pluginData > activeDesign slot > general（默认）
```

实现：`resolveEffectiveIds(registry, slot, documentRoot)` 优先读 pluginData → 覆盖 slot。

### 改动清单（约 6 文件）

#### 代码（6 改）

| 文件                                              | 改动                                                                                                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/tools/fork/marketing/brief.ts` | 新增 pluginData 键常量 `NEW_INTENT_MODE_ID_KEY` / `NEW_INTENT_PROFILE_ID_KEY` / `NEW_INTENT_CONFIRMED_KEY`；新增 helper `readNewIntent(figma)` / `writeNewIntent(...)` / `clearNewIntent(figma)` |
| `packages/core/src/tools/fork/marketing/setup.ts` | `setupDesign` 检查 `readNewIntent().confirmed`；未确认时返回 `awaiting_new_intent_confirmation` 信封；成功时 `clearNewIntent(figma)`                                                             |
| `src/app/ai/pi-backend/active-design-host.ts`     | `newIntentConfirmed()` 改为读 pluginData；`assembleTurn` 接收 documentRoot 参数；新增 `resolveEffectiveIds`；`onDesignCreated` hook 清 pluginData                                                |
| `src/components/chat/ChatPanel.vue`               | 拦截工具结果 `awaiting_new_intent_confirmation` → 显示确认卡 + `abort(sessionId)`                                                                                                                |
| `src/components/chat/ChatNewIntentCard.vue`       | 新建——确认卡 UI；用户点确认 → POST `/api/pi/intent-confirm`；用户点取消 → POST 清除                                                                                                              |
| `src/app/ai/pi-backend/intent-confirm.ts`         | 新建——server endpoint `POST /api/pi/intent-confirm`（写 pluginData）                                                                                                                             |

#### 测试（3 改/建）

| 文件                                             | 改动                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `tests/engine/rebuild/marketing/setup.test.ts`   | 新增——`setup_design` 检查 `newIntentConfirmed` pluginData；未确认 → awaiting 信封；成功 → 清 pluginData |
| `tests/engine/rebuild/marketing/brief.test.ts`   | 新增——`readNewIntent` / `writeNewIntent` / `clearNewIntent` 三函数 round-trip 验证                      |
| `tests/engine/pi-backend/intent-confirm.test.ts` | 新建——server endpoint 写 pluginData；前端 abort 拦截 mock 测试                                          |

#### 治理（4 改/建）

| 文件                                    | 内容         |
| --------------------------------------- | ------------ |
| `docs/rebuild/tasks/T91b-plan.md`       | 新建         |
| `docs/rebuild/tasks/T91b-self-check.md` | 新建         |
| `docs/rebuild/tasks/T91b-verify.md`     | 新建         |
| `docs/rebuild/tasks/_index.md`          | 追加 T91b 行 |
| `docs/rebuild/tracker.md`               | 追加 T91b 行 |

### 验收

- 七门禁全绿（T91b 触碰文件 lint 局部）
- 引擎测试：brief / setup / pi-backend / chat 套件 0 回归；新增测试全过
- 端到端真值：
  - **场景 1**：用户选 `editable-design-full` → 确认卡 → 写 pluginData → 发消息 → `assembleTurn` 优先用 pluginData modeId → AI 按 `editable-design-full` 执行 → `setup_design` 成功后清 pluginData
  - **场景 2**：用户说"根据需求单，再创作一张" → AI 调 `setup_design` → 返 `awaiting_new_intent_confirmation` 信封 → 前端显示确认卡 + `abort(sessionId)` → 用户确认 → 写 pluginData → AI 再次调 `setup_design` → 通过

### 风险与边界

- **abort 必须 100% 可靠**——前端必须主动检测并 abort，不能依赖 LLM 遵从 prompt 指令
- **多文档隔离**——pluginData 在 document root，天然按文档隔离
- **envelope 保留为冗余确认**——不删 envelope（避免破坏现有路径），pluginData 是唯一事实源
- **setup_design 失败不清 pluginData**——下回合仍按 newIntent 装配，允许 AI 重试
- **取消意图清 pluginData**——回到 activeDesign/general 路径
- **T91a 的 `confirmedNewIntent` 参数继续保留**——作为 envelope 的兼容接口（短期）；新代码用 pluginData，老参数从 envelope 取值后写到 pluginData

### 不修

- envelope 整个机制——保留为冗余确认（短期兼容）
- activeDesignNodeId 的 round-trip（T60 已定谳）
- ask_user_question 现有 awaiting_user 流程（T83 已拍板）

### 下一步

T91b 完成后 phase 3 收口：

- review w3 批次（删除 type 蓝图过度设计）
- 预研文档 selective 优化
- push + CI 绿
