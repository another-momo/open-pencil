# Fork 与 upstream 差异全景与演进策略

> 基线：2026-08-04，`merge/upstream-2026-08` 分支已同步至 upstream `de8578c4`（72 commits 三阶段合并完成）。
> 用途：fork 治理的单一参考——差异在哪、哪些可丢、哪些该重构、哪些冗余先接受。
> 维护规则：每次合并 upstream 后刷新 §2 的文件清单与 §3 的处置状态；处置决策的变更记录追加到文末 §6。

---

## 1. 现状基线

- fork 点：`8561d73e`（2026-07-21）；2026-08-04 完成 72 commits 合并（三阶段：`e358a44a` / `e213f7ce` / `2267bb95`）。
- 当前差异：**176 文件（108 新增 / 68 修改 / 0 删除），+16,736 / -844**。
- 关键结构事实：**新增面（A 类）合并零风险**；冲突只来自 68 个修改面（M 类）文件，且本次合并实测冲突高度集中——真正反复撞的不到 10 个文件。
- fork 无删除（D 类 = 0）：fork 从未删除任何 upstream 文件，这是好纪律，继续保持。

---

## 2. 差异全景

### 2.1 A 类：fork 新增（108 文件，合并零冲突风险）

| 域 | 文件 | 说明 |
|---|---|---|
| L2 营销工具 | `packages/core/src/tools/marketing.ts` + `marketing/` 9 文件 | setup / validate / restore / registry / library / clone / brief / look / vision |
| L1 生图 | `packages/core/src/tools/image-gen.ts` + `image-gen/` 3 文件 | generate_image 重构（references/id 解耦、超时、错误解析） |
| 上下文工程 | `src/app/ai/chat/elision.ts`、`media-tool-results.ts`、`system-prompt-marketing.md` | K=2 媒体省略 + chat-completions 改写 + 营销 prompt |
| L3 工作台 | `src/components/L3/`、`src/components/chat/Marketing*.vue`、`ProfileGalleryDialog.vue` | 需求单、config bar、库 dialog、profile gallery |
| 营销 app 层 | `src/app/ai/marketing/` | library 加载/overlay/bind |
| 资源库 | `public/default-library.fig`、`tools/marketing-library/` | 构建期资产 + 生成器 + 回环测试 |
| 营销字体 | `public/AlibabaPuHuiTi-*.ttf` × 9 | 62MB（见 §3.4 体积问题） |
| 文档体系 | `docs/plans/`、`docs/review/` | upstream 零触达 |
| 测试 | `tests/engine/tools/marketing/`（8 文件 68+ 用例）、`tests/engine/chat/`（2 文件）、`tests/engine/app/marketing-library.test.ts` | fork 自维护回归基线 |

### 2.2 M 类：修改 upstream 原文件（68 文件，合并冲突唯一来源）

按 2026-08-04 合并实测的冲突烈度分三级：

**高危（每次大合并几乎必撞，应让 fork 修改趋近于零）**

| 文件 | fork 改动 | 本次合并实况 |
|---|---|---|
| `src/app/ai/chat/storage.ts` | imageGen/vision/chatMode/marketing 状态 + watchers | 三个阶段撞了两次；upstream 凭证体系 + model profiles 两轮重写都经过这里 |
| `src/app/ai/chat/transports.ts` | elision/rewrite 钩子、marketing overlay、chatMode | 模型创建被 upstream runtime 取代，语义级合并 |
| `src/app/ai/chat/use.ts` | useAIChat 导出扩展 | 跟随 storage.ts 撞 |
| `src/components/settings/SettingsDialog.vue` | 挂 fork 的 4 个 Section | upstream 两轮重写（设置 dialog → ModelsPanel） |
| `packages/vue/src/i18n/messages/dialogs.ts` + 8 个 locale json | 营销文案 key | 双方都追加，每次必撞（机械但烦） |
| `CHANGELOG.md` | fork 发版记录 | 双方都写 Unreleased，每次必撞 |
| `.github/workflows/build.yml` | fork 发版策略（-152 行大删） | 结构性冲突，只能手工 |
| `src/app/document/io/save.ts` / `write.ts` | createWritable 失败降级 | upstream 存储史诗重写同一条链路 |
| `.lfsconfig` | fork 的 LFS 指向自己的 GitHub LFS（`0e37d170`） | upstream 若改此文件（如迁移网关，上次是 `5f13dc2e`），合并时必须**保留 fork 版**——误采用 upstream 版会让 CI 的 LFS pull 立刻失效（无凭证），且故障表现为测试红而非合并冲突，极难察觉 |

**中危（大改动时才撞）**

`packages/core/src/design-jsx/render.ts`（JSX 容错 vs upstream 功能扩展）、`packages/core/src/clipboard.ts` + `editor/clipboard.ts`（guid 防碰撞）、`src/components/chat/ChatInput.vue`（营销按钮 vs upstream 设置入口）、`src/app/ai/chat/model.ts`（vision copy-main 的 resolve 函数）、`packages/core/src/io/formats/raster/render.ts`（JPEG quality）、`packages/scene-graph/src/index.ts` / `instances.ts`、`src/components/settings/provider/ProviderSettingsKeyField.vue`、`src/components/ChatPanel.vue`。

**低危（纯追加或 upstream 冷区，实测不撞）**

`packages/core/src/tools/index.ts`（+44/-0 纯追加导出）、`tools/registry-core.ts`（+8/-0）、stock-photo 系列、fonts 系列（普惠体打包）、`tools/calc.ts`、`tools/describe/issues.ts`、`tools/structure/*`、`packages/fig` 2 文件、`desktop/tauri.conf.json`（1 行）、`vite/server.ts`（dev server 图片投递）、`src/components/CodePanel.vue`（1 行 import 改向 fork 新增的 `src/components/prism.ts`，见 §6 2026-08-06）、`src/app/automation/mcp/spawn.ts` 与 `src/components/settings/provider-select/ProviderSelect.vue`（MCP 不可用会话级记忆，各 2 处小 hunk，见 §6 2026-08-06）、`AGENTS.md`、测试文件。

---

## 3. 处置总表

### 3.1 核心资产（保留，不动）

| 改动 | 不动的理由 |
|---|---|
| marketing 工具链（core 内） | 产品内核；注册点纯追加，upstream 两年没碰过这两个注册文件；抽包反而要公开 core 内部 API，制造新冲突面 |
| 视觉回路（look + elision + media rewrite） | 产品差异化核心；elision/media-tool-results 是纯函数新文件，零冲突 |
| library 体系（.fig + 生成器 + dialog） | 品牌资产载体，Path A 命门 |
| L3 工作台 / 需求单 / MarketingConfigBar | 全是新文件 |
| AI undo coalesce、system-prompt-marketing | 新文件或 fork 自有文件 |

### 3.2 可丢弃（按优先级，附触发条件）

| # | 丢弃对象 | 触发条件 | 收益 |
|---|---|---|---|
| D1 | **vision 凭证体系**：`visionApiKey`/`visionBaseURL`/`visionModel`/`visionProvider` 4 个 ref、`VisionKeysSection.vue`、storage.ts 两组 watcher、context.ts 的 copy-main 机制 | **先把 `look` 通道 B 迁移到 `createAIModelRuntime('vision')`**（upstream model profiles 自带 vision 角色，'design' 继承语义天然对应通道 A/B） | 删 ~200 行 + 1 个组件；storage.ts 冲突面减半；凭证进入系统级 credential store；消除 §3.3 的 vision.ts 单例债 |
| D2 | fork 自己的 legacy key 迁移、pexels/unsplash localStorage refs、ProviderSettings 弹窗、`uint8ArrayToBase64` | **已丢弃**（2026-08-04 合并中被 upstream 新体系自然淘汰） | 记录备查：每次合并都是丢弃冗余的窗口 |
| D3 | `write.ts` 的 createWritable 降级逻辑 | upstream 若引入同类失败处理即丢弃 fork 版 | 当前保留（产品行为，测试已按 fork 语义固化） |
| D4 | fork 对 `packages/vue` i18n 的 8 语言翻译债 | 若决定只做 zh-cn + en，可丢弃其余 6 语言的 marketing key（未翻译本身就是半成品） | 与 R1 二选一，见下 |

### 3.3 可调整架构（目标是让高危文件回归 upstream 原样）

按"冲突收益 / 实施成本"排序：

| # | 重构 | 现状 → 目标 | 预期收益 | 成本 |
|---|---|---|---|---|
| R1 | **i18n 独立组件组** | fork 营销文案塞在 `packages/vue` 的 dialogs（9 文件）→ 在 `src/` 建 fork 自有的 i18n 组件组（`@nanostores/i18n` 按组件分组，fork 组件改从 fork 文件取文案），`packages/vue` 零修改 | **消灭每次必撞的 9 个文件**；附带解决"8 语言翻译债"（fork 只维护 zh-cn + en） | 中：文案搬迁 + 10 余个组件改 import；需先验证 nanostores/i18n 多组件组在 vue 侧的用法 |
| R2 | **fork 设置状态抽离** | `storage.ts` 里 fork 增量（imageGen/vision/chatMode/marketing refs + watchers + D1 之后剩余的）→ 抽到 `src/app/ai/marketing/settings.ts` 等 fork-owned 模块，`storage.ts` 回归 upstream 原样 | **消灭最高危文件的冲突**；与 D1 天然同批做 | 小：纯搬迁 + 改 import；注意 watchers 的注册时机 |
| R3 | **CHANGELOG 分家** | fork 发版记录写在 upstream 的 `CHANGELOG.md` → 移到 `CHANGELOG.fork.md`（或 `docs/` 下），`CHANGELOG.md` 永远采用 upstream 版 | 消灭每次必撞 | 极小 |
| R4 | **build.yml 策略** | fork 大删版（-152）vs upstream 版 | 选项 a（维持现状）：每次手工合并，冲突量小可接受；选项 b（恢复 upstream 原样 + 独立 `build-fork.yml`）：零冲突但要维护两份发版逻辑。**当前建议 a**，upstream 改 build.yml 频率低 | — |
| R5 | transports.ts 钩子封装 | fork 的 prepareCall/prepareStep 逻辑内联在 transports.ts → 封装为 transport 装饰器/中间件模块，transports.ts 本体贴近 upstream | 消灭第二高危文件 | 大：侵入 chat 主链路，需要 transport 层测试先行（正好补 review §3.2-6 的测试盲点）。**暂缓**，等 R1/R2 落地后评估 |
| R6 | SettingsDialog/context 收敛 | fork 4 个 Section 挂在 upstream dialog 上，context.ts 为 fork-owned 裁剪版 | 随 D1 自然收敛（Vision/ImageGen 迁移后只剩 ChatMode/LookImagesKept 两个小组件，可直接挂 dialog 不需要独立 context） | 是 D1 的副产品，不单列任务 |

### 3.4 短期接受的冗余（明确表态：现在不动，不视为债务）

- **fork 4 个 settings Section 与 upstream ModelsPanel 并存**——功能不重叠（chat model 选择 vs vision/imageGen 凭证），UI 两个体系但各自可用；D1 落地时自然收敛。
- **imageGen 凭证独立体系**——upstream 的 connection 模型理论上能容纳"生图 provider"，但 upstream 没有对应角色，强行挂靠反而创造耦合；保留独立的 3 个 ref + Section。
- **62MB 普惠体进 `public/`**——P4 已知问题。web 端体积是真实成本，但"延迟加载/仅桌面打包"方案需要字体加载链路改造，收益排期在产品功能之后。
- **`ChatPanel.vue` / `ChatInput.vue` 的混合状态**——fork 按钮与 upstream 入口并存，语义清晰，冲突小。
- **`docs/review/` 旧评审引用过期路径**（如 core 侧 library.ts）——落档不改是纪律，过期路径作为历史记录保留。
- **ACP / collab 保留不启用**——upstream 触达极低（2 / 0 commits），物理删除无合并收益。

### 3.5 减法（upstream 代码，与 fork 改动无关，独立 PR 做）

- **可删**：`packages/cli`、`packages/mcp`、`packages/demos`、`packages/docs`（fork 0 import，~25K 行）。合并面收益仅 7.4%，但 install/lint/CI 时间与认知负担收益是真实的。删除时的配置同步点已盘点（根 package.json workspaces/scripts、tools/release-packages、tools/type-shapes、lint/plugin.js、steiger support.ts、docs.yml）。
- **不可删**：`packages/pen`（core io 层依赖它打开 .pen 文件，且 upstream 零触达）。

---

## 4. 判断原则（给未来的自己）

1. **新增优于修改**：fork 功能优先写新文件。这次合并证明 108 个新文件零冲突，68 个修改文件贡献了全部冲突。
2. **改 upstream 文件之前先问：upstream 是否已有同方向机制？** 有就迁移过去并丢弃 fork 版（vision role 之于 vision 凭证、models store 之于 provider refs、credential store 之于 localStorage key，都是这个模式）。
3. **每次合并是丢弃冗余的窗口**：upstream 的重构会自然淘汰 fork 的补丁（本次淘汰了 4 项），合并时主动识别"fork 改动已被 upstream 吸收"的情况，不要保留双份。
4. **冗余可接受的标准**：不妨碍合并、不妨碍功能、有明确收敛路径、收敛成本低于现在处理的成本。§3.4 的每一项都满足这四条。
5. **"每次必撞"文件的 fork 修改应趋近于零**：storage.ts、i18n、CHANGELOG、build.yml、SettingsDialog。要么抽离（R1/R2/R3），要么接受手工合并（R4）。

---

## 5. 运营节奏

- **合并频率**：每月一次小合并（参考成本：本次 72 commits 攒了 14 天，合并耗时约 1.5 天；月更每次预计 0-5 个冲突文件）。
- **合并 SOP**（本次验证有效）：
  1. 在专用分支操作（`merge/upstream-YYYY-MM`）
  2. 分段合并：先合到大重构 commit 之前，再单独处理重构段
  3. 硬冲突文件用"以 upstream 新结构为基座重新移植 fork 功能"，不逐 hunk 解
  4. 每段合并后：`bun install && bun run build:packages && tsgo --noEmit && vue-tsc --noEmit && 定点测试`（上次失败合并丢 imports 的教训——typecheck 是兜底）
  5. 全量测试交给 CI（本机性能有限）
- **合并前预读**：§2.2 高危组文件的 upstream 近期改动（`git log --oneline <merge-base>..upstream/master -- <file>`）。

---

## 6. 处置决策变更记录

- 2026-08-04：文档建立。D2 四项已随合并丢弃；`uint8ArrayToBase64` → upstream `encodeBase64`、`Uint8Array.fromBase64` → `decodeBase64`（顺带修了 vue-tsc 对 TS 5.8 的报错）。
- 2026-08-04：**R2 已落地**（`9f109acf`）——fork 设置状态迁至 `src/app/ai/marketing/settings.ts`，`chat/storage.ts` 与 upstream 逐字节一致。**R3 已落地**（`99f25cbf`）——fork 发版记录迁至 `CHANGELOG.fork.md`，`CHANGELOG.md` 与 upstream 逐字节一致。
- 2026-08-04：修复 review §3.2-3（restore 扫描深度不一致）——`restoreStateFromCanvas` 改为递归，与 `listDocumentLibraryNames` 对齐，补嵌套 group 回归测试（70/70 marketing 测试通过）。§3.2 六个实质缺陷至此全部清零。
- 2026-08-04：CI 首次全绿（run 30906679583）。红源 #1（格式漂移，21 个 fork 文件 oxfmt 修复，`062cb3fc`）与红源 #2（LFS 指向上游私有网关 → 改指 fork 的 GitHub LFS 并上传 15 对象/228MB，`0e37d170`）均清零；quality 链条后续暴露的 lint/arch/type-shapes 问题同批修复（`eb2a2973`/`104a21e7`/`efd2fb3c`/`1fc8b4b8`/`d1c5d713`）。**`.lfsconfig` 列入 §2.2 高危清单**——fork 必须永远指向自己的 GitHub LFS。
- 2026-08-06：修复生产构建启动即崩（`5c7724f2`）——`prism-jsx` 引用裸全局 `Prism`，而 `prism.js` 仅在 `typeof global !== 'undefined'` 时赋值，浏览器 bundle 中永不成立 → `ReferenceError` 杀死模块图，app 停在 boot-splash（web preview 与 Tauri 包同症；dev 正常是因为 esbuild 预打包垫了 `global`）。经 worktree 对照实验确认 **upstream e6ba419e 同样复现，非 fork 改动引入**。修法：新增 `src/components/prism.ts`（显式挂 `globalThis.Prism`），`CodePanel.vue` 改 1 行 import 指向它。**若 upstream 日后修复此问题，合并时丢弃 fork 这个 hunk 即可**。教训：web 版只跑 dev 验证不出生产构建问题，发 Tauri 包前应过一次 `vite build && vite preview` 冒烟。
- 2026-08-06：修复 Tauri 包字体损坏与卡顿（`ae2f1050`）——`build.yml` 的 checkout 漏了 `lfs: true`（`ci.yml` 有），打包进应用的 18 个普惠体 ttf 全是 LFS 指针文本（启动报 `invalid sfntVersion: 1986359923`，即指针头 `"vers"`），普惠体不可用导致全部中文走 `ensureFallbackPack` 联网下载回退字体，表现为持续卡顿 + 高内存；dev 本地文件是真字体故无感。已验证 fork 的 GitHub LFS 上字体对象齐全（`git lfs fetch` 重下成功）。**教训：新增依赖 LFS 产物的 CI job 时必须核对 checkout 的 `lfs` 开关；fork 特有的 `public/AlibabaPuHuiTi*.ttf` 与 `packages/core/assets/*.ttf` 都在 LFS 里。** 另记录：Tauri 生产模式 `spawnMCPIfNeeded` 在无全局 `@open-pencil/mcp` 的机器上有一次有界的启动报错爆发（spawn + 5 轮 health 轮询 + ProviderSelect 健康检查），营销场景不需要 ACP，后续可考虑关闭或失败即不重试。
- 2026-08-06：MCP 报错爆发收敛 + clipboard.ts 回归 upstream（`cde5e59d`）——新增 `src/app/automation/mcp/availability.ts`（fork 自有），`spawn.ts` 与 `ProviderSelect.vue` 各打 2 处小 hunk：首次探测失败后本会话不再重复健康检查爆发（此前每开一个设置面板就多一轮 3×2s 超时）。`shell/keyboard/clipboard.ts` 删除调试 warn 后与 upstream 逐字节一致（移出 M 类）。`spawn.ts`、`ProviderSelect.vue` 自此进入 M 类低危清单。
- 2026-08-06：修复 Tauri 开大文件内存飙升/崩溃（`81a6b3ee`）——Tauri 命令返回 `Vec<u8>` 时 IPC 走 JSON 数字数组（每字节 ~4 倍文本 + JS 侧 ~8 倍堆），15MB 的 CJK 字体 / 数 MB 的字体子集下载单次调用产生 100+MB 瞬时堆，弱机上开大文档直接 OOM。`desktop/src/fonts.rs` 与 `desktop/src/http.rs` 改为返回 `tauri::ipc::Response` 原始字节（http 侧帧格式 `[4字节LE长度][JSON元信息][原始body]`），JS 侧 `fonts/index.ts`、`src/app/tauri/http.ts` 同步。**`desktop/src/fonts.rs`、`desktop/src/http.rs`、`src/app/tauri/http.ts` 自此进入 M 类低危清单**；upstream 若改 IPC 形态（如官方修此问题）需人工对齐。待办：`build_fig_file`（保存链路）的入参/返回仍是 JSON 数组，保存大文件时有同类开销，暂未修。
- 2026-08-06：修复 CJK 字体回退内存炸弹（`fd8618a1`）——Tauri 专属双重泄漏（浏览器 dev 无 host loader 故永不触发）：①fontManager 回退循环直调 `loadHostFont` 绕过自身缓存，每次文字/字体操作都经 IPC 重拉最多 7 个完整 CJK 系统字体（~100MB）并以新 ArrayBuffer 重复注册进 CanvasKit（WASM 内存不释放）；②`ensureFallbackFamilies` 把全部候选本地族都加载。修法：fork 侧 `loadSystemFont` 加会话级缓存（同引用返回使 registerAndCache/CanvasKit 去重生效），`packages/core/src/text/fonts.ts` 回退循环首个可用族即 `break`（1 处 hunk，**该文件自此进入 M 类低危清单**；upstream 若动回退逻辑需人工对齐）。症状实锤路径：设字体→缺字形→回退级联→OOM。
- 2026-08-11：海报感实验分支（`feature/poster-quality-experiment`，相对父分支 23 commits）的 M 类登记——本分支 26 个改动文件中 22 个为 A 类零风险，合并面增量集中在 4 个文件，全部属于同一条逻辑线程（look 原位合成导出的 render 管道，`renderInContext`/`clip`/`renderScale`）：
  - **`packages/core/src/io/formats/raster/render.ts`（中危，深化）**：既有 4 行分歧（JPEG quality）深化为 ~47 行——`renderToSurface` 的 renderScale 固定 2 改为 `Math.max(2, scale)` 跟随输出尺度（消 >2x 放大的线性上采样模糊）；`renderNodesToImage` 的 extractExportGraph 改为条件化（`renderInContext` 或 blend/BACKGROUND_BLUR 需求时渲染活页而非抽取选区）。**注意这不是纯追加，是控制流重构**——upstream 若动选区导出逻辑需语义级合并。已知风险：renderScale 无像素预算上限（大画布高倍导出内存回归，待办 M2 将再碰此文件）。不启用 `renderInContext` 时行为与 upstream 一致。
  - **`packages/core/src/figma-api/index.ts`（新入 M 类低危）**：父分支零分歧；本分支给 `exportImage` options 加 2 个可选字段（`renderInContext`、`clip`）。纯追加类型字段，冲突概率低。
  - **`src/app/automation/bridge/figma-factory.ts`、`src/app/document/export/files.ts`（M 类低危，深化）**：父分支已有 look 工具的 exportImage 接线小分歧，本分支各 +12~14 行可选参数透传，hunk 小且集中在同一调用点。
  - **`packages/core/src/tools/registry-core.ts`（低危，模式不变）**：沿用纯追加模式 +6 行（sample_hero_color / compose_backdrop 注册）。
  - 另：`packages/core/src/tools/structure/batch.ts` 本分支未动，但待办 T1（batch_update 对不支持 props 静默 updated:0 改为 errors 报告）将深化该文件既有低危分歧（51 行，R3-1 的 JSON 救助路径），届时沿用同一低危模式即可。
