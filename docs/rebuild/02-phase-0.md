# 02 · Phase 0：机制与减法（起点定义）

> 日期：2026-08-18 | 起点必须正确。Phase 0 不加任何产品功能，验收通过前不得进入 Phase 1。

## 1. 一句话定义

从 `upstream/master` 切出的本分支上，**只做减法和机制建设**，产出一个「会自己守纪律的上游跟踪骨架」。成功的样子：之后每次合并 upstream 都变成一件无聊的事。

## 2. 减法清单（删除即消失；均为上游代码）

| 删除对象 | 连带处理 |
|---|---|
| `desktop/`（Tauri 壳） | `src/app/tauri/` 改 stub 壳（`IS_TAURI` 恒 false，18 处动态 import 保持可解析——不切断就是最好的切断）；`tools/tauri-menu/`、tauri 测试、wdio 配置同删 |
| `src/app/collab/` + `CollabPanel/` | collab-store **stub 软切断**（上游活跃区，硬切是永久冲突点）；`/share/:id` 路由、presence 引用切断补丁 1-3 处，编号登记 |
| `src/app/ai/acp/` + `ACPPermissionDialog.vue` | chat 组件里的 ACP 引用清除 |
| `packages/demos/`、`packages/docs/`、`src/app/demo/`、`SafariBanner.vue`、`public/_headers`/`_redirects`、`tools/release-packages/` | EditorView 的 demo import 切断 1 处 |
| 8 个上游 locale | 收 zh-cn + en 双语，locale index 1 处切断补丁 |

**删除标准**：目标态不存在、且建设过程也不需要。不符合两条的不删，见 §3「待重分类」。

## 3. 机制建设（Phase 0 的核心）

### 3.1 zone registry（单一事实源，机器可检查）

- 一个 registry 文件（代码形态，非 markdown）列出每个路径的归属：**follow / owned / deleted / stub / patch / pending-reclass**。
- CI 检查：**follow 区文件被修改且不在补丁清单里 → CI 红**。这是把三区模型从文档变成会咬人的机制，也是对治文档腐烂的唯一办法。

### 3.2 补丁点登记制

- 编号补丁（P1、P2…）：文件 + hunk + 一句话理由 + 处置方向（上游化 / 永久保留）。
- Phase 0 结束时补丁集**只有减法切断点（~10 处），产品补丁为零**。

### 3.3 待重分类（pending-reclass）——不删，打标

目标态以自持形态存在、且现有代码是起点的上游部分，**Phase 0 保留为 follow 区并打标，一行不许改**。重分类时刻 = 第一次需要修改它的时刻（为跟随付费和停止跟随天然对齐）。

待重分类清单：`src/app/ai/chat/`、`src/components/chat/` 基础三件套、`src/app/ai/providers/` + `models/`、`src/app/automation/` + `packages/mcp` serve 骨架 + `browser-bridge.ts`、`packages/cli`、`src/app/ai/debug/`、`.github/workflows/`。

**重分类仪式**：① registry 改状态为 owned；② 记录当时 upstream commit hash 并打 tag（`reclass/<路径>/<hash>`），日后看「upstream 在我们接管后改了什么」永远是一条 diff 命令；③ 如需同时裁剪（如 mcp 砍对外功能只留 serve 骨架），裁剪发生在重分类时刻，不提前瞎砍。

### 3.4 两条缝合缝

- **工具注册缝**：core registry 保持上游纯净，owned 工具经扩展钩子注册（目标：`registry-core.ts` 零修改或 ≤5 行）。
- **i18n 缝**：`mergeLocaleMessage` 从 owned 文件注入文案，`packages/vue` 零修改。

### 3.5 基础设施纪律

- `.lfsconfig` 指向自己的 GitHub LFS（旧分支实测地雷：默认指上游网关，无凭证 CI 红，表现为测试失败而非合并冲突）；CI 所有 checkout 带 `lfs: true`。
- `CHANGELOG.md` 永久保持上游原样；产品发版记录用 owned 新文件。
- 目录落位约定（现在定死，移植时不许即兴）：core 工具以**新文件**落 `packages/core/src/tools/`（A 类纪律：新文件零冲突）；app 层落 `src/app/ai/` owned 子目录；UI 落 `src/components/chat/` owned 文件；`packages/agent` 在 Phase 0 **不存在**，随 runtime 选型在 Phase 1 全新出生。

## 4. 前置：旧分支 WIP 审判

旧分支未提交修改（实测：8 个引擎文件 + `setup.ts`/`transports.ts`/`ChatInput.vue`/`ProfileGalleryDialog.vue`/测试等，不在任何文档清单上）逐 hunk 登记性命：移植为编号补丁 / 可上游化 / 丢弃。清单不完整，Phase 0 不算完。

## 5. 验收标准（逐条可执行）

1. `git diff upstream/master..HEAD` 里只有：删除 + owned 区新文件（registry/stub/缝/CI）+ 登记的 ~10 处切断补丁。出现任何产品功能代码 = 失守。
2. follow 区纯净检查脚本通过（登记补丁除外，逐字节一致）。
3. CI 全绿：build + tsgo + vue-tsc + 单测（checkout 带 `lfs: true`）。
4. 冒烟：dev 与 preview 均启动正常；打开含中文的 .fig（验证字体 LFS 真拉下来了），画布渲染正常，能保存。
5. **合并演习**：把切分支后 upstream 新漂移的 commits 合一次，验证 SOP 成本，预期接近零冲突。
6. 旧分支 `feature/agent-backend` 保持可发布状态不动。

## 6. 不属于 Phase 0 的（护栏）

`packages/agent`、营销工具、brand config、需求单、引擎行为补丁、serve 形态、rebrand——各有阶段和验收，一律不进。唯一例外是缝合缝本身（机制，不是功能）。
