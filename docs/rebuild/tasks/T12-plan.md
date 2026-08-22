<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T12-plan.md · T12 任务计划

> **T 编号**：T12（S-X spike 执行 · dsh-X 路线实证）
> **分支**：`spike/s-x`（自 T10 合并后的 rebuild/v2 拉出）
> **三件套**：
> - 计划：[T12-plan.md](T12-plan.md)（本文件）
> - 自检：[T12-self-check.md](T12-self-check.md)（开工后填）
> - 核验：[T12-verify.md](T12-verify.md)（核验时填）

## 1. 任务概述

### 1.1 背景与目标

dsh-X 路线（编辑器作 dsh bundle 挂上 shell.overlay）按 [spikes/04-dsh-x-design.zh.md §7.1](../spikes/04-dsh-x-design.zh.md) 的 S-X 六项验证清单（4.5 人日）实证。**第 5 项（shell.overlay 切 session 不卸载）是 X 路线硬性 gate——挂了就回到其他路径**。

排序：S-pi（T11）先行、S-X 次之（2026-08-21 主 agent 建议）：S-pi 全过则 owner 可能直接拍 D9=pi，本 task 可整体省掉；若 S-pi 失败或 owner 仍需对比证据，本 task 启动。两项 spike 并行登记、分支已备，实际投入按需触发。

### 1.2 范围（S-X 六项验证）

| # | 验证项 | 通过标准 | 失败回退 |
|---|---|---|---|
| 1 | shell.overlay 渲染 React + Vue 整块 island | 双框架无错误 | 接管 conversation slot |
| 2 | 7600 WS RPC ping/pong 1h 稳定 | < 1 disconnect | 加 reconnect |
| 3 | `openpencil_apply_design` 端到端 SceneGraph 改图 | diff < 50ms | 退回只读 |
| 4 | preset `openpencil-design` install 一次成功 | 全部 assets 加载 | 降级核心 3 项 |
| 5 | **shell.overlay 切 session 不卸载**（硬 gate） | 切 5 次 session，island DOM 与 Vue instance 不重建；编辑画布在 session 切换后仍可访问 | 退回 split slot 或放弃 shell.overlay |
| 6 | systemPrompt.section 注入营销选择项生效 | 切换 type 字段后，模型下一次回复正确响应变化 | 退化到 message body 注入 |

### 1.3 实施约束

- **代码落点**：`spikes/s-x/`（T10 已登记 ownedRoot `spikes/`）；编辑器侧改动如需触碰上游文件，必须逐文件登记 zones.json 补丁（禁止未登记修改）
- **注意 T10 合并影响**：上游本轮改了应用壳（router/EditorView 删除等），S-X 的 shell.overlay 验证必须基于 T10 合并后的新代码形态
- dsh host 环境准备（安装/版本 pin）是第 0 步，版本与证据记入 self-check

### 1.4 不在范围

- D9 拍板（owner）；X 路线全量落地（≈37-38 人日，spike 通过后独立 task）

## 2. 任务清单

- [x] X0 dsh host 环境 + 版本 pin 记录
- [x] X1 shell.overlay 双框架 island
- [x] X2 7600 WS RPC 稳定性（1h）
- [x] X3 openpencil_apply_design 端到端
- [x] X4 preset install
- [x] X5 **硬 gate：切 session 不卸载**（gate 通过）
- [x] X6 systemPrompt.section 注入（装配面）
- [x] X7 self-check + subagent 核验 + 记录登记

## 3. 验收标准

- 【事实】六项各自通过/失败有实测证据；第 5 项结论必须二选一明确（gate 过 / 不过）
- 【事实】任何上游文件修改均有 zones.json 补丁登记（check:zones clean）
- 【事实】T12 三件套齐（核验 subagent 实做，无占位）

## 4. 关联文档

- 验证清单真源：[spikes/04-dsh-x-design.zh.md §7.1](../spikes/04-dsh-x-design.zh.md)
- weshop 实证：[spikes/03-weshop-case-deep-dive.zh.md](../spikes/03-weshop-case-deep-dive.zh.md)
- 决策背景：[records/topics/agent-runtime.md D9 / D20](../records/topics/agent-runtime.md)

## 5. 身份

本文件是 T12 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T12-self-check.md](T12-self-check.md) / [T12-verify.md](T12-verify.md)（开工后创建）。
