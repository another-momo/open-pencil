<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/docs-governance.md · 文档体系治理

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent + owner 讨论
> **身份**：文档体系本身的修改记录、核查轮记录、文档腐烂记录。本文档是 records/ 子文档体系的根节点之一。

---

## 决策类

## D10 · 文档治理方案（plan-correction + 纪律块 + tracker拆分 + 元信息 + check-docs.ts）

- **类型**：决策
- **时间**：2026-08-20 18:00
- **拍板**：owner + 主 agent 讨论
- **内容**：采纳 4 节方案——①叙事文档 plan-correction 直接改原文，变更历史归 records/；②每个叙事文档前 15 行加 HTML 纪律提示块；③tracker.md 按对象拆分为 records/ 子文档；④统一头部元信息格式（状态/时间 HH:MM/核验人/身份/基线）；⑤写 check-docs.ts 格式校验脚本（3 条稳定规则先挂 CI，逐步加严）；⑥交叉引用禁裸 § 编号
- **依据**：Phase 0 完成后 review 暴露的四类问题（计划修正无定义、纪律不可见、tracker 会膨胀、交叉引用脆弱）。方案文件：`docs/rebuild-docs-governance-proposal.md`
- **本轮整改范围**：[05-process.md](05-process.md) 补 7/8/9 三条规则 + gate review 第 4 步；00/01/02/03/04 全部加纪律块 + 统一头部；[02-phase-0.md §0](02-phase-0.md) 删除（迁移至本文档「修正-2」）；[03-phase-1-runtime.md](03-phase-1-runtime.md) 附录 A 删除（迁移至 agent-runtime.md 修正-2）；tracker.md 拆分为索引 + records/*；新增 check-docs.ts

---

## 修正类

## 修正-2 · 02-phase-0.md v2 §0 执行期修正节迁移（已删除）

- **类型**：修正（按对象：02-phase-0.md）
- **时间**：2026-08-20 18:30
- **依据**：本轮整改 D10 决策（计划修正规则见 docs/rebuild-docs-governance-proposal.md §2.1）
- **原文位置**：02-phase-0.md §0「执行期修正」（8 条）
- **迁移去向**：本文件「02-phase-0.md 执行期修正明细」章节（保持原貌供审计）
- **影响**：02-phase-0.md §0 删除，正文（§1-§6）已同步体现新版本；02 头部加纪律块 + 统一 HH:MM 时间

## 修正-3 · 03-phase-1-runtime.md v3 附录 A 迁移

- **类型**：修正（按对象：03-phase-1-runtime.md）
- **时间**：2026-08-20 18:30
- **依据**：本轮整改 D10 决策
- **原文位置**：03-phase-1-runtime.md「附录 A：v3 相对 v2 的修订记录」
- **迁移去向**：`records/agent-runtime.md` 修正-2 条目
- **影响**：03 附录 A 删除；03 头部加纪律块 + 统一 HH:MM

---

## 02-phase-0.md 执行期修正明细（保持原貌供审计）

> 以下 8 条原 [02-phase-0.md §0](02-phase-0.md) 内容，2026-08-19 实测推翻/细化了 02-phase-0.md 初版。已迁移至此，按 [05-process.md §4 纪律](05-process.md) 登记。

1. **src/app/tauri/ 不需要 stub**：实测它被 ~20 个 src 文件**静态** import（非动态），内部 `isTauri()` 运行时守卫。结论改为：保持上游纯净、一行不动；`@tauri-apps/*` runtime 依赖必须保留（vite build 需可解析），只裁 `@tauri-apps/cli` + `@wdio/*` 开发依赖。
2. **LFS 处置反转**：`.lfsconfig` 保持上游网关（匿名读实测可用）；fork 的 GitHub LFS **预算超额**（pull 被拒）；fixture 去 LFS 化被否（material3/nuxtui 合计 143MB，进普通 git 不可接受）。结论：LFS 面在本分支仅剩 6 个测试 fixture（canvaskit 已来自 npm）；未来新增 LFS 文件（如普惠体）前必须解决自有托管。补丁 P21 已撤销。
3. **workflows 实删 6 个**：build/docs/app/homebrew/deploy-preview/preview（桌面发布 + Cloudflare 系全死）；ci.yml 随上游 #558 重组后重删 native-test-contracts job。原「补 7 处 lfs:true」消失——剩余 job 的 checkout 本就有或不需要。
4. **i18n 缝落位修正**：上游 #557（合并演习带入）自建了应用级缝 `src/app/i18n/notifications/`（独立 createI18n 实例 + 共享 locale atom——与我们设计同构，验证方向正确）。我们的缝避让至 `src/app/i18n/fork/`；upstream notifications 的 7 个已删 locale loader 需同步裁剪（补丁 P24，satisfies Record<TranslatedLocale> 会类型报错）。
5. **EditorView 切断点实测 5+ 处**；MobileHud 的 share 死端（stub 返回空 roomId → 已删路由）一并移除（P12/P13 + MobileShareButton.vue 删除）。
6. **合并演习实战**（0332b062，8 commits 含 AI SDK 7 升级 #555）：冲突 10 文件——删除区 modify/delete 一律重删；配置类（package.json/ci.yml）以 upstream 新结构为基座重放我方修改；bun.lock 重生成。另发现 bun 缓存需 `rm -rf node_modules` 重装以清陈旧的依赖版本副本。详见 `records/upstream-merge.md` MERGE-1。
7. **本机测试纪律**：Windows 本机全量 `bun test` 在负载下有环境性失败（ws 超时、网络、字体——纯净基线对照 14 个同源失败），以 CI 为准；定点隔离运行必须 0 fail。fixture 幻影 M（LFS 指针 vs 真实文件）**永不入库**。
   - 2026-08-19 起幻影 M 分类处置：**autocrlf 类已根除**——仓库级 `core.autocrlf=false` + 两个 worktree 已归一化为 LF（`git rm -r --cached . && git reset --hard`，LFS 真实文件先备份后回填）。旧分支文档记载的"271 个幻影 modified"问题自此消失。剩余 M 仅 LFS 类（真实 fixture/字体盖在指针上，本地测试需要，add 后经 clean 过滤器为 no-op，实测验证）。详见 `records/ci-infra.md` P0-9。
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
  1. **05 §5 清理**：`05-process.md §5` "首轮执行记录" 是历史事件，按 [05-process.md §3.2](05-process.md) task 维度分离规则，应迁出至 task 档案。已迁移至 [tasks/T00-docset-v1-2026-08-18.md](../tasks/T00-docset-v1-2026-08-18.md)；05 §5 改为引用占位
  2. **check-tasks.ts 增强**：从"只查 commit message"升级为"读 task 文档 + tracker.md §2 一致性"——
     - 解析 `tasks/T<NN>-*.md` 文件，识别章节阶段（plan-only / plan+自检 / plan+自检+核验）
     - 读 [tracker.md §2 任务表](../tracker.md)，验证 T 编号必须存在（或本次 commit 同步加入）
     - 增强失败时给出明确的修复指引
  3. **T02 task 自身**承载本次改进：计划 + 自检 + 核验三件套全部落 [tasks/T02-doc-discipline-check-2026-08-20.md](../tasks/T02-doc-discipline-check-2026-08-20.md)
- **依据**：owner 触发（T01 落地后反思）
