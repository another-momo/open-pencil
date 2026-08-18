# 02 · Phase 0：机制与减法（起点定义）

> 状态：已核验（2026-08-18，R3 对账 upstream/master @ `15bd0ba1`；upstream 已漂移至 `4e48420a`，作合并演习素材）
> Phase 0 不加任何产品功能，验收通过前不得进入 Phase 1。

## 1. 一句话定义

在从 `upstream/master` 切出的本分支上，**只做减法和机制建设**，产出「会自己守纪律的上游跟踪骨架」。成功的样子：之后每次合并 upstream 都变成一件无聊的事。

## 2. 减法清单（全部经 R3 在上游实测存在）

| 删除对象 | 连带处理（实测切断点） |
|---|---|
| `desktop/`（Tauri 壳） | `src/app/tauri/` 改 stub 壳（`IS_TAURI` 恒 false；实测 IS_TAURI 共 37 处/16 文件、tauri 动态 import 29 处——动态 import 的是 @tauri-apps/* npm 包，不切断即可解析）；`tools/tauri-menu/`、`tests/engine/tauri/`（11 文件）、`tests/helpers/tauri/`、`tests/e2e/native/`、根 `wdio.conf.ts` 同删 |
| `src/app/collab/`（10 文件）+ `src/components/CollabPanel/`（6+1） | **软切断载体是 `collab/use.ts` 的 `useCollab` + `COLLAB_KEY`**（无单一 collab-store 文件）；`/share/:roomId` 路由（router.ts:12，参数名是 roomId） |
| `src/app/ai/acp/`（5 文件）+ `src/components/chat/ACPPermissionDialog.vue` | **引用点在 `src/components/ChatPanel.vue`**（:26 import、:341 使用），另波及 ChatInput.vue 与 `src/app/ai/chat/{storage,transports,use}.ts` |
| `packages/demos/` | ⚠️ 实测非 workspace 包，仅 2 个素材文件（videos/）；knip 里它的 ignoreWorkspaces 本是死配置 |
| `packages/docs/`（vitepress workspace 包）+ `src/app/demo/` + `SafariBanner.vue`（仅 EditorView :32/:120 引用）+ `public/_headers`/`_redirects` + `tools/release-packages/` | EditorView demo import 在 :19/:48 |
| 7 个翻译 locale（de/es/fr/it/ja/pl/ru） | **算术修正：上游共 9 个 locale = en base + 8 翻译，zh-CN 在 8 个翻译里——删 7 留 zh-CN**。切断点 2 个文件：`locale.ts`（AVAILABLE_LOCALES 等 4 个表）+ `create.ts`（localeLoaders 8 条动态 import） |

**EditorView.vue 是切断点集中地**（实测单文件 5+ 处：collab import :13、`exposeCollaborationActions` :15、CollabPanel :23、SafariBanner :32/:120、useCollab provide :56-58、demo :19/:48）——逐个编号登记，不许打包成「1 处」。

**配置连带面**（R3 实测，减法清单必须含）：`package.json` 的 workspaces（packages/docs、tools/docs）与 scripts（`tauri`、`build:native-test`、`test:native`、`generate:tauri-menu`、4 个 `docs:*`、`check:docs`、`check:native-test` 总链）与依赖（8 个 @tauri-apps/* + 6 个 @wdio/* + @tauri-apps/cli）；knip.json、steiger.config.ts、oxlint.json 中对被删目录的引用。

**删除标准**：目标态不存在、且建设过程也不需要。不符合两条的不删，见 §3.3。

## 3. 机制建设（Phase 0 的核心）

### 3.1 zone registry（单一事实源，机器可检查）

- 代码形态（如 `tools/zone-registry/zones.json` + check 脚本），逐路径/逐文件归属：**follow / owned / deleted / stub / patch / pending-reclass**。
- CI 检查：**follow 区文件被修改且不在补丁清单 → CI 红**。清单颗粒度到文件（「基础三件套」这种表述违反机器可检查原则，禁用）。

### 3.2 补丁点登记制

- 编号补丁（P1、P2…）：文件 + hunk + 一句话理由 + 处置方向（上游化 / 永久保留）。
- Phase 0 结束时补丁集**只有减法切断点，产品补丁为零**。

### 3.3 待重分类（pending-reclass）——不删，打标

目标态以自持形态存在、且现有代码是起点的上游部分，**Phase 0 保留为 follow 区并打标，一行不许改**。重分类时刻 = 第一次需要修改它的时刻。

清单（按文件点名）：`src/app/ai/chat/`（9 文件）、`src/components/chat/` 7 个 .vue + `attachment/`（**ACPPermissionDialog.vue 除外——它进删除区**）、`src/components/ChatPanel.vue`、`src/app/ai/providers/`（3）+ `models/`（6）、`src/app/ai/attachment/`、`src/app/ai/tools/`、`src/app/ai/vision-runtime.ts`、`src/app/automation/`（12）+ `packages/mcp` + `src/app/browser-bridge.ts`、`packages/cli`、`src/app/ai/debug/index.ts`、`.github/workflows/`（9 文件）。

⚠️ **已登记的内部冲突**：`browser-bridge.ts` 被 EditorView 用于 `exposeCollaborationActions(collab)`——collab stub 化时类型可能不配合。处置：给它预备补丁额度，或 stub 签名对齐 `useCollab` 返回类型。R3 实测，勿回避。

**重分类仪式**：① registry 改 owned；② 记录当时 upstream hash 打 tag（`reclass/<路径>/<hash>`）；③ 需同时裁剪的（如 mcp 砍对外功能）在重分类时刻做，不提前。

### 3.4 两条缝合缝

- **工具注册缝**：实测现状——`registry-core.ts`（CORE_TOOLS）/ `registry-extended.ts` / `registry.ts`（9 行组合 `ALL_TOOLS`）。缝 = registry.ts 加 1 行 spread（≤5 行，登记补丁）；零修改替代：owned 侧 `defineTool` 自建数组在消费侧合成。**好消息**：`component-catalog.ts` 的 `registerComponentCatalog` 是上游自有的注册式扩展先例，缝可仿照甚至上游化。
- **i18n 缝**：⚠️ 修正——`mergeLocaleMessage` 是虚构 API，上游用 `@nanostores/i18n`（createI18n/localeFrom）。缝按 nanostores API 重新设计（owned 组件组自建 i18n 实例取文案），约束不变：`packages/vue` 零修改。设计验证是 Phase 0 任务。

### 3.5 基础设施纪律

- `.lfsconfig` 实测内容 `[lfs] url = https://lfs.openpencil.dev`——指上游网关，必须改指自己的 LFS。CI checkout `lfs: true` 现状：10 处 checkout 仅 3 处有（ci.yml 2/3、heavy-tests.yml 1/1；build.yml 2 处全无）——**需补 7 处**，列入减法清单。
- `CHANGELOG.md` 永久保持上游原样；产品发版记录用 owned 新文件。
- 目录落位约定：core 工具以新文件落 `packages/core/src/tools/`（A 类纪律）；app 层落 `src/app/ai/` owned 子目录；UI 落 `src/components/chat/` owned 文件；`packages/agent` 在 Phase 0 **不存在**，Phase 1 出生。

## 4. 前置：旧分支 WIP 审判

旧分支未提交修改逐 hunk 登记性命（移植为补丁 / 可上游化 / 丢弃），清单在 tracker §4。清单不完，Phase 0 不算完。

## 5. 验收标准（逐条可执行）

1. `git diff upstream/master..HEAD` 只有：删除 + owned 区新文件（registry/stub/缝/CI）+ 登记的切断补丁。出现产品功能代码 = 失守。
2. follow 区纯净检查脚本通过（登记补丁除外，逐字节一致）。
3. CI 全绿：build + tsgo + vue-tsc + 单测（checkout 带 `lfs: true`）。
4. 冒烟：dev 与 preview 均启动正常；打开含中文 .fig（验证字体 LFS 真拉下来），画布渲染正常，能保存。
5. **合并演习**：upstream 已漂移至 `4e48420a`（+1 commit），现成素材；预期接近零冲突。
6. 旧分支 `feature/agent-backend` 保持可发布状态不动。

## 6. 不属于 Phase 0 的（护栏）

`packages/agent`、营销工具、brand config、需求单、引擎行为补丁、serve 形态、rebrand——各有阶段和验收。唯一例外是缝合缝本身（机制，不是功能）。
