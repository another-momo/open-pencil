<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T10-plan.md · T10 任务计划

> **T 编号**：T10（upstream 合并 + Phase 1 启动登记）
> **三件套**：
> - 计划：[T10-plan.md](T10-plan.md)（本文件）
> - 自检：[T10-self-check.md](T10-self-check.md)
> - 核验：[T10-verify.md](T10-verify.md)

## 1. 任务概述

### 1.1 背景与目标

2026-08-21 owner 拍板两件事（本 task 登记为 D20）：

1. **先合并 upstream 再开 Phase 1**——漂移实测（2026-08-21，`git diff 0332b062..upstream/master`）：**79 commits / 864 文件 / 约 2 天**（fork 点 0332b062 = 2026-08-18 23:09，上游头 5201404f = 2026-08-20 21:28）。漂移显著，命中 [05-process.md §3.3](../05-process.md)「漂移显著时提前合并」条款。
2. **Phase 1 双 spike 并行登记、S-pi 先行**——D9 维持 open 待 spike 证据，两个 spike 各自拉分支推进。

合并紧迫性的定量依据（2026-08-21 实测）：

- 活跃补丁 31 个，其中 **11 个被上游本轮触及**——且集中在 chat 缝（ChatPanel / ChatInput / transports +61 行 / use / storage）+ 应用壳（router / EditorView / constants）+ 构建面（package.json / tsconfig / bun.lock）
- **上游删除了 `src/views/EditorView.vue`**（P2 补丁的载体）——补丁需随上游删除迁移语义
- modify/delete 冲突面 **613 文件**（我们 strangler 删除的 951 路径中有 613 个本轮被上游修改）；另有 2 个上游新增落进 deletedPaths（tests/e2e/native/settings.spec.ts、tests/engine/tauri/harness-process.test.ts）
- spike 有效性依赖当前缝形态（S-pi-4「前端一字不变」验证直接依赖 transports/ChatPanel 现状）——对过期缝做 spike 会产生带保质期的证据

### 1.2 范围

- A 组合并执行：专用分支 `merge/upstream-2026-08-21`；`git merge --no-commit upstream/master`（5201404f）；冲突解决（613 机械删 + 11 补丁语义重涂 + 2 re-add 清除 + bun.lock 重建）
- B 组 registry 刷新：zones.json patches 注记重涂基线；ownedRoots += `spikes/`（spike 代码落点预备）；merge-base 前移后四检查复跑
- C 组 Phase 1 启动登记：D20 决策登记（agent-runtime.md）；[03-phase-1-runtime.md §5.3](../03-phase-1-runtime.md) 启动条件修订 + §5.2 pi stars 补测（`gh api repos/earendil-works/pi` = 94,558 / 11,699 / 134，2026-08-21）；tracker/_index 加 T10/T11/T12 行；T11/T12 plan 建档；[records/topics/upstream-merge.md](../records/topics/upstream-merge.md) 合并记录
- D 组验证：本地四检查 + 构建/测试冒烟 + 远端 CI 全绿 + subagent 独立核验
- E 组收尾：合并回 rebuild/v2 + push + 创建 spike/s-pi、spike/s-x 分支

### 1.3 不在范围

- S-pi / S-X spike 的实际执行（T11 / T12）
- D9 选型拍板（owner 专属，spike 后）
- 613 个删除立场的重新评估（strangler 删除决策不因上游修改而自动翻转；逐个重评是独立任务）

### 1.4 冲突解决原则

1. **modify/delete（613）**：保持我方删除（strangler 立场不变），`git rm` 机械解决
2. **deletedPaths 内上游新增（2）**：保持删除，`git rm`（deletedPaths 不变式：这些路径不许存在）
3. **补丁文件（11）**：语义重涂——上游新内容 + 我方裁剪语义重新施加；P2（EditorView.vue 被上游删除）需找到上游新载体文件并重涂，若裁剪对象已随上游重构消失则补丁标记 moot 并登记
4. **bun.lock（P23）**：取上游版 + package.json 解决后 `bun install` 重建（机械）

## 2. 任务清单

- [ ] A1 建分支 merge/upstream-2026-08-21；merge --no-commit upstream/master（5201404f）
- [ ] A2 613 modify/delete 机械解决（保持删除）
- [ ] A3 2 个 deletedPaths 内 re-add 清除
- [ ] A4 11 补丁文件语义重涂（P1-P8、P17、P18；P2 含载体迁移判断）
- [ ] A5 bun.lock 重建 + `bun install` 通过
- [ ] B1 zones.json 注记刷新（重涂基线 5201404f）+ ownedRoots += `spikes/`
- [ ] B2 四检查本地绿（zones 新 merge-base / docs / bindings / tasks）
- [ ] B3 构建 + 定向测试冒烟（build 或 engine 测试快集）
- [ ] C1 D20 登记（agent-runtime.md）
- [ ] C2 03 §5.3 修订 + §5.2 pi stars 补测
- [ ] C3 tracker/_index 三行 + T11/T12 plan 建档
- [ ] C4 upstream-merge.md 合并记录 + narrative 绑定（03/tracker）
- [ ] D1 远端 CI 全绿（12/12 含 Rebuild discipline）
- [ ] D2 本自检 + subagent 核验
- [ ] E1 合并回 rebuild/v2 + push + spike/s-pi、spike/s-x 分支创建并 push

## 3. 验收标准

- 【事实】`git merge-base HEAD upstream/master` = 5201404f（合并完成）
- 【事实】613 个 modify/delete 全部保持我方删除；2 个 re-add 不存在于工作树
- 【事实】11 个补丁语义逐一重涂并有核验记录（P2 迁移目标在 verify 中明示）
- 【事实】`bun run check:zones` clean（新 merge-base 下 0 违规）
- 【事实】check:docs / check:bindings / check:tasks 本地全绿
- 【事实】远端 CI 12/12 绿（merge 分支 + rebuild/v2 各一次）
- 【事实】D20 / §5.3 / 任务表三行 / upstream-merge.md 记录全部落盘

## 4. 关联文档

- 过程定义：[05-process.md §3.3 upstream 合并](../05-process.md)
- 漂移与冲突面实测：[records/topics/upstream-merge.md](../records/topics/upstream-merge.md)
- 决策登记：[records/topics/agent-runtime.md D20](../records/topics/agent-runtime.md)
- 后续 task：[T11-plan.md](T11-plan.md)（S-pi spike）/ [T12-plan.md](T12-plan.md)（S-X spike）

## 5. 身份

本文件是 T10 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T10-self-check.md](T10-self-check.md) / [T10-verify.md](T10-verify.md)。
