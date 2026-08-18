# 00 · 为什么重建，以及保留什么

> 日期：2026-08-18 | 全部数据在旧分支 `feature/agent-backend` @ `a1c33881` 上实测，核验命令附后

## 1. 问题

fork 自 2026-07-21 以来，越来越多精力消耗在两类工程债上：

- **兼容并行债**：功能经几轮迭代重构，同时与源项目机制兼容并行，同一能力存在多代实现（素材库 .fig 机制与 brand config 后端并存）。
- **对话机器债**：agent 底层基于 Vercel AI SDK 自研（无状态 `ToolLoopAgent`，session 管理在前端），相比 pi sdk / dsh 等成熟 harness 能力残缺（无持久 session、无 skills、无工具审批），且修补它的成本已超过重建。

同时实测确认：真正有价值的产品资产是三个——营销设计 system prompt 工作流及专属工具（generate_image / look / setup_material / compose_backdrop 等）、需求单机制、brand config 机制（type/profile）与实测效果好的 profiles。

## 2. 判决：不是重写，是 re-fork + 绞杀式移植

- **不重写**：最有价值的知识不在架构图里，在事故修复里（setup 跨页领养、`replace_id` 误传降级、覆盖前快照、OpenAI 系 provider tool-result 图片改写、CJK 字体 OOM……）。这些语义锁在代码和测试里，重写会把它们和债务一起烧掉。
- **不原地修**：原地收敛要在旧分支上先做减法再迁移 runtime，同一批代码动两次。
- **re-fork + 绞杀式移植**：从 upstream 切干净分支，先建机制（Phase 0），再把资产逐块移植/重建——移植时复审实现，语义由测试锁定。编辑器内核永久跟随上游，fork 关系从「全量合并」改为「有限范围跟随」。

## 3. 实测资产清单（2026-08-18 核验，全部通过）

| 资产 | 形态 | 实测位置（旧分支） | 核验 |
|---|---|---|---|
| 营销工具 | 代码，14 文件 | `packages/core/src/tools/marketing/` | `ls` ✅ |
| 生图管线 | 代码，4 文件 | `packages/core/src/tools/image-gen/` | `ls` ✅ |
| 工具注册缝 | 纯追加 ~140 行 | `registry-core.ts` +79 / `index.ts` +62（vs merge-base） | `git diff --stat` ✅ |
| brand config | **数据**：7 个 type + 若干 profile（`applicable_to` + markdown 风格指南） | `public/default-brand/config.yaml`（303 行）+ `packages/agent/src/brand/`（zod schema/loader/repository） | `head`/`grep` ✅ |
| system prompts | **数据**：markdown | `packages/agent/src/prompts/*.md`、`src/app/ai/chat/system-prompt-marketing.md`（26KB） | `ls` ✅ |
| 需求单 | 画布机制 + UI | core `marketing/brief*.ts` + `src/app/ai/marketing/brief-panel.ts` + `src/components/chat/BriefPanelDialog.vue` | `ls`/`grep` ✅ |
| 会话状态重建 | 画布标记机制 | `marketing/restore.ts`（ROLE_KEY/TYPE_KEY pluginData，根帧标记为权威） | `grep` ✅ |
| 测试基线 | 16 文件 224 用例 | `tests/engine/tools/{marketing,image-gen}/` | `bun test` 全绿 ✅（带 WIP 跑的） |
| 工具桥 | WebSocket RPC，agent 后端不碰 SceneGraph | `packages/agent/src/tools-bridge.ts`（仅为 AI SDK 适配器） | `head` ✅ |

分叉规模实测：230 commits 领先 / 72 落后；229 新增 / 118 修改 / 0 删除；+41,177/−1,114。
核验：`git diff $(git merge-base HEAD upstream/master)..HEAD --shortstat` 等。

## 4. 换 runtime 必然大改的清单（不要幻想只换适配器）

实测结论：**工具执行层与 runtime 绝缘**（SceneGraph 操作在编辑器内经 WebSocket 执行），**对话机器是 runtime 形状的**。AI SDK → pi sdk/dsh 时以下机制全部重新塑形：

| 机制 | 旧分支文件 | 大改原因 |
|---|---|---|
| 流式协议 + chat 传输 | `src/app/ai/chat/transports.ts`、`use.ts` | 现在前端每次发完整 messages[]；harness 在后端管 session，契约变为「新消息 + sessionId」 |
| Session 管理 | 前端、无持久化 | 挪到后端 + pluginData 关联文件，session 列表 UI 全新 |
| System prompt 注入 | transports.ts prepareCall 钩子 | overlay 内容可移植，注入点重建为 runtime extension 钩子 |
| 视觉回路 | `packages/agent/src/elision.ts`、`media-rewriter.ts` | 两者都操作 AI SDK 消息数组（K=2 媒体省略、provider tool-result 图片改写），换 runtime 后对其媒体模型重写——**核心技术风险** |
| 凭证/模型解析 | `model-resolver.ts`、`provider-helpers.ts`、`credentials.ts` | 按新 runtime 的 provider 体系重塑 |
| 工具审批 | 不存在 | 新能力，审批往返要扩 WebSocket 桥协议 |
| debug 面板 | `src/app/ai/debug/` | 围绕 AI SDK step/stream part 构建 |

推论：`packages/agent`（42 个新增文件，`ai@^6.0.174`）**整体不移植**。移植清单 = core 工具 18 文件 + brand（schema + config.yaml）+ prompts 内容 + 需求单机制 + UI 组件 + 224 条测试。对话层在新 runtime 上只写一遍。

## 5. 文档腐烂实录（为什么本目录有治理规则）

对旧分支文档的三处实测证伪（2026-08-18）：

1. `CHANGELOG.fork.md` 声称 "shipped `default-library.fig` loads automatically"——`public/default-library.fig` 与 `tools/marketing-library/` **均不存在**（素材库 .fig 机制已被 brand config 后端取代，changelog 还在描述上一代）。
2. fork-divergence.md 声称 "CHANGELOG.md 与 upstream 逐字节一致"——实测相对 merge-base 有 **+78 行** fork 修改（较新的 end-state 文档已如实登记，两份文档互相矛盾）。
3. fork-divergence.md 登记的 `src/components/L3/` 工作台目录**已不存在**（需求单 UI 已并入 `src/components/chat/`）。

另有未提交 WIP（8 个引擎文件 + `setup.ts`/`transports.ts`/`ChatInput.vue` 等）不在任何文档清单上——WIP 审判列入 Phase 0 前置工作（见 02 文档）。

## 6. 旧文档参考（历史参考，信任前重新核验）

- `docs/plans/architecture/fork-divergence.md` — 分叉全景与合并 SOP（数据大体准确，细节有腐烂）
- `docs/plans/architecture/end-state-follow-model.md` — 三区分类首版（本目录 02 文档的前身）
- `docs/idea/2026-08-18-pi-sdk-migration.md` — pi sdk 迁移草案（对现状描述准确；「前端零影响」判断不成立）
