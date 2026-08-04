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

**中危（大改动时才撞）**

`packages/core/src/design-jsx/render.ts`（JSX 容错 vs upstream 功能扩展）、`packages/core/src/clipboard.ts` + `editor/clipboard.ts`（guid 防碰撞）、`src/components/chat/ChatInput.vue`（营销按钮 vs upstream 设置入口）、`src/app/ai/chat/model.ts`（vision copy-main 的 resolve 函数）、`packages/core/src/io/formats/raster/render.ts`（JPEG quality）、`packages/scene-graph/src/index.ts` / `instances.ts`、`src/components/settings/provider/ProviderSettingsKeyField.vue`、`src/components/ChatPanel.vue`。

**低危（纯追加或 upstream 冷区，实测不撞）**

`packages/core/src/tools/index.ts`（+44/-0 纯追加导出）、`tools/registry-core.ts`（+8/-0）、stock-photo 系列、fonts 系列（普惠体打包）、`tools/calc.ts`、`tools/describe/issues.ts`、`tools/structure/*`、`packages/fig` 2 文件、`desktop/tauri.conf.json`（1 行）、`vite/server.ts`（dev server 图片投递）、`AGENTS.md`、测试文件。

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
