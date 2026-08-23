<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T18-plan.md · T18 任务计划

> **T 编号**：T18（Phase 1-pi 启动 · pi SDK 主线：分支 + 版本钉扎 + S-pi 模型面补跑）
> **分支**：`rebuild/pi`（从 rebuild/v2 HEAD `138553c5` 起，2026-08-23；D24 拍板）
> **状态**：🔄 开工（注册期 recon 已完成，见 [T18-self-check §2.1](T18-self-check.md)）
> **三件套**：
> - 计划：[T18-plan.md](T18-plan.md)（本文件）
> - 自检：[T18-self-check.md](T18-self-check.md)（开工后持续回填）
> - 核验：[T18-verify.md](T18-verify.md)（收口时 subagent 填报）

## 1. 任务概述

### 1.1 背景与目标

D24（2026-08-23 owner 拍板，[records/topics/agent-runtime.md](../records/topics/agent-runtime.md)）：dsh-X 主线于 T17 收口态搁置归档，pi SDK 路线（直用库形态，D21 口径——harness 抽象不占 runtime 路径）升为主线。本任务是 pi 线第一个任务，做四件事：分支落地、pi 版本钉扎纪律成文、S-pi spike 的活模型面补跑（T11 时阻塞在无 key，现 owner 已配 openrouter key）、01 目标态 F0 表地面依据的 post-merge 核查修正。

S-pi 离线面证据（SP-7，T11 核验讫）已在仓 `spikes/s-pi/`：库形态装配、自定义工具执行、session 持久化/树分叉、事件映射表全部离线实证（pi 0.84.2）。本任务补的是当时唯一缺口：**活模型面**。

### 1.2 关键决策（本 task 内拍板，理由随附）

1. **pi 钉 0.84.2**——三重依据重合：T11 全部离线证据基线（SP-7）、npm 最新版即 0.84.2（`npm view @earendil-works/pi-coding-agent version`，2026-08-23）、spikes/s-pi/package.json 已精确锁定。周更风险用升级窗口纪律管理（照 03 §5.4 dsh 模板）
2. **活模型 = openrouter/free**——owner 已配置的 key（dsh 线 T13 X3/X6 实证同 key 可用）；pi-ai 内置 openrouter provider（baseUrl `https://openrouter.ai/api/v1`，`pi-ai/src/providers/openrouter.ts:11`，2026-08-23 读源码），`OPENROUTER_API_KEY` 为官方 env 约定（`pi-ai/src/env-api-keys.ts:94`）；`openrouter/free` 非内置目录模型，走 models.json 覆盖/自定义（`pi/packages/coding-agent/docs/models.md` §Overriding Built-in Providers，2026-08-23 读文档）
3. **通道 A 视觉探测不在本任务**——spike 02 §6 定义为时间盒备选、不阻塞选型；需视觉模型 key 决策，留后续任务（如实声明）
4. **01 F0 核查范围限三行**：F0.2（桥/后端）、F0.4（传输契约+chat UI）、F0.7（prompts 构建链）——T10 合并后实测发现 `packages/agent`、`http-agent-transport.ts`、`agent-vite-plugin.ts` 均已消失（2026-08-23 `ls`/`find` 实证），地面依据列腐烂，本任务修正；其余行不动
5. **key 不进仓**——live 脚本从环境变量 `OPENROUTER_API_KEY` 读 key，缺失即显式报错退出；执行时从 dsh-home settings.yaml（owner 已配）临时注入环境变量，不打印、不提交

### 1.3 非目标（明确划掉）

- 后端换心 / 前端改造（pi 线 T19+；harness 为参照材料非 runtime 路径，D21）
- 通道 A 视觉探测（见 §1.2-3）
- 工具审批 extension、skills 落地（层 2 B1b；skills 在 pi 为内置零代码，D24 补注）
- dsh 线任何资产改动（workbench/ 休眠保留）

## 2. 验收清单（收口时逐项核验）

| # | 验收项 | 通过标准 |
|---|---|---|
| A1 | 分支 | `rebuild/pi` 从 rebuild/v2 HEAD 起并已推送远端 |
| A2 | pi 钉扎纪律 | 03 新增钉扎小节（pin 0.84.2 + 升级窗口 + 升级流程），narrative 同步 |
| A3 | S-pi-1 活模型 | `spikes/s-pi/live-chat.mjs` 真实跑通：openrouter/free 流式回复全文连贯、事件序列完整、退出码 0 |
| A4 | S-pi-2 主线活模型 | `spikes/s-pi/live-tool-result.mjs` 真实跑通：真实模型调用自定义文本工具、工具在本进程执行、模型回复引用工具返回的标记串、退出码 0 |
| A5 | 01 F0 修正 | F0.2/F0.4/F0.7 地面依据列反映 post-merge 实况，narrative 同步 |
| A6 | CI | 远端 CI 对 rebuild/pi HEAD 全绿 |

## 3. 执行面（P1-P4）

- **P1 分支+钉扎**：分支已建（注册时）；03 新增 §5.5「pi 版本钉扎与升级窗口」（pin 0.84.2；双周评估窗口首窗 2026-09-05 所在周；升级=独立 commit+重跑 `spikes/s-pi` 全部证据脚本含本任务新增 live 脚本）
- **P2 S-pi-1 活模型**：`spikes/s-pi/live-chat.mjs`——ModelRuntime + openrouter/free → `session.prompt` → 订阅事件流验证 text delta 序列 → 完整回复落盘断言
- **P3 S-pi-2 活模型**：`spikes/s-pi/live-tool-result.mjs`——`defineTool` 注册文本工具（返回含唯一标记串的场景摘要，模拟 look 通道 B 结构）→ 显式参数指令驱动模型调用 → 断言 tool_execution 成对事件 + 工具进程内执行日志 + 模型后续回复含标记串
- **P4 01 F0 修正**：F0.2/F0.4/F0.7 三行地面依据列就地重写为 post-merge 实况（附 2026-08-23 核验命令），narrative 记录

总计 ~1-1.5 人日。

## 4. 风险与回退

| 风险 | 应对 |
|---|---|
| openrouter/free 工具调用纪律差（dsh 线实测：需显式参数指令，T17 冒烟遇过丢参数） | live 脚本用显式指令模板；模型丢参数时重试并如实记录负例，不伪造通过 |
| openrouter/free 非 pi-ai 内置目录模型，配置面有未知量 | models.json 覆盖路径已有官方文档；若受阻如实上报，不降级到伪造 |
| key 泄漏 | 环境变量注入、脚本不打印、.gitignore/扫描既有门禁（gitleaks CI）兜底 |
