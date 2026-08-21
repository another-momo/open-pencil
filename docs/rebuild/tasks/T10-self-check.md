<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T10-self-check.md · T10 自检报告

> **T 编号**：T10（upstream 合并 + Phase 1 启动登记）
> **自检时间**：2026-08-21

## 1. 主 agent 任务清单对照（针对 [T10-plan.md §2](T10-plan.md)）

### A 组 · 合并执行

- [x] A1 分支 `merge/upstream-2026-08-21`；`git merge --no-commit upstream/master`（5201404f）——冲突面实测：613 DU / 7 UU / 1 UD / 155 M 净合 / 86 A / 11 R
- [x] A2 613 modify/delete 全部保持我方删除（`git rm` 批量，0 残留，`git status` 无 DU）
- [x] A3 2 个 deletedPaths 内 re-add（tests/e2e/native/settings.spec.ts、tests/engine/tauri/harness-process.test.ts）`git rm -f` 清除
- [x] A4 补丁语义重涂：
  - P1 router.ts：/demo + /share/:roomId 裁切重涂于上游 WorkspaceView 路由新形态（/storage 变 redirect 保留）
  - **P2 载体迁移**：上游 bb5960cd 删除 EditorView.vue/StorageView.vue、新增 WorkspaceView.vue + EditorWorkspace.vue——demo/useHead/SafariBanner 裁切重涂于 WorkspaceView.vue，CollabPanel 裁切拆分为 P33（EditorWorkspace.vue）
  - P3 constants.ts / P4 ChatPanel.vue / P18 tsconfig.json：自动合并后语义复核（ACP/demo/docs 引用零残留，grep 实测）
  - **P5-P8 chat 缝重涂**：上游新增第三条传输路径 HarnessChatTransport（pi adapter）——**保 harness 裁 ACP**（createACPTransport/createActiveACPTransport/isACPProvider 移除；harness 路径全保留），providerID  Plumbing 因 ACP 移除后无人消费而一并拆除
  - P17 package.json：workspaces += packages/harness（不含 docs/tools-docs）；lint/format 路径加 harness；不复活 tauri 脚本
- [x] A5 bun.lock 取上游版 + `bun install` 重建（418 packages installed，2026-08-21）

### B 组 · registry 与检查

- [x] B1 zones.json：P2 载体改 WorkspaceView.vue + P33 新增（EditorWorkspace.vue）+ P6/P17 注记；ownedRoots += `spikes/`（预备）
- [x] B2 四检查本地绿——**机制修正先行**（CI-8）：check.ts resolveBase 增加 MERGE_HEAD 分支，否则合并中 zone check 必误报；实测 `clean: 30 modified / 88 added / 953 deleted, base 5201404f`；check:docs 36/36；bindings 绿；tasks 绿
- [x] B3 冒烟：`bun run build:packages` 全绿（含新 @open-pencil/harness 构建）；`bun run lint` 0 errors（61 err 初报系陈旧 dist 假象，重编译后收敛；剩 3 函数长度警告非阻塞）；`bunx vite build` ✅ 19.09s。**全量单测按 owner 指示交远端 CI**（本地曾见 cli.test.ts「reparent node into frame」1 例 fail，运行被打断未完成全量——待 CI 判定，若红则回查合并解决）

### C 组 · Phase 1 启动登记

- [x] C1 D20 登记（agent-runtime.md：合并先行 + 双 spike S-pi 先 + D9 待证据）+ **SP-6**（上游 pi harness 产品化实证，D9 重大参照）
- [x] C2 03 §5.3 启动条件修订 + §5.2 pi stars 补测（94,558/11,699/134）
- [x] C3 tracker/_index 加 T10/T11/T12 行 + T11/T12 plan 建档
- [x] C4 upstream-merge.md 合并记录 + narrative 绑定（03/tracker）

### D 组 · 验证

- [ ] D1 远端 CI 全绿（push 后实测，含全量引擎测试——本地未跑全量）
- [x] D2 本自检；subagent 核验 → [T10-verify.md](T10-verify.md)（commit 前完成）

### E 组 · 收尾

- [ ] E1 合并回 rebuild/v2 + push + 创建 spike/s-pi、spike/s-x（CI 绿后执行）

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 |
|---|---|---|
| 613 MD 机械解 | ✅ 0 残留 | 无 |
| 11 补丁语义重涂 | ✅（P2 拆分为 P2+P33；chat 缝 4 文件按「保 harness 裁 ACP」重涂） | 方案外决策：保 harness——理由与证据登记 SP-6/D20 语境 |
| bun.lock 重建 | ✅ | 无 |
| 四检查绿 | ✅（前置修正 check.ts MERGE_HEAD 基线，CI-8） | 机制补强一处 |
| 构建/测试冒烟 | 构建+lint ✅；全量单测交 CI（owner 指示：本地太慢） | cli.test.ts 1 例本地 fail 待 CI 判定 |
| 登记（D20/§5.3/任务表/合并记录） | ✅ | 无 |
| 远端 CI + 合回 + spike 分支 | 待 push 后执行 | 时序项 |

## 3. 完成度自评

- 完全落地 14 条；待 push 后补 2 条（D1/E1，时序项非缺口）；完全未做 0 条

## 4. 自评要点

1. **最大决策点**：chat 缝「保 harness 裁 ACP」——上游本轮把 agent 面做成 pi harness（SP-6），裁掉它意味着此后每次合并都在 transports/use/storage/ChatInput 上重冲突；保留则零边际成本且为 S-pi 提供在产参照。ACP 维持裁除（死面，与产品方向无关）
2. **P2 迁移**是本次唯一的补丁载体消失案例：上游重构删除了被补丁文件，语义按构造清单重涂于两个新载体（WorkspaceView + EditorWorkspace），registry 同步拆分 P2/P33
3. **机制补强**：check.ts MERGE_HEAD 基线（CI-8）——没有它合并 commit 过不了自家 pre-commit
4. **诚实项**：全量单测未本地跑（owner 指示交远端 CI）；cli.test.ts 那例 fail 可能是上游行为变更、也可能是我解决引入——CI 红则回查

## 5. 决策影响

- D20 登记；SP-6 为 D9 提供新证据（pi 在产实证）；CI-8 机制修正登记
- T11（S-pi）在本合并落地后即可开工——spike/s-pi 分支自新 HEAD 拉出
