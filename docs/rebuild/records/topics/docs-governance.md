<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/docs-governance.md · 文档体系治理

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent + owner 讨论
> **身份**：文档体系本身的修改记录、核查轮记录、文档腐烂记录。本文档是 records/ 子文档体系的根节点之一。

---

## 决策类

## D10 · 文档治理方案（plan-correction + 纪律块 + tracker拆分 + 元信息 + check-docs.ts）

- **类型**：决策
- **时间**：2026-08-20 18:00
- **拍板**：owner + 主 agent 讨论
- **内容**：采纳 4 节方案——①叙事文档 plan-correction 直接改原文，变更历史归 records/；②每个叙事文档前 15 行加 HTML 纪律提示块；③tracker.md 按对象拆分为 records/ 子文档；④统一头部元信息格式（状态/时间 HH:MM/核验人/身份/基线）；⑤写 check-docs.ts 格式校验脚本（3 条稳定规则先挂 CI，逐步加严）；⑥交叉引用禁裸 § 编号
- **依据**：Phase 0 完成后 review 暴露的四类问题（计划修正无定义、纪律不可见、tracker 会膨胀、交叉引用脆弱）。方案文件：[`docs/rebuild/proposals/governance-v1.md`](../../proposals/governance-v1.md)
- **本轮整改范围**：[05-process.md](05-process.md) 补 7/8/9 三条规则 + gate review 第 4 步；00/01/02/03/04 全部加纪律块 + 统一头部；[02-phase-0.md §0](02-phase-0.md) 删除（迁移至本文档「修正-2」）；[03-phase-1-runtime.md](03-phase-1-runtime.md) 附录 A 删除（迁移至 agent-runtime.md 修正-2）；tracker.md 拆分为索引 + records/*；新增 check-docs.ts

---

## 修正类

## 修正-2 · 02-phase-0.md v2 §0 执行期修正节迁移（已删除）

- **类型**：修正（按对象：02-phase-0.md）
- **时间**：2026-08-20 18:30
- **依据**：本轮整改 D10 决策（计划修正规则见 [`docs/rebuild/proposals/governance-v1.md`](../../proposals/governance-v1.md) §2.1）
- **原文位置**：02-phase-0.md §0「执行期修正」（8 条）
- **迁移去向**：本文件「02-phase-0.md 执行期修正明细」章节（保持原貌供审计）
- **影响**：02-phase-0.md §0 删除，正文（§1-§6）已同步体现新版本；02 头部加纪律块 + 统一 HH:MM 时间

## 修正-3 · 03-phase-1-runtime.md v3 附录 A 迁移

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-20 18:30
- **依据**：本轮整改 D10 决策
- **原文位置**：03-phase-1-runtime.md「附录 A：v3 相对 v2 的修订记录」
- **迁移去向**：`records/topics/agent-runtime.md` 修正-2 条目
- **影响**：03 附录 A 删除；03 头部加纪律块 + 统一 HH:MM

---

## 02-phase-0.md 执行期修正明细（保持原貌供审计）

> 以下 8 条原 [02-phase-0.md §0](02-phase-0.md) 内容，2026-08-19 实测推翻/细化了 02-phase-0.md 初版。已迁移至此，按 [05-process.md §4 纪律](05-process.md) 登记。

1. **src/app/tauri/ 不需要 stub**：实测它被 ~20 个 src 文件**静态** import（非动态），内部 `isTauri()` 运行时守卫。结论改为：保持上游纯净、一行不动；`@tauri-apps/*` runtime 依赖必须保留（vite build 需可解析），只裁 `@tauri-apps/cli` + `@wdio/*` 开发依赖。
2. **LFS 处置反转**：`.lfsconfig` 保持上游网关（匿名读实测可用）；fork 的 GitHub LFS **预算超额**（pull 被拒）；fixture 去 LFS 化被否（material3/nuxtui 合计 143MB，进普通 git 不可接受）。结论：LFS 面在本分支仅剩 6 个测试 fixture（canvaskit 已来自 npm）；未来新增 LFS 文件（如普惠体）前必须解决自有托管。补丁 P21 已撤销。
3. **workflows 实删 6 个**：build/docs/app/homebrew/deploy-preview/preview（桌面发布 + Cloudflare 系全死）；ci.yml 随上游 #558 重组后重删 native-test-contracts job。原「补 7 处 lfs:true」消失——剩余 job 的 checkout 本就有或不需要。
4. **i18n 缝落位修正**：上游 #557（合并演习带入）自建了应用级缝 `src/app/i18n/notifications/`（独立 createI18n 实例 + 共享 locale atom——与我们设计同构，验证方向正确）。我们的缝避让至 `src/app/i18n/fork/`；upstream notifications 的 7 个已删 locale loader 需同步裁剪（补丁 P24，satisfies Record<TranslatedLocale> 会类型报错）。
5. **EditorView 切断点实测 5+ 处**；MobileHud 的 share 死端（stub 返回空 roomId → 已删路由）一并移除（P12/P13 + MobileShareButton.vue 删除）。
6. **合并演习实战**（0332b062，8 commits 含 AI SDK 7 升级 #555）：冲突 10 文件——删除区 modify/delete 一律重删；配置类（package.json/ci.yml）以 upstream 新结构为基座重放我方修改；bun.lock 重生成。另发现 bun 缓存需 `rm -rf node_modules` 重装以清陈旧的依赖版本副本。详见 `records/topics/upstream-merge.md` MERGE-1。
7. **本机测试纪律**：Windows 本机全量 `bun test` 在负载下有环境性失败（ws 超时、网络、字体——纯净基线对照 14 个同源失败），以 CI 为准；定点隔离运行必须 0 fail。fixture 幻影 M（LFS 指针 vs 真实文件）**永不入库**。
   - 2026-08-19 起幻影 M 分类处置：**autocrlf 类已根除**——仓库级 `core.autocrlf=false` + 两个 worktree 已归一化为 LF（`git rm -r --cached . && git reset --hard`，LFS 真实文件先备份后回填）。旧分支文档记载的"271 个幻影 modified"问题自此消失。剩余 M 仅 LFS 类（真实 fixture/字体盖在指针上，本地测试需要，add 后经 clean 过滤器为 no-op，实测验证）。详见 `records/topics/ci-infra.md` P0-9。
   - 注意：此配置在 `.git/config`（不入库）。**新 clone/新 worktree 继承仓库级配置，但其他机器/其他仓库需各自设置**；新成员入职或换新机时执行 `git config core.autocrlf false`。
8. **冒烟意外收获**：本机 4173 端口曾被旧分支 PWA 的 Service Worker 占据，旧 bundle 幽灵复活（出现了已删除的分享按钮）——卸载 SW + 清 workbox 缓存后消失。PWA 删除的正确性得到反向验证。

---

## 核验类（核查轮 R1-R4）

## R1 · 00 事实清单核查

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent A
- **范围**：00-why-rebuild.md
- **结论**：大体成立；修正：缝 +75/−4 与 +61/−1（136 行新增）、8 个 profile、双份 prompt 副本、落后数 73、agent 42 文件含生成物、core ai-adapter 也耦合 'ai'、elision/media-rewriter 双份镜像、routes 五端点 + SQLite brand 覆盖层
- **影响**：00 已修正为 v2

## R2 · 01 组件与闭环依赖

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent B
- **范围**：01-target-state.md
- **结论**：端到端 9 环依赖链还原；能力地图漏 10 项（生图独立凭证链、MCP 桥三进程、brand 后端服务、聊天凭证下发、session 零持久化真相、validate 不存在、素材理解 phantom、生图历史已内置、视觉回路双份、ChatPanel 在根目录）→ 01 已重构
- **影响**：01 已修正为 v2

## R3 · 02 上游删除目标

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent C
- **范围**：02-phase-0.md 上游删除目标 + 配置连带面
- **结论**：删除目标均在；修正：locale 删 7 留 zh-CN、mergeLocaleMessage 虚构（实为 nanostores i18n）、IS_TAURI 37 处/16 文件、EditorView 切断点 5+、配置连带面（package.json/knip/steiger/oxlint）、browser-bridge 冲突、CI lfs 需补 7 处、registry.ts 9 行组合文件 + registerComponentCatalog 先例
- **影响**：02 已修正为 v2

## R4 · 03 前端契约 + dsh 实况

- **类型**：核验
- **时间**：2026-08-18 14:00
- **核验人**：subagent D
- **范围**：03-phase-1-runtime.md + dsh 本地仓库
- **结论**：前端 = @ai-sdk/vue Chat 类 + 自写 UIMessage stream v1 解析；dsh 实测：Cordis 插件、session 事件溯源、compaction 可替换 seam、ToolResultBlock 递归含 ImageBlock（适配器当前 text-only）、stdio 子进程嵌入、多 provider 实为 pi-ai@0.82.1；pi sdk 本地不可查 → 降级【假设】
- **影响**：03 已修正为 v2；后续 SP-2 推翻 pi sdk 不可查假设（earendil-works/pi 本地完整源码 v0.84.2）

## P0-8 · Phase 0 gate review 机械审计

- **类型**：核验
- **时间**：2026-08-19 16:30
- **核验人**：subagent A
- **范围**：zones.json 全项对账 + 02 全文矛盾扫描
- **结论**：patches P1-P24 全部真实、deletedPaths 44 条全落实、ownedRoots 零例外；发现 check.ts 4 漏洞 + 02 正文 7 处残留矛盾 + 2 处计数错 → 全部整改（02 头部修订 + 03-phase-1-runtime.md 早期版本若干处）；fonts 测试复跑 77/0 绿；PWA 零残留实证
- **影响**：[02-phase-0.md §5 验收标准](02-phase-0.md) 第 3 条标记 ⚠️→✅，phase 0 gate 通过

---

## V1-V4 · 首轮核查（精炼版）

- **V1**（2026-08-18）：分叉规模。`git diff $(merge-base)..HEAD --shortstat` → 230 前/73 后（含合并口径），229A/118M/0D，+41,177/−1,114（测量点 a1c33881）
- **V2**（2026-08-18）：营销+生图测试。`bun test ./tests/engine/tools/marketing ./tests/engine/tools/image-gen` → 16 文件全绿，运行时报告 224 通过
- **V3**（2026-08-18）：旧文档腐烂。`ls`/`git diff`/`find` → 5 处实锤，见 00-why-rebuild.md §5
- **V4**（2026-08-18）：本节未独立条目，已合入 R4

---

## 腐烂类

## ROT-1 · 01 v1 能力地图按价值分层

- **类型**：腐烂
- **时间**：2026-08-18 14:00（owner 初审发现）
- **文档**：01-target-state.md v1
- **错误**：能力地图按价值分层，闭环只列 C 块
- **实况**：缺支撑底座 F0，闭环跑不起来
- **处置**：v2 已重构

## ROT-2 · 01 v1 C1 含「素材图理解（hash 缓存）」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：01-target-state.md v1
- **错误**：C1 含「素材图理解（hash 缓存）」
- **实况**：R2 实测全仓无代码，phantom
- **处置**：v2 移入不加清单 + D8

## ROT-3 · 01 v1 validate 列为「后续移植/已废弃旧物」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：01-target-state.md v1
- **错误**：validate 列为「后续移植/已废弃旧物」
- **实况**：R2 实测无此工具注册
- **处置**：v2 改 C3c 新建

## ROT-4 · 01 v1 生图历史列为「后续独立加法」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：01-target-state.md v1
- **错误**：生图历史列为「后续独立加法」
- **实况**：R2 实测已内置于 generate_image
- **处置**：v2 已修正

## ROT-5 · 02 v1 locale 删 8 收 zh-cn+en

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：02-phase-0.md v1
- **错误**：locale 删 8 收 zh-cn+en
- **实况**：R3：上游 9 locale = en + 8 翻译（含 zh-CN），应删 7
- **处置**：v2 已修正

## ROT-6 · 02 v1 i18n 缝用 mergeLocaleMessage

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：02-phase-0.md v1
- **错误**：i18n 缝用 mergeLocaleMessage
- **实况**：R3：API 虚构，上游为 @nanostores/i18n
- **处置**：v2 已修正（缝按 nanostores 重新设计）

## ROT-7 · 02 v1 IS_TAURI「18 处动态 import」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：02-phase-0.md v1
- **错误**：IS_TAURI「18 处动态 import」
- **实况**：R3：37 处/16 文件、动态 import 29 处
- **处置**：v2 已修正

## ROT-8 · 02 v1 路由与切断点计数

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：02-phase-0.md v1
- **错误**：`/share/:id`、EditorView 切断 1 处、presence 1-3 处
- **实况**：R3：`:roomId`；EditorView 单文件 5+ 处
- **处置**：v2 已修正

## ROT-9 · 03 v1 pi sdk「有 AI SDK harness 适配器」作基线事实

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：03-phase-1-runtime.md v1
- **错误**：pi sdk「有 AI SDK harness 适配器」作基线事实
- **实况**：R4：本地无包无法证实
- **处置**：v2 降级【假设】；后续 SP-2 推翻（earendil-works/pi 本地有完整源码）

## ROT-10 · 00 v1 缝「+79/+62、~140 纯追加」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：00-why-rebuild.md v1
- **错误**：缝「+79/+62、~140 纯追加」
- **实况**：R1：+75/−4、+61/−1，136 行新增
- **处置**：v2 已修正

## ROT-11 · 00 v1 分叉「72 落后」

- **类型**：腐烂
- **时间**：2026-08-18 14:00
- **文档**：00-why-rebuild.md v1
- **错误**：分叉「72 落后」
- **实况**：R1：73（含合并口径）
- **处置**：v2 已修正

## ROT-12 · 02 v2 tauri 需 stub 壳

- **类型**：腐烂
- **时间**：2026-08-19 14:00
- **文档**：02-phase-0.md v2
- **错误**：tauri 需 stub 壳
- **实况**：Agent A 实测：静态 import 遍布 ~20 文件，保持纯净 + 保留依赖即可
- **处置**：02 已修正（详见修正-2 第 1 条）

## ROT-13 · 02 v2 .lfsconfig 改指自有 LFS + CI 补 7 处 lfs

- **类型**：腐烂
- **时间**：2026-08-19 14:00
- **文档**：02-phase-0.md v2
- **错误**：`.lfsconfig` 改指自有 LFS + CI 补 7 处 lfs
- **实况**：自有 LFS 超额、上游网关匿名可读、剩余 workflow 不需要补
- **处置**：02 已修正，P21 撤销（详见修正-2 第 2 条）

## ROT-14 · 02 v2 i18n 缝落位 src/app/i18n/ 根

- **类型**：腐烂
- **时间**：2026-08-19 14:00
- **文档**：02-phase-0.md v2
- **错误**：i18n 缝落位 src/app/i18n/ 根
- **实况**：上游 #557 已占用该目录（notifications/），缝避让至 fork/ 子目录
- **处置**：02 已修正（详见修正-2 第 4 条）
## D12 · records 结构调整（v2 narrative/ 一一对应）+ R6 暂缓

- **类型**：决策
- **时间**：2026-08-20 20:00
- **拍板**：owner（基于整改后的"task 维度 vs 文件维度"反思）
- **内容**：
  - **结构调整**：v1 records/ 11 对象子文档（agent-runtime / brand-config / chat-ui / i18n / ...）重组为 v2 narrative/ 一一对应（每文件一份档案）+ 横向档案（docs-governance / ci-infra / upstream-merge）保留并标"派生"
  - **R6 暂缓**：check-docs.ts 第 6 条规则（fact-verify-command）暂不挂 CI——理由：语义判定不适合机器检查；交给 [05-process.md §3.1 gate review 第 4 步 subagent 核验](05-process.md)
  - **任务维度分离**：新建 `tasks/` 子文档体系（`_index.md` + `T<id>-<slug>.md`）；task 计划 / 自检 / 核验 三件套**全部落在单 task 文档**，不再散落到 `records/narrative/<file>.md`
  - **清理 narrative/ 自检误分类**：12 个 narrative 子文档末尾的「## 自检类」占位章节批量删除（详见修正-5）

## 修正-5 · narrative/ 自检误分类清理

- **类型**：修正（按对象：12 个 narrative 子文档）
- **时间**：2026-08-20 20:00
- **依据**：D12 决策
- **内容**：12 个 `records/narrative/{00-04,05,README,tracker,spikes/01-04}.md` 末尾的「## 自检类」占位章节批量删除。理由：task 自检属 task 维度，归 `tasks/T<id>-<slug>.md`；文件维度档案不应混入 task 维度的内容
- **影响**：12 文件被修改，全部改为 append-only 的纯文件维度档案

## D13 · check-tasks.ts 增强（task 文档阶段识别 + tracker.md §2 一致性）+ 05 §5 迁移

- **类型**：决策
- **时间**：2026-08-20 21:30
- **拍板**：owner（基于"check-tasks 只查 commit message 不查文档"的反思）
- **内容**：
  1. **05 §5 清理**：`05-process.md §5` "首轮执行记录" 是历史事件，按 [05-process.md §3.2](05-process.md) task 维度分离规则，应迁出至 task 档案。已迁移至 [tasks/T00-docset-v1-2026-08-18.md](../tasks/T00-docset-v1-2026-08-18.md)（2026-08-21 D15 整改后已拆为三件套：[tasks/T00-plan.md](../tasks/T00-plan.md) / [tasks/T00-self-check.md](../tasks/T00-self-check.md) / [tasks/T00-verify.md](../tasks/T00-verify.md)）；05 §5 改为引用占位
  2. **check-tasks.ts 增强**：从"只查 commit message"升级为"读 task 文档 + tracker.md §2 一致性"——
     - 解析 `tasks/T<NN>-*.md` 文件，识别章节阶段（plan-only / plan+自检 / plan+自检+核验）
     - 读 [tracker.md §2 任务表](../tracker.md)，验证 T 编号必须存在（或本次 commit 同步加入）
     - 增强失败时给出明确的修复指引
     - **注（2026-08-21 D15）**：D13 章节正则识别被 D15 三件套物理拆分 + `existsSync` 检查替代——见 [records/topics/docs-governance.md D15](../records/topics/docs-governance.md)
  3. **T02 task 自身**承载本次改进：计划 + 自检 + 核验三件套全部落 [tasks/T02-doc-discipline-check-2026-08-20.md](../tasks/T02-doc-discipline-check-2026-08-20.md)（2026-08-21 D15 整改后已拆为三件套：[tasks/T02-plan.md](../tasks/T02-plan.md) / [tasks/T02-self-check.md](../tasks/T02-self-check.md) / [tasks/T02-verify.md](../tasks/T02-verify.md)）
- **依据**：owner 触发（T01 落地后反思）

## D14 · 05 §4.10 文件↔record 一一对应显式纪律条款（补漏）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner（基于"05 未提及物理文件↔record 一一对应"的反思）
- **问题**：D12 已决定 narrative/ 一一对应（每物理文件一份 record），但 05-process.md 只在 §3.2 一笔带过「`records/narrative/<file>.md` 承载腐烂/修正/核验」，**未把"一一对应"作为可被 CI 拦截的明文纪律条款**——导致后来读 05 的人不知道这是强约束，只当它是 `check-bindings.ts` 的实现细节
- **处置**：
  1. **05 §3.2 修订**：在"Task 维度 vs 文件维度的严格分离"段落显式补"一一对应"字样 + 列出"错误示范 2"（跨多文件共用主题聚合 record）
  2. **05 §4 新增 §4.10**：标题「文件↔record 一一对应纪律（D14 候选）」，明文写下五条——核心约束 / 两层关系 / 修改触发 / 新增删除触发 / CI 拦截（check-bindings.ts + pre-commit + gate review 第 4 步）
  3. **05 §3.1 gate review 列表补第 4 项**：文件↔record 一一对应核验全绿（check-bindings.ts）升级为 gate review 硬性前置
  4. **05 §5 状态字段刷新**：「已核验」→「草稿」待 owner + subagent 核验（这次是流程定义修订，非历史事实）
- **执行**：主 agent 已完成；commit message 应带 `task: T03`（待 owner 触发 T03 登记后）
- **依据**：owner 触发（"请 review 05-process.md 为什么我没见到任何一个地方提及要 by 文件建立一一对应的 record"）

## D15 · task 三件套物理拆分 + 任务表路径检查（章节正则 → 路径文件存在性）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner（基于"任务表就是索引，对应 plan / self-check / verify 独立文档，CI 查表对路径"提议）
- **问题**：D13 增强后的 `check-tasks.ts` 用章节正则（`/^## 自检/m` + `/^## 核验-N/m`）做阶段识别——章节存在即识别为通过，**没有强制要求自检 + 核验内容真实存在**。owner 两次提示暴露此缺陷：
  1. **T03 完成度自检停在 70%、实际已 100%**：章节存在但数字延迟刷新
  2. **T03 §5 写「核验-N 待 owner 触发」作占位**：CI 识别为通过但核验未实做
- **处置**：
  1. **三件套物理拆分**：每个 task 由三个独立物理文件承载——`tasks/T<NN>-plan.md` / `tasks/T<NN>-self-check.md` / `tasks/T<NN>-verify.md`。禁止用单文档 + 章节正则形式。
  2. **任务表路径列**：[tracker.md §2 任务表](../tracker.md) 与 [tasks/_index.md §2 任务清单](../tasks/_index.md) 每行含 T 编号 + plan / self-check / verify 三列路径。
  3. **check-tasks.ts 重写（D15 决策核心）**：从章节正则识别改为读任务表三列 + `existsSync` 检查三文件存在——零正则、零章节、零语义判定，三件套齐不齐一目了然。
  4. **05 §3.2 / §4.11 同步**：新增 §4.11「task 三件套物理拆分纪律（D15 决策）」+ §3.1 gate review 第 5 项补齐 + §3.2 错误示范 3。
  5. **历史 task 迁移**：T00 / T01 / T02 / T03 单文档 `T<NN>-<slug>.md` 拆为三件套，旧单文档 `git rm -f` 删除。
  6. **主 agent 自律**：完成度数字实时期更新（不允许"实际已 100%、自检停在 70%"）；核验-N 不允许占位「待 owner 触发」——主 agent 在自检完成后主动派 general-purpose subagent 独立核验。
- **执行**：[tasks/T04-plan.md §2 任务清单](../tasks/T04-plan.md) 13 项 + check-tasks.ts 重写 + 5 文件叙事修订 + 历史 4 文档迁移 + 任务表两表同步
- **依据**：owner 触发（"任务表就是一个索引，对应的 task plan 文档、自检文档、核验文档都是独立文档，相对路径地址都需要填进表里，CI 机制对着表格查这些产出物是否存在"）

## D16 · dsh 集成形态 vs 03-phase-1-runtime.md 决策状态不一致（候选 · 待 owner 拍板）

- **类型**：决策（候选 · 待 owner 拍板，主 agent 不自行决断）
- **时间**：2026-08-21
- **触发**：T05 owner 提问"review 00-05 文档腐烂"时，主 agent 识别出 D9「dsh 集成形态」状态 `open（待 owner 拍板）` 与 [03-phase-1-runtime.md §0](../03-phase-1-runtime.md) v3 已按"Y 路线弃 + X vs pi 待 spike 后"撰写**不一致**
- **现状**：
  - D9 状态：`open（待 owner 拍板）`——三候选（a 编辑器入壳 / b 无头 runtime / c pi 直接驱动）都还在桌上
  - 03 §0 内容：明确"Y 路线（无头 runtime）已不构成有效候选"——把三选项减为双选项（X / pi）
  - 矛盾点：03 已经按"Y 弃"撰写，但 D9 没正式拍板"Y 弃"；如果 owner 之后拍板"Y 保留"，03 全文要回退
- **主 agent 立场**：**不自行拍板 D9**。本决策候选登记让 owner 决定如何对齐：
  - **选项 A**：03 退回三路线（D9 a/b/c 都保留），03 §0 删除"Y 已不构成有效候选"声明
  - **选项 B**：D9 改为已拍板"Y 路线弃 + X vs pi 待 spike 后定"，03 §0 现状维持
  - **选项 C**：D9 维持 open，03 §0 加显式声明"Y 弃系 owner 讨论态度，未正式拍板；D9 决策悬而未决"
- **执行**：本次 T05 只登记不一致、不解决决策本身
- **依据**：T05 owner 触发（T05 任务清单第 4 项腐烂点：D9 vs 03 不一致）

## D17 · 禁止本机绝对路径入库（owner 触发 · 待评估 CI 拦截）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner（基于"上传 github 后对其他人用其他电脑会形成干扰，可能导致隐私泄露"反馈）
- **问题**：T05 commit `9ecda65e`（未 push）发现 5 处本机绝对路径——3 处 T05 范围（narrative/proposals/governance-v1.md + narrative/05-process.md + tasks/T05-plan.md），2 处历史（spike/03-weshop-case-deep-dive.zh.md 在 commit `a5dab4a8`）
- **处置**：
  1. **5 处全清**：T05 范围 3 处用 Edit 改为"工作区根 docs/ 子目录 / 仓库根外"等描述性语句；spike 03 1 处用 Edit 改为"本仓库 open-pencil-rebuild 工作树"
  2. **T05 commit 重建**：T05 落地后再补一个清理 commit（与 T05 commit 合并或独立 commit 二选一——本任务先做独立 commit，让 git history 反映"owner 反馈 → 主 agent 修正"路径）
  3. **新纪律（提案）**：禁止本机绝对路径（`D:\\`、`C:\\`、`~/` 等）入库；写入 05 §4.11 之后的纪律条目或新建 §4.12
  4. **CI 拦截（待评估）**：是否在 `check-docs.ts` 加 R6 检测（grep `D:\\|C:\\`）——owner 决定是否启用
- **依据**：owner 提问"不要在本仓库内记录任何这样的本机绝对地址……全面检查一遍"

---

## T09 整改登记（2026-08-21 · owner review 发现的系统性问题）

> 触发：owner 要求对重建文档集整体 review + 立 T09 逐项核实修复。以下 ROT 条目均由主 agent 复核实测（证据命令见 [tasks/T09-self-check.md](../../tasks/T09-self-check.md)），修复落在同一 commit。

## ROT-15 · 「CI 已接线」声称虚构（02 / README / 05 §3.1）

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：02-phase-0.md §5 #2「CI 已接线 check:zones」；README「check-docs.ts 已挂 CI」；05 §3.1 gate 步骤 1-5 标注「已自动化」
- **实况**：四个纪律检查从未出现在任何 workflow——`grep -rn "check:zones\|check:docs\|check:bindings\|check:tasks" .github/` 零命中；`git log --all -S "check:zones" -- .github/` 空。pre-commit hook 本机未安装（`git config core.hooksPath` 空），且 hook 只跑三个 doc check、不跑 check:zones
- **后果**：T06 改 `.github/actions/setup-bun/action.yml` 未登记补丁、tools/hooks/ 未入 ownedRoots，zone check 在 HEAD 上 3 处违规无人拦截（2026-08-21 实跑实测）
- **修复**：T09 B 组——ci.yml 新增 rebuild-discipline job（P32）；zones.json 补登 P31 + ownedRoots += tools/hooks/；pre-commit 改为每次 commit 跑 check:zones；本机 hooks:install 已执行

## ROT-16 · T06/T07/T08 verify.md 占位核验（§4.11 明文禁止项被系统化执行）

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：三份 verify.md 全为「（待 subagent 填）」占位模板（T06 18 处 / T07 19 处「（待」标记），而对应 self-check 均声称「subagent 核验-1 ✅ 已做」
- **实况**：existsSync 只能查存在、查不了实做——D15 物理拆分解决了「章节占位误判」，但没有解决「文件级占位」
- **修复**：T09 D 组——subagent A 实做核验回填三份 verify.md（T08 已由并行会话 commit 7d013794 先行回填）；T09 B4——check-tasks.ts 新增占位检测（D19），命中「（待）」「（待 subagent」「待 owner 触发」即拒收
- **教训**：纪律文本里写「必须实做」不构成约束；能机器检查的必须机器检查

## ROT-17 · T08-plan/self-check 的 T07 commit hash 张冠李戴

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：T08-plan.md §1.1 与 T08-self-check.md §4 写「T07 commit `0ac548e6` 实际未 push」
- **实况**：`git show -s 0ac548e6` = T06 的 commit（已 push、CI 绿）；T07 = `5698019a`（subagent A 复核）
- **修复**：T09 C7 两处改回 `5698019a`；narrative/tracker.md 内 T08 登记条目同款错误一并注记

## ROT-18 · tracker.md 任务表结构性失守（真源/镜像分叉 + 列错位复发）

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：① T08 落地时只在镜像 tasks/_index.md 加行，真源 tracker.md 缺 T08 行（并行会话 7d013794 补）；② 7d013794 写入的 T07/T08 行缺「状态」cell（7 cell vs 8 列表头）——owner 反馈的「写错位」问题在修正后再次复发；③ T07 行状态列曾填「—」（非法状态值）；④ §3.1 计数「14 份 narrative 档案」实为 13（find 实测）；⑤ 「≤50 行」预算声明 vs 实际 69 行
- **根因**：check-tasks.ts 的 `readTaskTable()` 读两表取并集，真源缺行不可见；表格 cell 数无机器检查
- **修复**：T09 C1 全部修正；行数预算放宽为 ≤80 行并注明理由

## ROT-19 · 05-process.md §3.2 与 §4.11/附录 B 直接矛盾（最高优先级文档内部打架）

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：§3.2 仍写「三件套全部落在 tasks/T\<id\>.md 单个文档」「追加『自检-N』章节」「[BIG] 大改动标记」「check-tasks.ts 旧路径」——[BIG] 块已在 cdf81eb4 删除、脚本已迁 check/ 子目录（7dc2769a）；README「gate review 硬性第 4 步 subagent 核验」步骤号错误（实为第 6 步，T08-verify 曾写第 5 步）
- **修复**：T09 C2/C3——§3.2 按 D15 重写、§3.1 脚本路径与步骤号修正、PR 列残留清除（§3.2/§4.11/附录 B.1）、§2 树状图修正

## ROT-20 · 03-phase-1-runtime.md 决策关键数字与引用失守

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：① X 路线工作量「15.5 人日」（引用 spike 04 §5 + 修正-2，两处均无此数字）vs records 层（修正-1 / SP-3 / 01 §8）≈37-38 人日——决策关键输入两处打架；② §5.1「A 推荐（你已表达偏好）」vs D9 记录「c（pi）推 1」；③ 视觉回路证据引用 `weshop-dsh-plugin/src/integrations/pi.ts:18` 悬空（文件不存在、全仓无 .ts、git 历史无）；④ pi 路径标签 `packages/session/` 实为 `packages/coding-agent/src/core/`（行号 1530 实测不变）；⑤ §5.2 给的 `npm view <pkg> weekly-downloads` 不是有效字段（实测返回空）
- **修复**：T09 C5——数字对齐 records 层、推荐方向不一致显式标注（不改推荐本身，留 owner 拍板）、引用修正、§5.2 数据实采填入（dsh 175,615 stars / 周下载 648,007；pi 周下载 1,904,277；均远超阈值）

## ROT-21 · 05 §2 树状图 / records _index / 04 §4 一致性残留

- **类型**：腐烂 | **时间**：2026-08-21
- **错的内容**：05 §2 树状图 tasks/ 只列 T00-T04（T05-T08 缺）、列了磁盘不存在的 `narrative/tasks/` 与 `archive/`；records/_index.md §2 称治理范围含「records 各文件」与 §4.10 横向档案豁免矛盾；04 §4「逐块 PR」与 T08 决策未对齐
- **修复**：T09 C2/C4/C8——树状图通用化（T<NN> 模式）+ 删幻影目录 + archive 标注按需创建；_index §2 改为与 bindings.ts 口径一致的准确枚举；04 §4 对齐 T08

## D19 · 占位检测机制化 + 纪律检查 CI 接线（T09 落地）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：主 agent 机制落地（属既有纪律 D11/D15 的执行层补漏，不改变决策内容）；owner review 触发
- **内容**：
  1. **check-tasks.ts 占位检测**：对 commit 引用 task 的 self-check/verify 扫描占位标记（`（待）` / `（待 subagent` / `待 owner 触发`），命中即拒收——§4.11「禁止占位」从文本纪律升级为机器检查。模式集刻意收窄，避免误伤「（待拍板）」类合法散文
  2. **ci.yml rebuild-discipline job**：check:zones + check:docs + check:bindings + check:tasks 四检查真正接线（P32 登记；含 upstream remote fetch 供 merge-base，push 区间用 `github.event.before`）
  3. **pre-commit**：每次 commit 跑 check:zones（git-diff 级开销，zone 违规可来自任意上游文件改动）；doc 三检查仍按 docs 改动触发
- **依据**：ROT-15/ROT-16 的根因——「已自动化」声称必须有 workflow 文件佐证；「必须实做」必须有占位检测佐证

## 提案 · 治理冻结期（待 owner 拍板）

- **类型**：决策（候选 · 待 owner 拍板）
- **时间**：2026-08-21（T09 F2 登记）
- **内容**：Phase 1 期间治理机制只准 ROT 登记（发现腐烂就记），**不新增治理机制**（不再加新检查、新目录层、新三件套变体）。T00-T09 九个 task 中八个是文档治理/CI 基建，治理成本已在吞噬产品进度；机制沉淀应让位于 Phase 1 spike
- **例外**：gate 阻塞级的机制缺陷（如 ROT-15 这种「声称的自动化不存在」）不受冻结限制

## ROT-22 · T09 核验轮二轮发现（占位骨架残留 + 步骤号残留 + 字面引述自伤）

- **类型**：腐烂登记
- **时间**：2026-08-21
- **发现者**：T09 核验 subagent（N1-N4）+ 主 agent repo-wide 探针复查（N5）
- **内容**：
  1. **N5 · T05-verify.md 占位骨架残留**：§2 实测表（19/19 ✅）下方残留原占位模板 14 行（回填实测值时未删模板骨架），repo-wide 占位探针实测命中；已删除（T05-verify.md §5.4 注记）
  2. **N2 · 步骤号残留**：一轮修正只改 README 正文，README 表格行 / 05 §4.10 / T05-verify / T08-verify 仍引用旧步骤号——全部统一为第 6 步（T08/T05 verify 附修正注记）
  3. **N1 · 字面引述自伤**：T09-self-check 与 T06/T07 verify 的修正注记直接引述占位词原文，命中 D19 占位检测正则——注记改写为角括号「待 subagent 填」样式（不触发 `（待` 字面），占位检测与历史引述两立
  4. **N4 · 轻微漂移**：T09-self-check zone 计数 83→84；05 §3.3 `check-docs.ts` → `check:docs`；附录 B.5 表 `check-tasks.ts` ×3 → 全路径 + 补「占位检测 D19」
- **教训**：① 模板回填时必须删骨架，不能只往上贴实测值；② 同一事实多处引用时修正必须全文 grep 兜底（N2 即「改了正文没改表」）；③ 引述占位词本身会被占位检测命中——注记用不触发字面的写法
- **对 ROT-16 的补充**：占位实例从 3 份（T06/T07/T08）修正为 4 份（+T05 骨架残留）；D19 检测范围不变（self-check/verify），历史注记一律改用不触发字面的引述样式

## D11 · 大改动完成度自查纪律（补登记——原采纳映射指针悬空修复）

- **类型**：决策（补登记）
- **时间**：2026-08-25
- **背景**：`records/narrative/05-process.md` 的 D11 条目自称「派生自 records/topics/docs-governance.md D11」，proposals/governance-v1.md 采纳映射亦声称 D11 登记在本档案——但本档案实际无 D11 定义体（grep 实证 2026-08-25：本档案仅 D10/D12/D13/D14/D15/D16/D17/D19），指针悬空。D11 的实际定义体一直在 `records/narrative/05-process.md` D11 条目（大改动必产三件套 + 完成度对照义务，落地于 05-process.md §3.2 与附录 B）
- **处置**：本条作为 D11 在本档案的正式登记（内容以 narrative/05-process.md D11 条目 + 05-process.md §3.2/附录 B 为准）；悬空指针以此条消解
- **拍板**：owner（2026-08-20 整改轮，与 D10 同批；本条为补登记非新决策）

## 状态更新 · D16 前提过期 + 治理冻结期提案状态标注（2026-08-25）

- **类型**：状态更新（append-only，原条目不改动）
- **时间**：2026-08-25
- **内容**：
  1. **D16 前提已随 D24 过期**：D16 登记的矛盾是「D9 open vs 03 §0 已按 Y 弃 + X/pi 双候选撰写」——D24（2026-08-23）已正式拍板 pi 主线、dsh-X 搁置，Y 路线弃置已成事实（D22/D24 两轮拍板均不含 Y），D16 的三个选项前提不复存在。D16 实质消解，仍待 owner 在形式上补签关闭（报送清单 2026-08-25）
  2. **治理冻结期提案状态**：「Phase 1 期间治理机制只准 ROT 登记、不新增治理机制」提案（2026-08-21 T09 F2 登记）至今仍为**候选 · 待 owner 拍板**——Phase 1（T10-T25）期间事实上未新增治理机制（仅 T22 假绿事件触发的 05 附录 B.3 verify 复验规则属「gate 阻塞级机制缺陷」例外条款覆盖范围），提案被事实遵守但未获正式拍板，状态标注于此

## D16 形式关闭 · owner 拍板（2026-08-25）

- **类型**：决策（形式闭环——对上条「待 owner 形式补签关闭」的闭环）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 对三方 review 整改 15 项决策批 #3 逐项拍板）
- **状态**：已关闭
- **内容**：**D16 正式关闭**——其前提（D9 open vs 03 §0 已按 Y 弃撰写的不一致）已随 D24（2026-08-23 pi 升主线、dsh-X 搁置）消解，Y 路线弃置经 D22/D24 两轮拍板成事实，无需再对齐；D16 条目本体按 append-only 纪律保留作审计线索

## 治理冻结期拍板 · 部分解冻（2026-08-25）

- **类型**：决策（对 2026-08-21 T09 F2「治理冻结期」候选提案的拍板）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 决策批）
- **状态**：已拍板（候选提案闭环）
- **内容**：**部分解冻**——①**堵漏型机制修正放行**：对既有机制暴露的漏洞/失真做修正不受冻结限制（如 05-process.md 附录 B.3 verify 远端 CI 复验强制规则这类「gate 阻塞级机制缺陷」修正，T22 假绿事件触发）；②**新增治理面继续冻结**（Phase 2 期间）：不新增检查器、不新增目录层、不新增三件套变体等新治理机制——治理成本让位于产品进度（原提案理由维持）
- **依据**：原提案（本档案 2026-08-21「提案 · 治理冻结期」条目）事实遵守了一个 Phase 但未拍板；本次 owner 决策批将其收敛为「部分解冻」口径正式拍板

## 决策批总登记 · 2026-08-25 owner 对三方 review 整改 15 项决策逐项结论

- **类型**：决策（汇总登记——owner 2026-08-25 对 T26/T27 报送清单（[T26-self-check.md §1.6](../../tasks/T26-self-check.md) 8 项 + [T27-plan.md §3.3](../../tasks/T27-plan.md) 7 组）共 15 项逐项拍板；本条目为决策批的单一留痕口）
- **时间**：2026-08-25
- **拍板**：owner
- **逐项结论**（一句话 + 落地指针）：
  - **#3 决策补签组**：D3（session 模型）/D5（chatMode）补签已拍板，D16 形式关闭，治理冻结期拍板「部分解冻」——落地见本档案上两条 + [records/topics/agent-runtime.md](agent-runtime.md) D3 补签 + [records/topics/chat-ui.md](chat-ui.md) D5 补签 + [01-target-state.md §6](../../01-target-state.md) 决策表（T29）
  - **#4 分支保护**：rebuild/pi 开启分支保护（required checks 四项 + enforce_admins + 保留 force-push 通道 + 禁删），主 agent 经 gh api 落地——登记见 [records/topics/ci-infra.md CI-14](ci-infra.md)（T29）
  - **#5 补丁过堂节奏**：zones.json 全部补丁带 lastReviewed 字段，每次 upstream 合并全量过堂并刷新——规则文见 [05-process.md §3.3](../../05-process.md)（T29 写规则、T28 实现机制）
  - **#6 zones.json 变更报警**：zones.json 变更的 commit 必须含 task 指针 + CI discipline job 输出 P 条目变更摘要——规则文见 [05-process.md §3.2](../../05-process.md)（T29 写规则、T28 实现机制）
  - **#7 D 编号规则改口**：全局 D 仅用于跨任务决策，任务内设计决策一律 Tk-Dn（如 T28-D1）；历史不回改——规则文见 [records/_index.md §1](../_index.md) + [05-process.md §4](../../05-process.md)；T20-T25 窗口拍板补登 D25-D29 见 [records/topics/agent-runtime.md](agent-runtime.md)（T29）
  - **#8 tracker 行数治理**：owner 拍板归档方案——T00-T20 长实录移入 [tasks/_index.md](../../tasks/_index.md) 归档节，tracker.md 任务表压缩为摘要索引回 ≤80 行（T29）
  - **#9 check:tasks 阈值/占位正则**：**维持现状**——大改动阈值（R1-R4）与 D19 占位正则模式集不加固、不扩词（T27 报送第 5 组「阈值博弈加固、占位正则纳『待核验』」拍板不做；现有机制见 [05-process.md §3.2 + §4.11](../../05-process.md)）
  - **#11 包结构五连**：**交上游管理、本仓不做**——SceneGraph 拆分 / core barrel 收口 / stock-photo 移层 / packages noUnusedLocals / kiwi oxlint 豁免等包结构项不在我仓立项，跟随上游演进（T27 报送第 3 组之包结构半）
  - **#12 测试体系**：**只优化 pi-backend 冒烟面（smoke:pi 已并入单一入口，T27 落地），其余测试体系项交上游**——unit test 进 CI / CI e2e + 契约测试等不在我仓立项（T27 报送第 3 组之测试半）
  - **#13 层 1 验收口径重建**：新口径 = C1a-C5a 五环各配一条端到端冒烟且全绿 + smoke:pi 批次全绿 + CI 绿（原 16 文件口径宿主随 T10 消失）——落地见 [01-target-state.md §3](../../01-target-state.md) + [tracker.md §1](../../tracker.md) Phase 3 行（T29）
  - **#14 根文档最小指针**：只改根 README.md + AGENTS.md 加 rebuild 指针，CHANGELOG.md 不动——落地见根 README.md「OpenPencil Rebuild」节与 AGENTS.md Documentation 节（T29；zones patch 由主 agent 收口登记）
  - **#15 upstream 双周合并 SOP**：双周窗口检测——upstream 漂移 >20 commits 即触发合并登记，与原月合并口径并存——规则文见 [05-process.md §3.3](../../05-process.md)（T29）
  - **#1 / #2 / #10**：本 subagent（T29 文档面）未持有该三项的拍板内容与落点映射——以 owner 2026-08-25 会话决策单为准，由主 agent 收口时补登；报送源头候选见 [T26-self-check.md §1.6](../../tasks/T26-self-check.md) 第 4/5 项（§4.1 三态分标补标 / §4.3 状态词汇表）与 [T27-plan.md §3.3](../../tasks/T27-plan.md)（pi 后端零鉴权 / session GC / smoke:pi fixture 供给 / format:check 净树判据等组）
- **05-process.md 修改决策登记**（05 自身纪律要求：修改 05 须在本档案登记一条决策）：本决策批 #5/#6/#7/#8/#13/#15 的规则文落地涉及 05-process.md 修改（§3.2 zones.json 变更报警、§3.3 补丁过堂 + 双周窗口、§4 第 1 条 D 编号口径、§2 tracker 归档机制一句话），决策依据即本条目，不再单独立 D——owner 2026-08-25 拍板

## 决策批总登记补登 · #1 / #2 / #10（主 agent 收口回填，2026-08-25）

- **类型**：决策补登（上一条目遗留的三项缺口，按 append-only 原则另起本条，不改原文）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 决策批原话：#1「按你建议的方式改」；#2「按你建议的方式改，归档，不删除」；#10「同意建议」）
- **逐项结论**（拍板口径 + T28 落地事实）：
  - **#1 pi 后端零鉴权**：拍板按建议方案改——vite-plugin 每进程生成 32-hex token，经 env `OPENPENCIL_PI_TOKEN` 注入子进程并由 proxy 对 `/api/pi` 统一补 `Authorization` 头；后端中间件定常比较（sha256 + `timingSafeEqual`）、`/health` 豁免、无 token 时 fail-close 全拒；standalone 模式自生成写 `<cwd>/.openpencil/pi-backend-token`（0o600，控制台只打路径）。**T28 已落地**（[auth.ts](../../../../src/app/ai/pi-backend/auth.ts)、server.ts 中间件、main.ts standalone 自生成、vite-plugin token 注入）；全部直连后端的冒烟脚本带 token + 401 负向断言。token 文件适用 key 卫生同级纪律（不打印、不入库、不外传）
  - **#2 session GC / rotate**：拍板按建议方案改、**归档不删除**——超龄（`OPENPENCIL_SESSION_MAX_AGE_DAYS`，默认 30 天）或超量（`OPENPENCIL_MAX_SESSIONS`，默认 200，最老先归）的会话文件**移动**到 `.openpencil/pi-sessions-archive/`（保文件名、index 除条、archive 无索引）；`listSessionFamily` 不扫 archive、`readHistory` 对已归档会话返回空；GC 失败只 warn 不阻断主流程。**T28 已落地**（session-gc.ts + service.ts 双触发点）；t28/session-gc-smoke.mjs 19/19 绿
  - **#10 format:check 净树判据**：拍板同意建议——`format:check` 由「format 写后 git status 判净树」改为 `oxfmt --check` 直接判据（与 `format` 逐字同路径集），CI Verify formatting 步骤引用同步。**T28 已落地**（package.json format:check + ci.yml）；消除「写后比对」在 CI 检出态下的判据失真
- **报送源头**：[T27-plan.md §3.3](../../tasks/T27-plan.md) 第 1 组（pi 后端零鉴权）、第 2 组（session GC）、第 4 组（format:check 净树判据）


## D32 · 生图独立凭证链（F0.3②）归并层 1 C3a，层 0 纯聊天地基闭环

- **类型**：决策（分层归属）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 会话指令）
- **状态**：已拍板，T30 随批落地
- **内容**：F0.3② 生图独立凭证链（key/baseURL/model 三键 + `setImageGenCredentials` 进程级注入 + 设置 UI）从层 0 F0 移出，并入层 1 C3a 生成环——凭证与其唯一消费者 generate_image 同阶段开发（C3a 依赖列收敛为 F0.2 桥）；层 0 F0 随之收敛为纯聊天地基（runtime 内核 / 工具执行桥 / 聊天凭证 / 传输契约+chat UI / session↔文件绑定 / prompt 注入点 / prompts 构建链脆依赖消除），hello-tool 验收本不依赖生图凭证；F0.3 更名为「聊天凭证链」（原 ② 取消，不沿用 F0.3② 编号）。
- **依据**：owner 原话「生图独立凭证放到层 0/phase 2 也挺奇怪的，生图工具本身并不在这个阶段，凭证和工具本身应该在一起开发吧」。主 agent 评估支持：凭证价值随消费者而定，生图工具（C3a，层 1）未建前独立凭证链无消费者、验收无抓手；层 0 的判据是 hello-tool 全链（T20 已通），② 移出后 Phase 2 出口即刻全数达成。
- **影响面**：01 §2 Phase 2 行「F0.1-F0.7」改「F0.1-F0.6」；01 §3 F0.3 行缩为 ①、删 ② 待建尾项；01 §4 C3a 依赖列「F0.2 + F0.3②」改「F0.2 桥」；tracker 阶段门 Phase 2 行删除「仅剩 F0.3② 生图独立凭证待建」（Phase 2 出口随之全数达成，状态列待主 agent 核实后另签）；04 移植清单两行「F0.3②」标签改指 C3a（归属变化，移植范围不变）
- **执行**：[tasks/T30-plan.md](../../tasks/T30-plan.md)（T30 收尾随批落地，不另立 task）


## D33 · 上游合并第二轮 Recovery 面（f75d67ad）改判为存量快进，不报送 owner

- **类型**：决策（合并裁定）
- **时间**：2026-08-25
- **拍板**：主 agent（按移植纪律「内核/存量零交叠面跟随上游」常例自主裁定，备查登记）
- **状态**：已拍板，T31 随批落地
- **内容**：T31 立项时 f75d67ad（crash recovery 可配置）误判为「新功能面报送 owner」；实测 `document/recovery`、`settings/preferences`、`RecoveryDialog` 存量基础设施已在仓（T10 上游合并带入），本 commit 仅给存量加可配置开关，且与我们 5201404f..2014c81a 改动面（1338 文件）零交叠——按「存量加固快进」处理，不构成需 owner 拍板的新功能引入。
- **依据**：`grep -E 'document/recovery|settings/preferences' our-changed-files` 零命中（2026-08-25）；快进后 `bun test tests/engine/app/document/recovery/` 11→14 全绿
- **执行**：[tasks/T31-plan.md](../../tasks/T31-plan.md)
