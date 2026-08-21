<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T11-plan.md · T11 任务计划

> **T 编号**：T11（S-pi spike 执行 · pi sdk 路线实证）
> **分支**：`spike/s-pi`（自 T10 合并后的 rebuild/v2 拉出）
> **三件套**：
> - 计划：[T11-plan.md](T11-plan.md)（本文件）
> - 自检：[T11-self-check.md](T11-self-check.md)（开工后填）
> - 核验：[T11-verify.md](T11-verify.md)（核验时填）

## 1. 任务概述

### 1.1 背景与目标

D9 当前推荐 c（pi 直接驱动，库形态）。本 task 按 [spikes/02-pi-sdk-runtime.zh.md §6](../spikes/02-pi-sdk-runtime.zh.md)（D2 修正后口径）+ [spikes/05-upstream-harness.zh.md §6](../spikes/05-upstream-harness.zh.md) 的 S-pi 验证清单实证该路线，总预算约 3.5-4.5 人日。**spike 走通后即可供 owner 定 D9 = pi**。D21（2026-08-21，owner 拍板）：harness 路线暂时搁置，S-pi 按**直用 pi SDK** 形态执行；上游 harness 实现仅作走读参照（spike 05）。

排序理由（2026-08-21 主 agent 建议、owner 拍板双 spike 并行）：两条 spike 等成本（4.5 vs 3.5-4.5 人日），但 S-pi 具备早期退出价值——pi 全量落地 ≈20 人日（X 路线 37-38）且 D9 记录推 1，S-pi 全过则 S-X 可能整体省掉；S-pi-1 纯库验证零编辑器环境依赖；原「最大风险点 S-pi-2 多模态」论断已随 D2 修正撤销（通道 B 主线下主模型 text-only 原生兼容）。

### 1.2 范围（S-pi 四项验证，按序）

| # | 验证项 | 预算 | 通过标准 |
|---|---|---|---|
| S-pi-1 | 库形态最小集成（直用 SDK）：Node 后端 import `@earendil-works/pi-coding-agent`（0.84.2），defineTool/customTools 注册 echo 工具，in-memory session，事件流订阅 | 1-1.5d | 库形态集成过 + 工具 execute 在我们进程内执行过 + 事件流正确 |
| S-pi-2 | **主线（look 通道 B pi 侧）**：自定义工具返回纯文本/结构化 tool-result（模拟 look 的场景摘要文本），agent 正确消费并续跑——DeepSeek text-only 原生兼容、无降级路径（与 S-pi-1 同构，增量为真实返回结构端到端一次）；**备选探测（通道 A，时间盒，需视觉模型 key，不阻塞选型）**：ImageContent 工具 + 视觉 route 验证 image_url dataURL 接受度 + deepseek-chat 占位降级运行时形态（机制已由 `transform-messages.ts:35-57` 源码证实，只验端到端不炸、任务可续）；前置：离线查 `models.generated.ts` DeepSeek 条目 input 字段（spikes/02 §9-1） | 0.5d | 主线：文本 tool-result 被正确消费、任务续跑；A 探测：模型回复含图像描述（非占位）+ DeepSeek 路径不报错可续 |
| S-pi-3 | session 持久化 + F0.5：直用 `SessionManager` create → dispose → open 跨重启上下文恢复；吸收上游 harness 教训（destroy 删状态、stop 才持久化——spikes/05 §1），显式设计 stop 时机 | 0.5-1d | 跨重启 session 上下文完整恢复 |
| S-pi-4 | 流式适配增量：agent event 流 → UIMessage v1 chunk（**参照上游产线实现走读**：`packages/harness/src/backends/pi.ts:62-89` mapPart + `src/app/ai/harness/transport.ts:28-62` mapEvent，合计约 120 行）→ SSE endpoint → 前端旧 Chat 类消费 | 0.5-1d | 前端一字不变能消费新 runtime 流（除适配器） |

### 1.3 实施约束

- **代码落点**：`spikes/s-pi/`（T10 已登记 ownedRoot `spikes/`）；自含 package.json（**不进 root workspaces**——workspaces 为 packages/* 显式列表，2026-08-21 实测），不触碰任何上游文件
- **包名纪律**：`@earendil-works/pi-coding-agent`（scoped，0.84.2，与本地 `参考项目/pi` 源码一致）；**非** unscoped `pi-coding-agent`（0.0.1，description 自述 "Placeholder package name reservation" 的占位包，勿用——2026-08-21 `npm view pi-coding-agent` / `npm view @earendil-works/pi-coding-agent version` 双端实测）
- **API key**：当前执行环境无 ANTHROPIC/DEEPSEEK/OPENAI key（2026-08-21 `printenv` 实测 0 命中）——离线可验项（安装/导入/API 面/序列化/事件订阅接线）先行，活模型调用项阻塞即上报 owner 补 key，不伪造通过

### 1.4 不在范围

- D9 拍板（owner）；S-X spike（T12）；层 1 全量落地（spike 通过后的独立 task）

## 2. 任务清单

- [ ] P1 脚手架：spikes/s-pi/ + 自含 package.json + 安装固定版本（含 spikes/02 R-pi-8 钦定必测：Windows npm install 实测 photon-node WAS / 是否需 `--ignore-scripts`）
- [ ] P2 S-pi-1 离线面 + 活模型面（echo → prompt → tool call → 事件流）
- [ ] P3 S-pi-2 通道 B 主线（文本 tool-result 消费续跑）+ 通道 A 时间盒探测（有视觉 key 才做）
- [ ] P4 S-pi-3 持久化跨重启恢复（含 stop 时机设计）
- [ ] P5 S-pi-4 流式适配（走读上游 mapPart/mapEvent + SSE 段 + 旧 Chat 类消费验证）
- [ ] P6 self-check + subagent 核验 + verify 回填
- [ ] P7 记录登记（agent-runtime.md spike 结果条目）+ 任务表状态更新

## 3. 验收标准

- 【事实】S-pi-1~4 各自通过标准达成（或失败项有实测证据 + 回退分析）
- 【事实】全程未修改上游文件（check:zones 在 spike 分支 clean，merge-base = T10 合并点）
- 【事实】T11 三件套齐（核验 subagent 实做，无占位）
- 【假设】API key 由 owner 提供后活模型项方可完成——若 key 缺席，T11 以「离线面全过 + 活模型面阻塞证据」状态汇报，不标 ✅

## 4. 关联文档

- 验证清单真源：[spikes/02-pi-sdk-runtime.zh.md §6](../spikes/02-pi-sdk-runtime.zh.md)（D2 修正版）+ [spikes/05-upstream-harness.zh.md](../spikes/05-upstream-harness.zh.md)（上游 harness 走读参照，§6 调整清单）
- 决策背景：[records/topics/agent-runtime.md D9 / D20 / D21](../records/topics/agent-runtime.md)（D21：harness 路线搁置，直用 pi SDK）
- 对照 task：[T12-plan.md](T12-plan.md)（S-X spike）

## 5. 身份

本文件是 T11 的 task 计划（plan），按 [05-process.md §4.11 D15](../05-process.md) 三件套物理拆分纪律，自检与核验分别在 [T11-self-check.md](T11-self-check.md) / [T11-verify.md](T11-verify.md)（开工后创建）。
