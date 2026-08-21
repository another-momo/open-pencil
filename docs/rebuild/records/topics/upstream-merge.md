<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/upstream-merge.md · upstream 合并与旧分支 WIP

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：upstream 合并记录、旧分支 WIP 审判结果、合并 SOP。

---

## 合并类

## MERGE-1 · upstream 合并演习（15bd0ba1 → 0332b062）

- **类型**：合并
- **时间**：2026-08-19 14:00
- **内容**：upstream/master 8 commits（含 AI SDK 7 升级 #555）
- **冲突**：10 文件
- **处置原则**：删除区 modify/delete 一律重删；配置类（package.json/ci.yml）以 upstream 新结构为基座重放我方修改；bun.lock 重生成
- **副作用**：发现 bun 缓存需 `rm -rf node_modules` 重装以清陈旧的依赖版本副本
- **新增补丁**：P24（notifications locale 裁剪，satisfies Record<TranslatedLocale> 类型报错触发）
- **影响**：i18n 缝避让至 src/app/i18n/fork/（因上游 #557 已占 notifications/）

## 审判 · 旧分支 WIP（已结案）

- **时间**：2026-08-19 14:00
- **审判人**：Agent W
- **范围**：git status + `3f925191` 全 hunk 通读
- **结论**：**已终结**。这批 WIP 已随旧分支 commit `3f925191`「fix(quality): clear CI quality job errors」提交并推送，14/14 文件逐一核对全部为 lint/类型等价清理，零行为变更意图。**无一需要移植、无一可上游化、无一应丢弃**——rebuild 侧要么已逐字节一致，要么本就不含被清理的模式。重建分支无需从这批 WIP 继承任何东西。

---

## 执行期遗留（Phase 0 → 后续阶段）

| 项 | 内容 | 归属阶段 |
|---|---|---|
| `acp:` provider 概念残留 | models/settings 层仍引用 `ACP_AGENTS`（core constants）；选 ACP 档案会优雅失败 | Phase 1 重分类 chat/providers 时清理 |
| `@agentclientprotocol/sdk` 依赖 | 被 `src/app/integrations/mcp/runtime.ts` + core constants 引用，未裁 | 同上 |
| LFS 自有托管 | fork GitHub LFS 预算超额（pull 被拒）；新增 LFS 文件（如普惠体）前必须解决，或走子集化进普通 git（D6 相关） | D6 决策时 |
| knip/steiger/oxlint 死配置残留 | desktop/packages-docs 等 ignore 条目保留未清（无害，零补丁纪律）；另有 knip.json `ignoreWorkspaces` 含 `packages/acp`（从未存在过的路径，上游死配置） | 可不处理 |
## 合并 · upstream/master@5201404f（T10，2026-08-21 开工）

- **类型**：合并记录（进行中）
- **时间**：2026-08-21
- **分支**：merge/upstream-2026-08-21 → rebuild/v2
- **漂移实测**（`git diff 0332b062..upstream/master`，2026-08-21）：79 commits / 864 文件（86 A / 762 M / 5 D / 11 R）；fork 点 0332b062 = 2026-08-18 23:09，上游头 5201404f = 2026-08-20 21:28——约 2 天 79 commits，上游极高活跃
- **冲突面**：
  - modify/delete **613 文件**（我方 strangler 删除 ∩ 上游修改）——机械解决，保持删除
  - 活跃补丁被上游触及 **11/31**：router / EditorView（上游已删，P2 需迁移）/ constants / ChatPanel / ChatInput / chat/transports(+61 行) / chat/use / chat/storage / package.json / tsconfig / bun.lock
  - 上游新增落进 deletedPaths **2 文件**（tests/e2e/native/settings.spec.ts、tests/engine/tauri/harness-process.test.ts）——保持删除
  - 上游删除 5 文件（含我们打补丁的 EditorView.vue）；重命名 11 个全在 packages/vue（与我方补丁零交集）
  - tests/fixtures 零漂移——无 LFS 风险
- **动因**：owner 拍板 D20（先合并后开 Phase 1）；spike 验证的缝本轮被上游触及，先合并保证 spike 证据有效
- **结果**（2026-08-21 合并解决完成，commit/CI 待 push 后补）：
  - 冲突解决：613 modify/delete 全部保持我方删除；2 个 re-add 清除；UD（EditorView.vue）接受上游删除
  - **P2 载体迁移**：上游 bb5960cd 删 EditorView.vue/StorageView.vue、新增 WorkspaceView.vue + EditorWorkspace.vue——P2 语义拆分重涂：WorkspaceView.vue（demo/useHead/SafariBanner 裁切）+ **P33** EditorWorkspace.vue（CollabPanel 裁切）
  - **chat 缝「保 harness 裁 ACP」**：上游新增 pi harness 传输路径（SP-6）——保留（packages/harness 入 workspaces，P17 注记）；ACP 维持裁除（P4-P8 语义重涂于上游重构后形态）
  - 机制补强：check.ts resolveBase 加 MERGE_HEAD 分支（CI-8），否则合并中 zone check 必误报
  - 本地验证：四检查绿（zones 基线 5201404f：30M/88A/953D）+ build:packages ✅ + lint 0 errors + vite build ✅ 19.09s；全量单测按 owner 指示交远端 CI
  - 核验：subagent A 11 通过 / 1 警告 / 0 失败（[T10-verify.md](../../tasks/T10-verify.md)）；N1 备查：ACP_AGENTS 仍存活于 settings 三文件（ProfileEditor/ProviderSelect/ModelsPanel）——与上表「acp: provider 概念残留」遗留项同根，Phase 1 重分类时清理
