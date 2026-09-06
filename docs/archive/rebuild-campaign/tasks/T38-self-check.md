<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T38 自检 · 三症状回归修复

> **状态**：已完成 | **时间**：2026-08-28 | **负责人**：主 agent
> **基线**：`aabacb0a`（T37 收口后 HEAD）

## 1. 改动清单（实测 `git status --short`，2026-08-28）

| 文件 | 改动 |
|---|---|
| src/app/i18n/fork/index.ts | 去 `as any as PiNamespace` 谎报 + oxlint 豁免 + 未用 import；`useForkPi()` 照抄上游 `useNotificationMessages()` 直接返回 `useStore(forkPiMessages)` |
| src/components/chat/ChatInput.vue | `piModelLabel` computed 补 `piDialogs.value.`（T35 丢 `.value` 处） |
| src/components/settings/models/PiModelsPanel.vue | `thinkingLabel()` 六项补 `dialogs.value.` |
| src/app/ai/pi-backend/vite-plugin.ts | 新增 `PiBackendPluginOptions.mcpRuntimeId` + 导出 `devMCPDiscoveryPath()`（与桥插件 startChild 同源算法）+ spawn env 注入 `OPENPENCIL_MCP_DISCOVERY_PATH` |
| vite.config.ts | `piBackendPlugin({ mcpRuntimeId: automationRoute.runtimeId })`——与 automation 桥插件单源同一 route 对象 |
| tests/engine/rebuild/pi-dev-discovery.test.ts | 新建：硬编码 digest `18d901424f534c7b` 钉扎算法一致性 |
| docs/rebuild/04-porting-discipline.md | §6 SOP 12 → 13 条（dev 进程拓扑复核） |
| docs/rebuild/records/narrative/04-porting-discipline.md | T38 追加条（D14 绑定） |

zones.json **零变更**——全部改动落在已登记区（ownedRoots ×3 / ownedFiles ×1 / pendingReclass ×1 / 既有 patch ×1）。

## 2. 门禁实测表（2026-08-28 本机全绿）

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `bunx tsgo --noEmit` | ✅ 零输出（静默绿） |
| vue 类型 | `bun run check:vue` | ✅ 双 tsconfig 零报错 |
| lint | `bun run lint` | ✅ 0 errors（4 warnings 全为上游文件既有 max-lines，与本任务无关） |
| format | `bun run format:check` | ✅ All matched files use the correct format |
| zones | `bun run check:zones` | ✅ clean: 55 modified all registered |
| docs | `bun run check:docs` | ✅ 40/40 |
| bindings | `bun run check:bindings` | ✅ 全绿（04 + narrative 同批） |
| tasks | `bun run check:tasks` | ✅ |
| 单元测试 | `bun test ./tests/engine/rebuild` | ✅ 3/3（含新钉扎测试） |
| smoke:pi | `bun run smoke:pi` | ✅ 80/80（6+12+14+29+19） |

### 过程中发现并修复

- **oxlint 自定义规则 `open-pencil/no-mixed-case-acronym-identifiers` 判红 ×4**：初版 helper 命名 `devMcpDiscoveryPath`（Mcp 混合大小写），按仓内惯例（spawnMCPIfNeeded 等）改 `devMCPDiscoveryPath` 后复绿。

## 3. 类型谎报的防复发验证（C1）

`useForkPi()` 现在返回诚实的 `DeepReadonly<UnwrapNestedRefs<ShallowRef<...>>>`——若未来再有 script 侧漏写 `.value`，`tsgo`/`vue-tsc` 会以「属性不存在于 ShallowRef」直接判红（本任务修复前 `as any` 使该保护失效）。已实测：当前两个消费方 `.value` 写法通过双类型门。

## 4. 遗留登记

- **dev:backend 独立模式**不注入 discovery env（无 vite 插件层），该模式维持「读平台默认路径」语义——出栈项，见 T38-plan §4。
- 钉扎测试只锁算法一致，不模拟桥进程；活链路由浏览器实证覆盖（见 T38-verify）。
