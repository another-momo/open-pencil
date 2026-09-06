<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T33 独立核验 · localhost 分发骨架（生产编排器 host.ts）

> **状态**：✅ 已核验 | **时间**：2026-08-26 | **核验人**：subagent 独立核验
> **锚点**：HEAD=dbc4ee0e（rebuild/pi-host）| 被核验对象=未提交工作树（M `package.json` / `src/app/automation/mcp/spawn.ts` / `src/app/automation/mcp/runtime.ts` / `tools/zone-registry/zones.json` + 新增 `src/app/ai/pi-backend/host.ts` / 本任务三件套文档，`git status` 实测吻合）| 基线=dbc4ee0e（T32 收口）| 上游=88c10770
> **核验方式**：先跑命令取实测（grep 定位行号 / python json 解析 / 门禁命令 exit code），再据实填写；浏览器全链路（plan C4）由主 agent 实测在案（self-check §2），本核验不重复浏览器操作。

## V1 · 交付物完整性（对应 plan S1/S2）——判定：✅

实测命令：`grep -n` 逐一定位（2026-08-26）：

- `src/app/ai/pi-backend/host.ts`（新建，实测 355 行）：四个职能段齐备——`spawnBridge`(L89)、`spawnBackend`(L110)、`waitFor`(L126)、`createServer`（node:http 导入 L26，调用 L324 + `server.listen(servePort, '127.0.0.1')` L334）。头部注释明示四职责（spawn 桥 / spawn 后端 / dist 托管 + token 注入 / `/api/pi*` 反代）。
- `src/app/automation/mcp/spawn.ts`：`RUNTIME_AUTOMATION_AUTH_TOKEN`(L45 定义，L51 解析消费)；「host 托管」分支 L382–L393（无注入值时维持原 null 行为，有则 pollHealth 后返回 handle）。
- `src/app/automation/mcp/runtime.ts`：`canConnect`(L173–L176) 含 `window.__OPENPENCIL_RUNTIME_AUTOMATION_TOKEN__` 判定。
- `package.json`：L21 `"serve": "bun run src/app/ai/pi-backend/host.ts"`。

判定 ✅。

## V2 · zones 台账（对应 plan C6）——判定：✅

实测命令：`python` json 加载 `tools/zone-registry/zones.json`（2026-08-26）：

- **patches** P103/P104/P105 三条齐备，字段逐条核对：
  - P103 → `file=package.json`，reason「scripts += serve」；
  - P104 → `file=src/app/automation/mcp/spawn.ts`，reason「运行时 token 注入 hook」；
  - P105 → `file=src/app/automation/mcp/runtime.ts`，reason「canConnect 放行 host 托管形态」；
  - 三条均 `task=T33`、`disposition=permanent`、`lastReviewed=2026-08-26`。
- P103 编号复用已在 reason 内注明（前一个 P103 当日撤销、从未入 commit）。

实跑 `bun tools/zone-registry/src/check.ts`：**exit 0**，末行 `[zones] clean: 78 modified (all registered), 305 added (owned), 1039 deleted (all registered), 13 renamed (cross-checked), base 5201404f`。

判定 ✅。

## V3 · 门禁复跑（对应 plan C5）——判定：✅

门禁实跑 exit code（2026-08-26，工作树即被核验对象）：

| 命令 | exit | 关键输出 |
| --- | --- | --- |
| `bun run format:check` | 0 | 2031 文件格式正确 |
| `bun run lint` | 0 | **0 errors**；max-lines 存量警告详见下注 |
| `bun run check:docs` | 0 | 40/40 通过（R1 状态 + R2 时间 + R3 身份 + R4 纪律块 + R5 引用格式） |
| `bun run check:bindings` | 0 | 7 文件变更，binding 全绿 |
| `bun run check:tasks` | 0 | zones.json 变更摘要：新增 P103, P104, P105；4 文件变更（小改动，无需 task 计划） |
| `bun run check:arch` | 0 | steiger：No problems found! |
| `bun run smoke:pi` | 0 | 5 套件全过：t22 target **6** + t22 history **12** + t23 sessions **14** + t24 prompt-assembly **29** + t28 session-gc **19** = **80 passed, 0 failed**（末套 19 与预期一致） |

lint 警告注记（如实记录）：`lint` 含两个 oxlint 作用域，均 0 errors、exit 0。末段汇总恰为 **Found 3 warnings and 0 errors**；type-aware 子跑报 4 条 max-lines（scene-graph/types.ts 617 / core/variants/index.ts 704 / core/design-jsx/props-overrides.ts 608 / tests/engine/mcp/server/index.test.ts 609，上限 600）——四处均为 **T33 未触碰的存量文件**（本任务仅改 package.json / spawn.ts / runtime.ts / zones.json，见锚点 git status），无新增违规。

判定 ✅。

## V4 · typecheck——判定：✅

实跑 `bun run typecheck`（2026-08-26）：**exit 0**。链路为 `tsgo --noEmit && bun run check:vue`，其中 check:vue 为 `vue-tsc --noEmit -p tsconfig.json && vue-tsc --noEmit -p packages/vue/tsconfig.json`——即 tsgo + vue-tsc ×2 全绿。

判定 ✅。

## V5 · 文档面（对应 plan 收口纪律）——判定：✅

实测（Read 全文 + grep，2026-08-26）：

- [T33-plan.md](T33-plan.md) 与 [T33-self-check.md](T33-self-check.md) 均存在，头部均有写作纪律注释块（R4）。
- 两文状态行格式合规：`> **状态**：已核验 | **时间**：2026-08-26 | **核验人**：主 agent`（plan 另含分支/上游钉扎行）。
- plan §3 验收表：C1–C6 全标 ✅ 且各附实测出处（C1→self-check §3 浏览器建矩形；C2 catalog 200；C3 reasoning delta 流式；C4 图层树「矩形」+ Create Shape 卡片截图存证；C5 门禁全套 + smoke 绿；C6 zones 合规）；C7（CI 双链 success @ 同 SHA）标注「推送后复验」，属收口后动作、非本核验范围。
- self-check 对应段齐备：§2 冒烟实测逐项覆盖 C1–C4（含 curl 三项与级联退出/recovery 联动）、§5 门禁覆盖 C5、§1 交付物与 V1 一一对应。
- 占位字样：`grep "（待"` 两文件零命中（exit 1）。

判定 ✅。

---

## 收口判定

V1–V5 全部 ✅，无 ❌ 项：**可以收口**。（后续动作归主 agent：S 推送 + plan C7 CI 双链复验 + tracker/_index T33 行翻 ✅。）

## 关联文档

- plan：[T33-plan.md](T33-plan.md)
- self-check：[T33-self-check.md](T33-self-check.md)
