# 终态跟随模型：三区分类全视图

> 状态：已定案 | 日期：2026-08-18
> 背景：从「fork 全量合并」转向「有限范围跟随」的终态架构。本文给出仓库每个文件/目录的分区归属与处置方式，作为上游合并、功能精简、Pi SDK 迁移的统一依据。
> 数据来源：`git diff $(merge-base HEAD upstream/master)..HEAD`（228 commits 分叉：227 新增 / 118 修改 / 0 删除上游文件）；`upstream/master` @ 15bd0ba1（领先 merge-base 72 commits）。
> 关联文档：`docs/idea/2026-08-12-productization.md`（产品化总方案）；`docs/idea/2026-08-13-localhost-serve-form.md`（形态）；`docs/idea/2026-08-18-pi-sdk-migration.md`（agent 内核）

---

## 0. 分区定义与图例

| 分区 | 含义 | 合并时行为 |
|---|---|---|
| **跟随区** | 上游代码，永久跟随 | 正常三方合并，零心智 |
| **拥有区** | 我们的代码（含从上游"重分类"过来的） | 不参与合并，冲突不可能 |
| **删除区** | 上游代码，删掉 | 上游再碰 → D/M 冲突，脚本自动 `git rm` |
| **补丁点** | 跟随区内带我们修改的文件（交叉区） | 清单登记，冲突人工看 |
| **stub 壳** | 拥有区小文件，让跟随区对删除区"无感知" | 不参与合并 |

补丁点四色处置：**重分类**（宣布拥有，交叉消失）/ **缝合外移**（改动搬到自有文件，上游文件恢复纯净）/ **上游化**（通用修复提 PR，被收后交叉消失）/ **保留补丁**（消不掉，编号管理）。

---

## 1. 顶层文件与目录

| 路径 | 状态 | 分区 | 处置 | 说明 |
|---|---|---|---|---|
| `src/` | 上游+修改 | 跟随区 | 正常合并（模块细分见 §2-§4） | 编辑器应用壳，448 文件 |
| `packages/` | 混合 | 细分见 §5 | — | 引擎 + 自有包 |
| `desktop/` | 上游+修改(2) | **删除区** | 删除 | Tauri 壳，产品形态已否决 |
| `docs/`（根目录） | 基本全是我们新增 | **拥有区** | — | plans/review/idea/research 内部文档 |
| `tests/` | 混合 | 细分见 §6 | — | |
| `tools/` | 混合 | 细分见 §6 | — | |
| `public/` | 混合 | 细分见 §6 | — | |
| `.github/workflows/` | 上游+深度定制 | **拥有区（重分类）** | 不再跟随上游 workflow，手动参考 | build.yml 已改 152 行、setup-bun 是我们加的；跟随意义已失 |
| `lint/`、`oxlint.json` | 我们的 | 拥有区 | — | 自定义 lint 规则 |
| `CHANGELOG.fork.md` | 我们的 | 拥有区 | — | fork 变更纪律 |
| `CHANGELOG.md` | 上游+修改(78) | 重分类→拥有区 | rebrand 时重写为产品 changelog | 此后上游 changelog 只读参考 |
| `README.md` | 上游+修改(16) | 重分类→拥有区 | rebrand 时重写 | 同上 |
| `AGENTS.md` | 上游+修改(36) | 重分类→拥有区 | 持续维护 | agent 工作约定本就该按我们的流程写 |
| `LICENSE` | 上游 | 跟随 | rebrand 时加自己版权声明（保留 Danila） | MIT 义务 |
| `package.json` / `bun.lock` / `tsconfig*.json` / `bunfig.toml` | 上游+修改 | 跟随区 | 冲突机械解决（lockfile 重新生成） | 根配置不可避免共享 |
| `vite.config.ts` / `vite/` | 上游+修改 | 跟随区+补丁 | PWA/automation 切断点登记 | |
| `index.html` / `components.d.ts` / `knip.json` / `steiger.config.ts` / `playwright.config.ts` | 上游 | 跟随区 | — | |
| `dist/` / `test-results/` / `node_modules/` | 生成物 | — | 不入库 | |

---

## 2. `src/` 根与视图

| 路径 | 状态 | 分区 | 处置 | 说明 |
|---|---|---|---|---|
| `src/main.ts` | 上游 | 跟随区+**切断补丁** | 删 PWA 注册（1-2 行补丁） | |
| `src/App.vue` / `src/app.css` / `src/theme/` | 上游 | 跟随区 | — | rebrand 时主题另议 |
| `src/router.ts` | 上游 | 跟随区+**切断补丁** | 删 `/share/:id` 路由（collab 附属，随 collab 删除） | |
| `src/views/EditorView.vue` | 上游+间接修改 | 跟随区+**切断补丁** | 删 demo import（1 处）；automation 连接逻辑保留（serve 底座） | |
| `src/views/StorageView.vue` | 上游 | 跟随区 | S3 云文档管理器页，随 S3 保留不宣传 | |
| `src/constants.ts` / `src/env.d.ts` 等 | 上游 | 跟随区 | — | |

## 3. `src/app/` 模块

| 路径 | 状态 | 分区 | 处置 | 说明 |
|---|---|---|---|---|
| `app/ai/chat/` | 上游+重改(400+行) | **重分类→拥有区** | Pi SDK 迁移在此发生；上游 chat 改进不再流入，手动参考 | 交叉区最大头的消法 |
| `app/ai/marketing/` | 我们新增(4) | 拥有区 | — | 营销工作流 |
| `app/ai/providers/` `app/ai/models/` | 上游+修改(10) | 重分类→拥有区 | 模型目录/凭据是产品配置 | 上游 provider 新增手动移植 |
| `app/ai/tools/` | 上游+修改(56) | 拥有区 | 我们的工具装配层 | |
| `app/ai/acp/` | 上游 | **删除区** | 删除 + chat 组件里的 ACP 引用清除（chat 已拥有化，无补丁） | |
| `app/ai/debug/` | 上游+修改(101) | 重分类→拥有区 | debug 面板我们自己演进 | |
| `app/automation/` | 上游+修改(3) | 重分类→拥有区 | **serve 底座骨干**，browser-RPC 桥 | Pi SDK 迁移后仍是工具执行通道 |
| `app/browser-bridge.ts` | 上游+修改(14) | 拥有区 | transport 注入钩子 | |
| `app/collab/` | 上游 | **删除区** | 机制删除 + **collab-store stub**（软切断，EditorCanvas 零补丁） | 上游活跃区(#541)，硬切断会成为永久冲突点 |
| `app/demo/` | 上游 | **删除区** | 删除 + EditorView 切断补丁 1 处 | |
| `app/tauri/` | 上游 | **stub 壳** | 保留 no-op 实现让 18 处 `IS_TAURI` 动态 import 可解析；常量恒 false | **不切断就是最好的切断**：死分支零冲突 |
| `app/document/` | 上游+修改(4 文件) | 跟随区+补丁 | serve 文件 API 落地时补丁改写为 `/api/files` 分支 | |
| `app/editor/` | 上游+修改(fonts/index 37) | 跟随区+补丁 | 字体加载 serve 形态改造 | |
| `app/settings/` / `app/shell/` / `app/tabs/` / `app/cache/` | 上游+微改 | 跟随区 | — | |
| `app/storage/local-store/` | 上游 | 跟随区 | **基础持久化**（IndexedDB 文档库），App/tabs/save 均依赖，不可删 | |
| `app/storage/sync/` + `app/integrations/storage/` | 上游 | 跟随区 | S3 兼容云同步，可选高级能力，**保留不宣传** | |
| `app/code/`（CodePanel） | 上游 | 跟随区 | 保留，编辑器能力，低频跟随 | |
| `app/integrations/`（其余） | 上游 | 跟随区 | 素材图库（Pexels/Unsplash）保留 | |

## 4. `src/components/`

| 路径 | 状态 | 分区 | 处置 | 说明 |
|---|---|---|---|---|
| `chat/`（ChatPanel/ChatInput/ChatMessage + 营销组件） | 混合 | **重分类→拥有区** | 营销/brand/需求单 UI 是我们的；上游基础组件手动参考 | ACPPermissionDialog 随 ACP 删除 |
| `CollabPanel/` | 上游 | **删除区** | 删除 + 挂载点切断补丁 2-3 处 | |
| `MobileHud/` `MobileDrawer.vue` | 上游 | 跟随区+切断补丁 | presence popover 走 collab stub | 移动端 UI 低频跟随 |
| `SafariBanner.vue` | 上游 | **删除区** | localhost 形态无 Safari 问题 + 挂载点 1 处 | |
| `EditorCanvas.vue` | 上游 | 跟随区（**零补丁目标**） | collab 切断靠 stub 吸收，不动这个文件 | 画布本体是跟随区正中心 |
| `settings/`（Provider 设置 UI） | 上游+修改(3 文件) | 跟随区+补丁 | 凭据 UI 小改保留 | |
| 其余 ~20 个目录（canvas/LayerTree/properties/inputs/ui…） | 上游 | 跟随区 | — | 编辑器核心 UI |

## 5. `packages/`

| 路径 | 状态 | 分区 | 处置 | 说明 |
|---|---|---|---|---|
| `packages/agent/` | 我们新增(33 文件) | **拥有区** | — | agent 后端 + brand 仓；Pi SDK 迁移主战场 |
| `packages/core/` | 上游+修改(~50 文件) | 跟随区+补丁集 | 补丁清单见 §7 | 引擎主体，跟随价值最高（#534/text-on-path） |
| `packages/core/src/tools/marketing/` | 我们新增(14) | **拥有区** | 营销专属工具（setup_material/compose_backdrop/generate_image/look…） | 注册走缝合缝 |
| `packages/core/src/tools/image-gen/` | 我们新增(4) | **拥有区** | 生图管线 | |
| `packages/scene-graph/` | 上游+修改(3) | 跟随区+补丁 | instances/font-style 小补丁 | #512 大改在此，合并重点 |
| `packages/fig/` | 上游+修改(2) | 跟随区+补丁 | | |
| `packages/vue/` | 上游+修改(i18n 9 文件) | 跟随区 | i18n 改动**缝合外移**（mergeLocaleMessage 从自有文件注入）；locale 收成 zh-cn+en 双语，8 个上游 locale 删除→index 1 处切断补丁 | 组件库跟随 |
| `packages/mcp/` | 上游+修改(2) | **重分类→拥有区** | serve 底座骨架；对外 MCP 功能砍 | 上游 MCP 演进不再跟随 |
| `packages/cli/` | 上游 | 重分类→拥有区 | 改造为 `changjuan serve` 产品入口 | |
| `packages/demos/` | 上游 | **删除区** | 删除 | |
| `packages/docs/` | 上游 | **删除区** | VitePress 文档站，上游维护量大、merge 噪音高；公开时自建产品文档 | |
| `packages/dom-css/` `pen/` `kiwi/` | 上游 | 跟随区 | — | 纯引擎，零交叉 |

## 6. `tests/` / `tools/` / `public/`

| 路径 | 状态 | 分区 | 处置 |
|---|---|---|---|
| `tests/engine/`（我们新增 ~40 + 修改上游 ~15） | 混合 | 跟随+拥有 | 我们新增=拥有；**修改的上游测试走 ours-wins 协议**（测试冲突不值得人工） |
| `tests/engine/tauri/` `tests/helpers/tauri/` | 上游 | **删除区** | 随 tauri 删除；wdio.conf.ts 同删 |
| `tests/e2e/` `tests/figma/` `tests/fixtures/` | 混合 | 跟随+拥有 | fixture 里的 .fig 是 LFS 大头，保留 |
| `tools/font-subset/` | 我们新增(3) | 拥有区 | 字体子集化 |
| `tools/architecture/` `unit-tests/` `type-shapes/` 等 | 上游+微改 | 跟随区 | |
| `tools/tauri-menu/` | 上游 | **删除区** | 随 tauri |
| `tools/release-packages/` | 上游 | **删除区** | 我们不发 npm 包 |
| `public/AlibabaPuHuiTi-*.ttf`（9） | 我们新增 | 拥有区 | 内置中文字体（LFS 大头） |
| `public/default-brand/` | 我们新增 | 拥有区 | 出厂 brand config |
| `public/canvaskit.wasm` `Inter-*.ttf` 等 | 上游 | 跟随区 | |
| `public/_headers` `_redirects` | 上游+修改 | **删除区** | Cloudflare Pages 部署已淘汰 |

## 7. 交叉区补丁清单（118 个修改文件的四类处置）

**当前：118 文件 / +3,093 / −1,114。目标：收敛到 ~15 个编号补丁点。**

| 分组 | 文件 | 行数 | 处置 |
|---|---|---|---|
| chat 层 | `ai/chat/transports.ts`(182) `use.ts`(81) `model.ts`(50) `system-prompt.md`(3) | ~320 | **重分类**→拥有区 |
| debug | `ai/debug/index.ts`(101) | 101 | **重分类** |
| i18n | `vue/i18n/messages/dialogs.ts`(80) + 8 locale JSON(各69) | ~630 | **缝合外移**（mergeLocaleMessage）；8 locale 随双语决策删除 |
| 文档 | `CHANGELOG.md`(78) `README.md`(16) `AGENTS.md`(36) | 130 | **重分类**（rebrand） |
| mcp/serve | `mcp/browser-rpc.ts`(72) `mcp/rpc-types.ts`(7) `browser-bridge.ts`(14) `automation/bridge/figma-factory.ts`(11) `automation/mcp/spawn.ts`(5) `vite/automation.ts`(8) `vite/server.ts`(11) | ~130 | **重分类**→拥有区（serve 底座） |
| chat UI | `ChatInput.vue`(63) `ChatMessage.vue`(36) `ChatPanel.vue`(33) | 132 | **重分类**→拥有区 |
| 模型/凭据配置 | `providers/registry.ts`(7) `models/catalog.ts`(3) `SettingsDialog.vue`(13) `ProviderSettingsKeyField.vue`(13) `ProviderSelect.vue`(9) | 45 | **重分类**/微补丁 |
| 工具注册 | `tools/registry-core.ts`(75) `tools/index.ts`(61) `tools/registry-extended.ts`(5) `ai/tools/index.ts`(56) | ~200 | **缝合外移**：加 1 处动态注册缝，营销工具注册移自有文件 |
| 上游测试 | `structure.test.ts`(91) `fonts/loading.test.ts`(591) `browser-rpc.test.ts`(93) `access.test.ts`(47) `registry.test.ts`(45) `create.test.ts`(44) `html.test.ts`(38) `render-tree.test.ts`(35) `model.test.ts`(25) `stock-photo/requests.test.ts`(26) `source-identity.test.ts`(15) `acronym-casing.test.ts`(15) 等 | ~1,100 | **ours-wins 协议**；tauri 测试删除 |
| **引擎行为补丁（保留，编号管理）** | `design-jsx/render.ts`(97) `canvas/fills.ts`(38) `constants.ts`(49) `canvas/renderer.ts`(20) `scene-graph/instances.ts`(12) `fig/export-node.ts`(19) `tools/structure/batch.ts`(61) `tools/ai-adapter.ts`(36) `tools/describe/issues.ts`(32) `io/raster/render.ts`(31) `text/fonts.ts`(25) `editor/history/snapshot.ts`(24) 及其余 ~30 个 ≤20 行的长尾 | ~800 | **保留补丁**：逐个审查，通用修复（fill/stroke backfill、missing visible 默认值等）**上游化**，营销专属留清单 |
| 文档/文件 IO | `document/export/files.ts`(18) `document/io/write.ts`(17) `document/io/save.ts`(5) `editor/fonts/index.ts`(37) `tabs/index.ts`(6) | ~85 | serve 形态落地时改写（临时补丁） |
| 删除区残留 | `tauri/http.ts`(12) `desktop/src/http.rs`(16) `desktop/tauri.conf.json`(2) `desktop/src/fonts.rs`(2) `build.yml`(168) `public/_headers`(4) `tauri/document-io.test.ts`(1) | ~205 | **随删除区消失** |
| 根配置 | `package.json`(6) `bun.lock`(54) `tsconfig.json`(14) `vite.config.ts`(6) `.git*`(5) | ~85 | 机械解决 |

## 8. 汇总数字

| 维度 | 数量 |
|---|---|
| fork delta 总量 | 345 文件，+40,470/−1,114 |
| 纯新增（永远零合并成本） | 227 文件 |
| 交叉区现状 | 118 文件 / ~3,100 行 |
| 交叉区目标 | **~15 个补丁点**（重分类消 ~1,300 行 + 缝合外移消 ~830 行 + ours-wins 测试 ~1,100 行 + 删除区带走 ~205 行，剩引擎行为补丁 ~800 行中的上游化部分还会再减） |
| 删除区边界切断点 | ~8 处硬切断 + 2 个 stub 壳（collab-store / tauri） |

## 9. 执行次序

1. 上游大合并（72 commits）——删除区冲突 accept-theirs 再删，火力集中在补丁清单文件
2. 重分类落地（chat/mcp/debug/文档/CI 宣布拥有）+ 缝合外移（i18n、工具注册缝）
3. 删除区执行 + stub 壳 + 切断点登记（含 collab 软切断 spike：确认 presence 渲染 runtime-gated）
4. 引擎补丁逐个审查：可上游化的提 PR，其余编号留清单
5. Pi SDK 迁移（全在拥有区，与跟随机制零耦合）
6. 产品化（rebrand 时 CHANGELOG/README 拥有化生效）
