<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T13-plan.md · T13 任务计划

> **T 编号**：T13（Phase 1-X 收口 · D22 拍板后）
> **分支**：`rebuild/v2`（文档/纪律类工作直接落主线）
> **三件套**：
> - 计划：[T13-plan.md](T13-plan.md)（本文件）
> - 自检：[T13-self-check.md](T13-self-check.md)（开工后填）
> - 核验：[T13-verify.md](T13-verify.md)（核验时填）

## 1. 任务概述

### 1.1 背景与目标

owner 于 2026-08-22 拍板 D22：D9 = a（dsh 插件路线）为当前主线，pi SDK 产品版后置（[records/topics/agent-runtime.md D22](../records/topics/agent-runtime.md)）。本 task 做拍板后的三件事收口：

1. **双 spike 分支合并回归 rebuild/v2**——T11/T12 三件套与 SP-7/SP-8 证据落主线。这同时是 D22 登记 commit（29d560be）所致 CI 红（run 32562039785，check-tasks 引用 T12 但主线无 T12 三件套）的根修
2. **dsh 版本钉扎 + 双周升级窗口纪律成文**——dsh 是 preview（实测 11 天 10 个 rc，见自检 §2.2），主线必须钉版本 + 制度化升级节奏，落入 [03-phase-1-runtime.md §5.4](../03-phase-1-runtime.md)
3. **S-X 模型面补跑**（X3 模型自主调 `openpencil_apply_design` / X6 模型回复体现 type 变化）——按 D22 留在主线，**阻塞解除条件 = owner 补 DeepSeek API key**；阻塞即上报，不伪造通过

### 1.2 时序披露（如实）

第 1 件（合并回归）**已先于本计划登记执行**：2026-08-22，merge commits 694f4a29（spike/s-x）+ 918b048c（spike/s-pi），CI run 32563228158 全绿（含 Rebuild discipline）。原因：该合并是 CI 红修复不可拆的一半（D22 commit 的 `task: T12` 引用需要 T12 三件套在主线存在）。附带一处工具修复随 694f4a29 入库：`check:zones` 的 checkModified 豁免 ownedRoots（合并自有分支时，ownedRoots 下文件的冲突解决不是上游补丁，原规则误伤；机制与验证见自检 §2.3）。

### 1.3 不在范围

- T14+ 实施工作（插件骨架产品化起，见路线图）
- pi SDK 产品版任何工作（D22 后置；SP-7 证据已归档可直接复用）
- S-pi 模型面补跑（随 pi 产品版后置，不在主线补）

## 2. 任务清单

- [x] 双 spike 合并回归 rebuild/v2 + CI 转绿（694f4a29 / 918b048c / run 32563228158）
- [x] zone-checker ownedRoots 豁免修复（随 694f4a29）
- [x] dsh 版本钉扎 + 双周升级窗口写入 03-phase-1-runtime.md §5.4
- [ ] S-X 模型面补跑（X3 模型调工具 / X6 模型回复）——**阻塞：待 owner 补 DeepSeek key**
- [x] self-check + subagent 核验 + 记录登记

## 3. 验收标准

- 【事实】rebuild/v2 主线含 T11/T12 三件套 + SP-7/SP-8，CI 全绿（核验命令：`git log --oneline -3 origin/rebuild/v2`、`gh run list -R another-momo/open-pencil --branch rebuild/v2`）
- 【事实】03 §5.4 成文，版本事实附核验命令 + 日期（npm view dist-tags / time，sandbox 安装版本）
- 【事实】模型面阻塞如实列入自检 §3，无伪造通过
- 【事实】T13 三件套齐（核验 subagent 实做，无占位）

## 4. 关联文档

- 拍板依据：[records/topics/agent-runtime.md D22](../records/topics/agent-runtime.md)（SP-7 / SP-8 为证据基础）
- 版本纪律落点：[03-phase-1-runtime.md §5.4](../03-phase-1-runtime.md)
- X 路线设计：[spikes/04-dsh-x-design.zh.md](../spikes/04-dsh-x-design.zh.md)（§6.1 preview 颠簸面）

## 5. 身份

本文件是 T13 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T13-self-check.md](T13-self-check.md) / [T13-verify.md](T13-verify.md)（开工后创建）。
