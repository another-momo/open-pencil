# OpenPencil（mode 分支）· 代码向导

> 本文件只装仓库普适事实（任何机器、任何 clone 位置都为真）。
> 协作机制（角色权限矩阵 / 资源治理 / 环境硬约束）不在本文件范围内，由本机工作台层承载。

## 1. 项目与分支拓扑

- AI 设计编辑器：Vue 3 + CanvasKit(Skia) 渲染 + pi-backend AI 后端 + 自动化桥（browser-rpc）。
- 集成分支 `rebuild/mode-arch`；与上游保持定期合并，文件所有权由 zone 登记制机器化管理（§3）。
- monorepo：bun workspaces；`packages/*` 为库，`src/` 为应用。

## 2. 协作摘要（最低限度规则）

- 主 agent 唯一允许：git 写（commit / merge-back）、browser 实测、gh 操作。
- worker（subagent）：限定范围实现 + 目标测试文件；**禁**全量 test / dev / build、push、browser、`gh run rerun`。
- push：主 agent 每次收口 commit 后顺势试推**一次**；失败即停（不原地重试），积压归 owner 后续处理。worker 禁 push。
- gh 命令一律带 `-R another-momo/open-pencil`。

## 3. zone 纪律（改代码前必读）

- `tools/zone-registry/zones.json` 是唯一所有权真相：`ownedRoots` / `ownedFiles` 内自由改；改动其他（上游供血）文件必须登记 `patches`；删除走 `deletedPaths`；搬移登记 `relocations`。
- pre-commit 强制 `check:zones`；`bun run check:zones:drift` 查看对上游漂移明细。
- 上游合并 SOP：合并前 check:zones 绿 → 按 zone 裁定冲突 → 合并后 ownedFiles 字节审计 + relocations / tarball 台账更新。
- `tools/zone-registry/` 自身与 `.github/workflows/` 均为 ownedRoot，fork 治理设施自由改。

## 4. 提交与门禁

- commit 前必跑 `bun run format:check`（CI 红灯首要嫌疑，历史教训）。
- 日常收口门禁：`bun run check:quick`（format + lint + typecheck + zones 四步串行）。
- 大改动（≥10 文件或 ≥200 行）收口跑全量 `bun run check`，跑前停 dev server。
- commit message：中文 conventional（`type(scope): 主题`）+ 正文写清 why——背景、方案取舍、验证证据。
- pre-commit = check:zones；post-commit = 机制复盘计数提醒（advisory，永不阻塞）。

## 5. 测试纪律

- bun:test 框架；**禁引入 DOM 测试基建**（happy-dom/jsdom 一律不许）——浏览器行为用真浏览器实测（主 agent）。
- worker 只跑目标测试文件；全量单测用 `bun run test:unit:serial`（套件分批串行），禁单次全仓 `bun test tests/engine`（单进程内存累积）。
- playwright（`test` / `test:figma`）主 agent 独占，与任何重型任务互斥。

## 6. 仓库地图

- `src/app/ai/pi-backend/` —— AI 后端（ownedRoot）：service / server / tools / transport / active-design-host / image-gen
- `src/app/ai/fork/` —— AI 前端 fork 层（ownedRoot）：transports / session 管理
- `src/app/automation/` —— 自动化桥（ownedRoot）：server（browser-rpc 窗口路由）/ client / vite-plugin / runtime
- `src/components/assistant/` —— AI 助手 UI（ownedRoot）：ChatPanel / active-design / markdown
- `packages/core/src/text/` —— 文本与字体：font/cn-catalog（CN 目录）、web-font、fonts.ts 管理器
- `packages/core/src/tools/fork/` —— 工具 fork 层（ownedRoot）：marketing / brief / active-design
- `packages/scene-graph | pen | kiwi | fig | dom-css | vue` —— 基础库：场景图 / 画笔 / 约束求解 / fig 编解码 / DOM CSS / Vue 绑定
- `tests/engine/` —— 单测（`rebuild/` 子目录为 ownedRoot，其余 follow 上游）
- `tools/zone-registry/` —— zone 装备（zones.json + check.ts）
- `tools/hooks/` —— git 钩子（core.hooksPath 指向此）
- `tools/cn-font-catalog/` —— CN 字体目录离线管线
- `docs/` —— ownedRoot；`archive/rebuild-campaign/` 为冻结历史档案，禁止引用为现行规则
- `.github/workflows/` —— CI（ownedRoot，纯 fork 治理设施）

## 7. CI

- 全量 check + 全量测试在 CI 跑；本地分层能拦住的不等 CI。
- CI 红灯先本地最小层复现再修；禁 `gh run rerun`；push 失败即积压，网络差时自然攒批。
