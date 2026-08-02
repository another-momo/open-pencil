# l1-image-gen-history (历史)

> **来源**：从 `../architecture/l1-image-gen.md` 切出的实施/时间线/误诊记录。
> 本文件按"只追加"原则归档；新讨论请开新 §。
> 当前正确设计见 `../architecture/l1-image-gen.md`。

## 验证与测试

1. **单元测试**（`tests/engine/tools/image-gen/`，沿用现有 tools 测试布局）：
   - `normalizeDimensions`：移植 playground 的用例 + 本文"效果验证"表的全部输入（含 400x3000 → 480x1408 这类连锁约束用例）
   - `parseImageGenRequests`：`references` 形态（string / `{id,asImage:true}`）的解析与报错
   - 提取失败规则：prompt 无标记部分失败 → note；全部失败 → 报错；prompt 含 `[image N]` 标记 + 任何失败 → 报错
   - 解耦语义：`id` 有 IMAGE fill 但 references 为空 → images 为空走 generations（替换语义，不收集目标节点图片）
2. **联调验证**：dmxapi 多图 `image[]` 已在 gpt_image_playground 实测通过；落地后仍需在 app 内跑一遍场景验证表的 7 个场景（重点：编辑含目标自身、替换不带旧图、`asImage: true` 渲染参考）。
3. **文档**：更新 `CHANGELOG.md`（Unreleased）；tool description 与两个 system prompt 的更新见 P2。

## 回滚方案

核心改动集中在 `packages/core/src/tools/image-gen/` 内；`asImage: true` 渲染复用已有的 `figma.exportImage` 可选能力，无新增环境依赖。回滚 = git revert 相关 commit。

## 评审后续修正（2026-07-29，见 `docs/review/2026-07-29-l1-image-gen-optimize-review.md`）

P0/P1/P2 全部落地后经评审 + 二次走查确认的发布前修正批次，均已逐条对照代码核实：

### 命名修正：`export: true` → `asImage: true`

`export` 与 `export_image` 工具"导出到文件"的语义冲突，agent 容易误联想；`asImage` 读作"把这个节点当作图片用"。纯字段名改写，零逻辑变更、零数据迁移（参数仅存在于 prompt 串，无持久化历史调用）。涉及 `providers.ts`（`ImageGenReference.asImage`）、`apply.ts`、`requests.ts`（解析 + 报错文案）、`image-gen.ts` tool description、`system-prompt-marketing.md`、测试 fixture，本文档已同步改写。

### prompt 触发引导（agent 知道怎么写、不知道什么时候写）

1. **marketing reference section**：在 "Reference-guided generation" 示例后补"非 IMAGE 节点"段——引用 Frame/排版组合时必须 `asImage: true`，否则提取失败。
2. **Phase 3 工作流**：步骤 1 前补触发条件——placeholder 是 Frame 且生成背景时，若用户未说"忽略现有排版"，应把 hero Frame 以 `asImage: true` 作为参考传给 API。
3. **tool-level 错误 hint**：`apply.ts` 全失败分支区分"节点不存在"与"节点无 IMAGE fill"，后者报错信息直接提示改用 `{"id":"<id>","asImage":true}`——对 UI / marketing / MCP / CLI 四种模式同时生效，不依赖 prompt 措辞。
4. **顺带修复**：`system-prompt-marketing.md` §Stock Photos "NOT to Frames with children" 与 37f434fc 放开的 Frame 背景填充行为（及同文件 Phase 3 步骤 1、`stock-photo.ts` 工具描述）矛盾，同步改为一致口径。

### 代码与测试补全

- `apply.ts` 尺寸继承改为不可变：构造 `finalReq` 传给 provider，不再 mutate 入参 `req`。
- 补三类单测：`apiErrorMessage` FetchError 解析（stub fetch 返回错误 body 端到端覆盖）、`withCompression` FormData/JSON 两路径、edits 端点 FormData 字段名 `image[]`（dmxapi 对 `image` 字段会拒，防未来重构改坏）。
- `00-overview.md` §3.1 补"Frame 填充为背景时保留 children"的行为描述。

### 暂不处理（评审列为低优/可选）

- timeout 第 4 参的 UI 入口与持久化（默认 120s 已覆盖绝大多数场景，需要时再加设置项）。
- 批次内 reference → 同批输出节点的运行时显式检测（当前降级路径已优雅：提取失败 → 按三规则报错，不静默错位）。
