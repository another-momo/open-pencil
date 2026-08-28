<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T38 计划 · 三症状回归修复（fork i18n Ref 类型谎报 + dev 桥 discovery 断链）

> **状态**：进行中 | **时间**：2026-08-28 | **负责人**：主 agent
> **分支**：`rebuild/t35-i18n-fork`（pi 线）
> **基线**：`aabacb0a`（T37 收口后 HEAD）

## 1. 背景与立项

2026-08-28 owner 报告 dev 环境三症状：① 输入框下模型名不显示；② 调用工具报「工具桥没连上」；③ 设置面板 thinking level 全空白。主 agent 当日实测诊断（浏览器控制台 + 进程/discovery 文件取证 + git 考古），根因全部定位：

### 根因 A（症状①③，同源）：T35 引入的 Ref 类型谎报

`useForkPi()`（src/app/i18n/fork/index.ts:36-39）返回 `useStore()` 的 **Ref**，却用 `as any as PiNamespace` 谎称已解包。模板插值因 Vue 顶层 ref 自动解包**正常**；script 内经 computed/函数中转的访问全部读到 Ref 对象上不存在的属性 → `undefined` → 空白：

- ChatInput.vue:42 `piModelLabel` computed（症状①）
- PiModelsPanel.vue:56-63 `thinkingLabel()`（症状③）

实证（2026-08-28，playwright 开 localhost:1420）：store 值齐全（`designModelDefault: "后端默认（openrouter/free）"`），渲染 span 为空字符串。T35 前代码是 `dialogs.value.piDesignModelDefault`（39ce06a8 实证有 `.value`），T35（9fc11de5）批量改键路径时丢失；上游自家 notification seam 惯例即 `notifications.value.xxx`（ChatPanel.vue:61）。

### 根因 B（症状②）：T34 带入的上游 0f981ff2 打断 dev 桥 discovery 拓扑

上游 `0f981ff2`（"isolate Portless development routes"）给桥 vite 插件加 `OPENPENCIL_MCP_DISCOVERY_PATH` 隔离：dev 桥 discovery 从平台默认路径（`%LOCALAPPDATA%\OpenPencil\mcp.json`）改写到 tmpdir 隔离路径（`tmpdir()/open-pencil-mcp/sha256(runtimeId)[:16]/mcp.json`）。fork 自建 pi-backend 的 `tools.ts:68 readDiscoveryFile()` 只读默认路径。

实证（2026-08-28）：默认路径文件指向 pid 16584（8/26 桥，已死，`tasklist` 实证）→ stale 判空 → 工具调用抛「7600 桥 discovery 文件不存在或已过期」；`git merge-base --is-ancestor` 实证 0f981ff2 经 T34（c65d56e1）进入；T34 前桥插件无 discoveryPath（`git show 39ce06a8:...vite-plugin.ts | grep -c discoveryPath` = 0）。T34 的 host.ts 决策注记评估过 host 拓扑不跟隔离（正确），但漏评 dev 拓扑对 pi-backend 的影响；smoke:pi 自含不连活桥，门禁拦不住。

## 2. 修法

### S1 根因 A：诚实 Ref 类型 + script 消费补 `.value`

- `src/app/i18n/fork/index.ts`：去 `as any` 谎报与 oxlint 豁免，`useForkPi()` 照抄上游 `useNotificationMessages()` 形态直接返回 `useStore(forkPiMessages)`（类型推断保留 pi 段全键含 params 函数）；script 访问不写 `.value` 将被 tsgo/vue-tsc 直接判红——类型系统从此看守此模式。
- `src/components/chat/ChatInput.vue:42`：`piDialogs.value.designModelDefault`。
- `src/components/settings/models/PiModelsPanel.vue:58-63`：`dialogs.value.thinkingXxx` ×6。
- 模板用法全部不动（自动解包本就正常）。

### S2 根因 B：pi-backend vite 插件注入同源 discovery 路径

- `src/app/ai/pi-backend/vite-plugin.ts`（owned）：新增导出 `devMCPDiscoveryPath(runtimeId)`——与桥插件 `startChild` 同源算法（`tmpdir()/open-pencil-mcp/sha256(runtimeId)[:16]/mcp.json`）；`piBackendPlugin()` 增可选参 `mcpRuntimeId`，给定时把 `OPENPENCIL_MCP_DISCOVERY_PATH` 注入后端子进程 env（`readDiscoveryFile()` 经 `getDiscoveryPath()` 吃该 env）。
- `vite.config.ts`（已是 patch）：`piBackendPlugin({ mcpRuntimeId: automationRoute.runtimeId })`——runtimeId 单源取自同一 `devAutomationRoute()` 返回值。
- 不动上游桥插件 / `vite/automation.ts`（pristine follow 面零扩张）；host.ts 生产拓扑不涉（其桥不写隔离路径，pi 后端无该 env 时读默认路径，行为不变）。

### S3 防复发

- `tests/engine/rebuild/pi-dev-discovery.test.ts`（ownedRoot 下新建）：钉扎 `devMCPDiscoveryPath('localhost-7600')` 以 `open-pencil-mcp/18d901424f534c7b/mcp.json` 结尾——digest 硬编码，上游若改算法本测试变红提示同步。
- `docs/rebuild/04-porting-discipline.md` §6 增补第 13 条：上游动 dev 进程拓扑（spawn/env/discovery/端口）必复核 fork 自建进程读取侧。04 在 D14 绑定清单内，同 commit 追加 `records/narrative/04-porting-discipline.md`。

## 3. 验收标准

| # | 验收 |
|---|---|
| C1 | `tsgo --noEmit` + `check:vue` 绿——`.value` 缺失由类型系统判红（防复发证据） |
| C2 | 浏览器实证三症状消失：模型名标签渲染非空 / 设置面板 thinking 六项有字 / 工具调用不再报 discovery 断链 |
| C3 | `test:unit`（含新钉扎测试）+ `smoke:pi` 80/80 绿 |
| C4 | `check:zones` / `check:docs` / `check:bindings` / `check:tasks` / `format:check` / lint 全绿；zones.json 零变更（全部改动落在已登记区） |
| C5 | 三件套齐 + tracker/_index T38 行 + 04 §6 第 13 条与 narrative 追加 |

## 4. 出栈（明确不做）

pendingReclass 重分类；host.ts 拓扑改动；dev:backend 独立模式的桥发现（该模式本就需手工对齐拓扑，维持现状）；上游桥插件算法替换为共享 export（会扩张 patch 面，钉扎测试已够）。
