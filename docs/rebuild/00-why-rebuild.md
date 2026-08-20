<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 00 · 为什么重建，以及保留什么

> **状态**：已核验 | **时间**：2026-08-18 14:00（核查轮 R1-R4）| **核验人**：subagent A-D + 主 agent
> **身份**：背景叙事，回答「为什么走 re-fork + 绞杀式移植这条路」，不直接驱动 Phase gate。
> **基线**：旧分支 `feature/agent-backend` @ `a1c33881`；核验方式 = 4 个只读 subagent 对账 + 主 agent 整体 review，详细结果见 `records/docs-governance.md` §R1。

## 1. 问题

fork 自 2026-07-21 以来，越来越多精力消耗在两类工程债上：

- **兼容并行债**：同一能力存在多代实现并存。实测实例：①system-prompt-marketing.md 有**两个手工同步副本**（`src/app/ai/chat/` 26208B 为源，`packages/agent/src/prompts/` 26207B 为构建期内联拷贝，唯一差异是末尾换行）；②elision 与 media-rewriter 同样逻辑**前端 + agent 各一份镜像**；③素材库 .fig 机制死后，changelog 仍在描述它。
- **对话机器债**：agent 底层基于 Vercel AI SDK v6 自研（`ai@^6.0.174`，无状态 `ToolLoopAgent`，每请求新建，前端全量重发历史），无持久 session、无 skills、无工具审批。实测：后端连 per-chatId 的内存缓存都没有（`transports.ts:316` 注释声称有，与路由实现不符——注释也会腐烂）。

实测确认的真正产品资产：营销设计 prompt 工作流及专属工具、需求单机制、brand config（type/profile）与实测效果好的 profiles。

## 2. 判决：不是重写，是 re-fork + 绞杀式移植

- **不重写**：最有价值的知识在事故修复里（setup 跨页领养、`replace_id` 误传降级、覆盖前快照、chat-completions provider 图片改写、CJK OOM……），锁在代码和测试里。
- **不原地修**：原地收敛要先减法再迁移 runtime，同一批代码动两次。
- **re-fork + 绞杀式移植**：从 upstream 切干净分支，先建机制（Phase 0），再逐块移植/重建。编辑器内核永久跟随上游，从「全量合并」改为「有限范围跟随」。

## 3. 实测资产清单（2026-08-18 核验）

| 资产 | 形态 | 实测位置（旧分支） | 核验 |
|---|---|---|---|
| 营销工具 | 代码，恰 14 文件 | `packages/core/src/tools/marketing/` | `ls` ✅ |
| 生图管线 | 代码，恰 4 文件 | `packages/core/src/tools/image-gen/` | `ls` ✅ |
| 工具注册缝 | 136 行新增 | 相对 merge-base `fece63b5`：`registry-core.ts` +75/−4、`tools/index.ts` +61/−1 | `git diff --numstat` ✅ |
| brand config | **数据**：恰 7 个 type + 8 个 profile | `public/default-brand/config.yaml`（恰 303 行）；type：`wechat_moments/wechat_article_cover/xiaohongshu/ecommerce_detail/event_poster/dsp_banner/product_long`；profile：`casual_v1/watercolor_poster_v0..v3/editorial_poster_v1/solid_poster_v1/watercolor_poster_v1_center_left` | `wc`/`grep` ✅ |
| brand 后端 | schema/loader/repository + **SQLite 用户覆盖层**（`~/.openpencil/brand.db`，config.yaml 首启 seed）+ HTTP 路由 `/v1/brand/*` | `packages/agent/src/brand/`、`routes/brand.ts` | subagent ✅ |
| system prompts | **数据**：markdown，两段式组装（base + marketing） | 源：`src/app/ai/chat/system-prompt*.md`；agent 侧为构建期内联拷贝（`scripts/inline-prompts.ts` → `prompts/generated/`） | `diff` ✅ |
| 需求单 | 画布机制 + UI | core `marketing/brief{,-edit}.ts` + `src/app/ai/marketing/brief-panel.ts` + `src/components/chat/BriefPanelDialog.vue` | `ls` ✅ |
| 营销设计状态恢复 | 画布标记机制（pluginId `open-pencil-marketing`，`role=marketing-root` / `material-type` 键，根帧标记为权威） | `packages/core/src/tools/marketing/restore.ts` | `grep` ✅ |
| 测试基线 | 恰 16 文件 | `tests/engine/tools/{marketing,image-gen}/`（12+4）；`bun test` 报告 224 通过（2026-08-18 带 WIP 实测；静态 `test(` 计数 221，口径差异，以运行时为准） | 运行 ✅ |
| 工具桥 | WebSocket RPC，agent 后端不碰 SceneGraph；对 AI SDK 的直接耦合仅 `tool` + `valibotSchema` 两个 import | `packages/agent/src/tools-bridge.ts` | 读文件 ✅ |

分叉规模（测量点 `a1c33881`，2026-08-18）：230 commits 领先 / **73** 落后（含合并提交的口径）；229 新增 / 118 修改 / 0 删除；+41,177/−1,114。注意：旧分支此后又前进 2 个 commit（含一次全仓 LF 规范化，M 计数被放大），重建基线以本测量点为准。

## 4. 换 runtime 必然大改的清单（不要幻想只换适配器）

实测结论：**工具执行层与 runtime 基本绝缘**（SceneGraph 操作在编辑器内经 WebSocket 执行；唯一例外：`packages/core/src/tools/ai-adapter.ts` 也 import 'ai'，移植时需剥离/替换），**对话机器是 runtime 形状的**。AI SDK → 新 runtime 时以下全部重新塑形：

| 机制 | 旧分支文件 | 大改原因 |
|---|---|---|
| 流式协议 + chat 传输 | `src/app/ai/chat/http-agent-transport.ts`、`transports.ts`、`use.ts` | 前端每次发全量 messages 到 `/v1/chat`，消费 UIMessage stream v1 SSE；harness 管 session 后契约变为「新消息 + sessionId」 |
| Session 管理 | 前端 `@ai-sdk/vue` 的 `Chat` 类（纯内存，WeakMap per store），chatId per-tab | **地面真相：当前无任何会话持久化**，跨重开恢复为零（画布 marker 恢复的是营销设计状态，不是会话）。新 session 体系是从零新建，不是改造 |
| System prompt 注入 | transports.ts 组装（base + marketing + overlay） | overlay 内容可移植，注入点重建为 runtime extension 钩子 |
| 视觉回路 | **双份镜像**：`src/app/ai/chat/{elision,media-tool-results}.ts` + `packages/agent/src/{elision,media-rewriter}.ts` | 请求级媒体省略（保留最近 K 张，默认 2 可配 1-3）+ chat-completions 系 provider 的 media tool-result 改写为 user 消息。对新 runtime 媒体模型重写——**核心技术风险**；语义只需移植一份 |
| 凭证 | 聊天 key：`/v1/auth` 下发（1h TTL）；生图 key：**独立的第二套**（localStorage 三键 + `setImageGenCredentials` 进程级注入 + `ImageGenKeysSection.vue`） | 按新 runtime 凭证体系统一；注意 web 端无 keyring |
| 工具审批 | 不存在 | 新能力，审批往返要扩 WebSocket 桥协议 |
| debug 面板 | `src/app/ai/debug/`（仅 index.ts 一个文件） | 围绕 AI SDK step/stream part 构建 |
| agent 后端 HTTP | `packages/agent/src/routes/`（/health、/v1/auth、/v1/catalog、/v1/chat、/v1/brand，Hono） | 路由契约随 runtime 重塑 |

推论：`packages/agent`（42 个新增文件，含构建脚本与 `prompts/generated/` 生成物）**整体不移植**——brand schema/loader/repository 剥离 runtime 依赖后另算。移植清单 = core 工具 18 文件 + brand（schema + config.yaml + repository 语义）+ prompts 内容 + 需求单机制 + UI 组件 + 16 个测试文件。对话层在新 runtime 上只写一遍。

## 5. 文档腐烂实录（为什么本目录有治理规则）

对旧分支文档的实测证伪（2026-08-18）：

1. `CHANGELOG.fork.md` 声称 "shipped `default-library.fig` loads automatically"——`public/default-library.fig` 与 `tools/marketing-library/` **均不存在**；`src/app/ai/marketing/library.ts` 实测已是 brand HTTP 服务的 thin shim，不加载任何 .fig。
2. fork-divergence.md 声称 "CHANGELOG.md 与 upstream 逐字节一致"——实测相对 merge-base **+78/−0**（测量点 a1c33881；与较新 end-state 文档互相矛盾）。
3. fork-divergence.md 登记的 `src/components/L3/` **不存在**（需求单 UI 在 `src/components/chat/`）。
4. 同 changelog 声称的「素材图理解（hash 缓存描述）」**全仓无代码**——`brief.ts` 里的 hash 只是图片填充 hash。phantom 能力，见 01 不加清单。
5. 未提交 WIP（8 个引擎文件 + setup.ts/transports.ts/ChatInput.vue 等）不在任何文档清单——审判清单见 [records/upstream-merge.md 审判条目](records/upstream-merge.md)。

## 6. 旧文档参考（历史参考，信任前重新核验）

- `docs/plans/architecture/fork-divergence.md` — 分叉全景与合并 SOP（大数准确，细节有腐烂）
- `docs/plans/architecture/end-state-follow-model.md` — 三区分类首版（02 文档前身）
- `docs/idea/2026-08-18-pi-sdk-migration.md` — pi sdk 迁移草案（现状描述大体准确；「前端零影响」不成立）
