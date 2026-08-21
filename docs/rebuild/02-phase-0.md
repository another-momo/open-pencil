<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 02 · Phase 0：机制与减法（起点定义）

> **状态**：已执行 + 已核验 | **时间**：2026-08-19 16:30 完成；本轮整改 2026-08-20 18:30；T09 修正 2026-08-21（§5 #2「CI 已接线」声称证伪）
> **核验人**：subagent A（gate review 机械审计）+ 主 agent + subagent C/D（执行期 4 项核验 R3/R4/P0-1~P0-10）
> **身份**：**本文是 Phase 0 执行依据**；01-target-state.md 是「做哪些加法」的决策依据；03-phase-1-runtime.md 与 spikes/*.md 是 case study 与技术调研，身份是辅助参考信息，不直接驱动 Phase gate。
> **基线**：commit 序列 `f4efaff7..68f67484` → 合并演习 `44205546` → `ae23db01`，后续文档提交 `cbc3fe4f`、`4a17fc77`。执行期实测修正已迁移至 `records/topics/docs-governance.md` 修正-2 条目；合并演习细节见 `records/topics/upstream-merge.md` MERGE-1。

Phase 0 不加任何产品功能，验收通过前不得进入 Phase 1。

## 1. 一句话定义

在从 `upstream/master` 切出的本分支上，**只做减法和机制建设**，产出「会自己守纪律的上游跟踪骨架」。成功的样子：之后每次合并 upstream 都变成一件无聊的事。

## 2. 减法清单（全部经 R3 在上游实测存在）

| 删除对象 | 连带处理（实测切断点） |
|---|---|
| `desktop/`（Tauri 壳） | `src/app/tauri/` 保持上游纯净、一行不动——它被 ~20 个 src 文件**静态** import 且运行时守卫，stub 方案已否决；`tools/tauri-menu/`、`tests/engine/tauri/`（11 文件）、`tests/helpers/tauri/`、`tests/e2e/native/`、根 `wdio.conf.ts`、`scripts/generate-tauri-menu.ts` 同删 |
| `src/app/collab/`（13 文件，含 transport/）+ `src/components/CollabPanel/`（6+1） | **软切断载体是 `collab/use.ts` 的 stub**（保留 `useCollab`/`COLLAB_KEY`/类型表面，删其余 10 个实现文件）；`/share/:roomId` 路由（router.ts） |
| `src/app/ai/acp/`（5 文件）+ `src/components/chat/ACPPermissionDialog.vue` | **引用点在 `src/components/ChatPanel.vue`**，另波及 ChatInput.vue 与 `src/app/ai/chat/{storage,transports,use}.ts` |
| `packages/demos/` | ⚠️ 实测非 workspace 包，仅 2 个素材文件（videos/）；knip 里它的 ignoreWorkspaces 本是死配置 |
| `packages/docs/`（vitepress workspace 包）+ `tools/docs/` + `src/app/demo/` + `SafariBanner.vue` + `public/_headers`/`_redirects` + `tools/release-packages/` | EditorView demo import（:19/:48） |
| **6 个 workflows** | `build.yml`（桌面发布）、`docs.yml`（文档站）、`app.yml`（CF Pages 部署）、`homebrew.yml`（桌面分发）、`deploy-preview.yml` + `preview.yml`（CF PR 预览）；ci.yml 删 `native-test-contracts` job（补丁 P20）。剩余：ci / heavy-tests / native-contracts-image / pr-review-guidance |
| 7 个翻译 locale（de/es/fr/it/ja/pl/ru） | 上游共 9 个 locale = en base + 8 翻译，zh-CN 在 8 个翻译里——删 7 留 zh-CN。切断点 2 个文件：`locale.ts`（4 个表）+ `create.ts`（localeLoaders）。合并演习追加：上游 #557 的 `notifications/locales/` 7 个 json 同步删除（P24） |

**EditorView.vue 是切断点集中地**（实测单文件 5+ 处：collab import、`exposeCollaborationActions`、CollabPanel、SafariBanner、useCollab provide、demo）——逐个编号登记，不许打包成「1 处」。

**配置连带面**（R3 实测）：`package.json` 的 workspaces（-packages/docs、-tools/docs）与 scripts（删 tauri/wdio/docs 系，check 链摘除、加 check:zones）与依赖（裁 6 个 @wdio/* + @tauri-apps/cli + expect-webdriverio + vite-plugin-pwa + workbox-window + 未用的 yjs 系 4 个 + trystero；**8 个 @tauri-apps/* runtime 依赖保留**，vite build 需可解析）；`tsconfig.json` 删 `#docs-config/*` paths；knip.json、steiger.config.ts、oxlint.json 中对被删目录的 ignore 条目**保留未清**（无害，零补丁纪律，见 [records/topics/upstream-merge.md 执行期遗留](records/topics/upstream-merge.md)）。

**删除标准**：目标态不存在、且建设过程也不需要。不符合两条的不删，见 [§3 机制建设](#3-机制建设phase-0-的核心)。

## 3. 机制建设（Phase 0 的核心）

### 3.1 zone registry（单一事实源，机器可检查）

- 代码形态（如 `tools/zone-registry/zones.json` + check 脚本），逐路径/逐文件归属：**follow / owned / deleted / stub / patch / pending-reclass**。
- CI 检查：**follow 区文件被修改且不在补丁清单 → CI 红**。清单颗粒度到文件（「基础三件套」这种表述违反机器可检查原则，禁用）。

### 3.2 补丁点登记制

- 编号补丁（P1、P2…）：文件 + hunk + 一句话理由 + 处置方向（上游化 / 永久保留）。
- Phase 0 结束时补丁集**只有减法切断点，产品补丁为零**。

### 3.3 待重分类（pending-reclass）——不删，打标

目标态以自持形态存在、且现有代码是起点的上游部分，**Phase 0 保留为 follow 区并打标**。重分类时刻 = 第一次需要修改它的时刻。

**豁免条款（与 zones.json `$comment` 对齐）**：待重分类文件可以携带**减法切断补丁**（如 chat/ 系被 ACP 删除波及的 P4-P8、ci.yml 的 P20）——补丁登记即合法，「一行不许改」只约束功能改动。

清单（按文件点名）：`src/app/ai/chat/`（9 文件）、`src/components/chat/`（6 个 .vue + `attachment/`，ACPPermissionDialog 已删）、`src/components/ChatPanel.vue`、`src/app/ai/providers/`（3）+ `models/`（6）、`src/app/ai/attachment/`、`src/app/ai/tools/`、`src/app/ai/vision-runtime.ts`、`src/app/automation/`（12）+ `packages/mcp` + `src/app/browser-bridge.ts`、`packages/cli`、`src/app/ai/debug/index.ts`、`.github/workflows/`（剩余 4 个：ci/heavy-tests/native-contracts-image/pr-review-guidance）。

⚠️ **已登记的内部冲突**：`browser-bridge.ts` 被 EditorView 用于 `exposeCollaborationActions(collab)`——collab stub 化时类型可能不配合。处置：给它预备补丁额度，或 stub 签名对齐 `useCollab` 返回类型。R3 实测，勿回避。

**重分类仪式**：① registry 改 owned；② 记录当时 upstream hash 打 tag（`reclass/<路径>/<hash>`）；③ 需同时裁剪的（如 mcp 砍对外功能）在重分类时刻做，不提前。

### 3.4 两条缝合缝（已落地）

- **工具注册缝**：已落地为补丁 P22——`registry.ts` 加 import + spread 两行，owned 工具落 `packages/core/src/tools/fork/`（当前空数组占位）。上游 `component-catalog.ts` 的 `registerComponentCatalog` 是同构先例。
- **i18n 缝**：已落地于 `src/app/i18n/fork/`——fork 自建 createI18n 实例绑共享 locale atom，自带 zh-CN 懒加载包，`packages/vue` 零修改。合并演习发现上游 #557 自建了同构的 `src/app/i18n/notifications/`，方向被上游验证；避让命名见 `records/topics/docs-governance.md` 修正-2 第 4 条。验证：`tests/engine/rebuild/i18n-seam.test.ts` 2/2 绿。（教训记录：初版文档虚构了 `mergeLocaleMessage` API，R3 证伪后按上游实际用的 `@nanostores/i18n` 重新设计。）

### 3.5 基础设施纪律

- **LFS**：`.lfsconfig` 保持上游网关（匿名读实测可用）；fork 自有 GitHub LFS **预算超额**（pull 被拒）；fixture 去 LFS 化被否（material3/nuxtui 合计 143MB，进普通 git 不可接受）。结论：LFS 面在本分支仅剩 6 个测试 fixture（canvaskit 已来自 npm）；未来新增 LFS 文件（如普惠体）前必须解决自有托管。补丁 P21 已撤销。CI 的 `lfs: true` 补充项已随 workflows 删除消失。
- `CHANGELOG.md` 永久保持上游原样；产品发版记录用 owned 新文件。
- 目录落位约定：core 工具以新文件落 `packages/core/src/tools/`（A 类纪律，fork 工具经 `tools/fork/` 缝注册）；app 层落 `src/app/ai/` owned 子目录；UI 落 `src/components/chat/` owned 文件；fork i18n 落 `src/app/i18n/fork/`（避开上游 `notifications/`）；owned 测试落 `tests/engine/rebuild/`（已挂进 shards app 组）；`packages/agent` 在 Phase 0 **不存在**，Phase 1 出生。
- **autocrlf 治理**（仓库级，2026-08-19 起）：`git config core.autocrlf false` 必须在仓库根目录设置，不入库。新成员入职或换新机时执行同样命令。LFS 类幻影 M（真实 fixture/字体盖在指针上）保留——clean 过滤器为 no-op，纪律约束。

## 4. 前置：旧分支 WIP 审判（已结案）

✅ 已结案（2026-08-19，Agent W）：WIP 已随旧分支 `3f925191` 提交，14/14 文件为 lint/类型等价清理，零行为变更，零需移植。详见 `records/topics/upstream-merge.md` 审判条目。

## 5. 验收标准（逐条可执行）—— 2026-08-19 实测结果

1. ✅ diff 只有删除 + owned 新文件 + 登记补丁（zone check：`24 modified (all registered), 15 added (owned), 951 deleted`）。
2. ✅ follow 区纯净检查通过（`bun tools/zone-registry/src/check.ts`）。⚠️ T09 修正：验收时「CI 已接线 `check:zones`」的声称**不实**——四个纪律检查从未出现在任何 workflow（`grep -rn "check:zones" .github/` 零命中，`git log --all -S "check:zones" -- .github/` 空，2026-08-21 实测）；T09 起经 ci.yml `rebuild-discipline` job 真正接线（见 [records/topics/ci-infra.md CI-6](records/topics/ci-infra.md)）。
3. ⚠️→✅ CI 已全绿（2026-08-19，run 32248474442，11/11 job；5 轮修复史见 `records/topics/ci-infra.md` CI-1~CI-5）；本机：build:packages ✅、tsgo ✅、vue-tsc ×2 ✅、i18n check ✅、定点单测（含可疑回归文件隔离重跑 + 合并后 460 用例）0 fail。全量单测本机有环境性失败（纯净基线同源），按纪律交 CI。
4. ✅ 冒烟：preview 启动 + 画矩形全链路（图层树/属性面板/中文 UI/零 console 报错）；dev server 启动正常。中文 .fig 打开验证依赖 fixture 字体已就位的单测通过（fonts 相关测试隔离全绿）。
5. ✅ 合并演习：upstream/master `15bd0ba1→0332b062`（8 commits，含 AI SDK 7）已合入，冲突处理与修正见 `records/topics/upstream-merge.md` MERGE-1。
6. ✅ 旧分支 `feature/agent-backend` 未动（WIP 已随 3f925191 终结，见 `records/topics/upstream-merge.md` 审判条目）。
7. ✅ **文档核验**：Phase 0 相关叙事文档（00/02 + 本文件）的所有可检查声明，经 subagent A 轮机械审计全绿——结果记入 [records/topics/docs-governance.md §P0-8](records/topics/docs-governance.md)。

## 6. 不属于 Phase 0 的（护栏）

`packages/agent`、营销工具、brand config、需求单、引擎行为补丁、serve 形态、rebrand——各有阶段和验收。唯一例外是缝合缝本身（机制，不是功能）。