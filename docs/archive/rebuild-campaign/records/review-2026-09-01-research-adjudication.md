<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 预研文档对照 review · 2026-09-01

## 0. 元信息

- **扫描范围**:
  - A. 父仓 `doc/*.md`（10 份，`find D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc/ -maxdepth 1 -name "*.md"` = 10，2026-09-01）：`README.md` / `S1-product-spec.md` / `S2-asset-files-spec.md` / `S3-tool-contracts-spec.md` / `S4-phase3-plan.md` / `T-C-survey-20260901.md` / `T65-ui-interaction-decisions.md` / `base-candidate-list.md` / `t66-ref-brief-form-panel.md` / `t67-marketing-prompt-mining.md`
  - B. 本仓 `docs/rebuild/proposals/*.md`（1 份，`ls proposals/` = `governance-v1.md`，2026-09-01）
  - **附注**：仓外 `docs/202609010000-*.md`（3 份：`history-container-placement.md` / `image-gen-provider-review.md` / `tool-internal-visibility-review.md`）已纳入扫描——T66/T71/T72 的源依据，与 phase 3 验收直接相关
- **`profile-as-skill-proposal.md` 状态**：仓内仓外**均不存在**。核验命令：`grep -rn "profile-as-skill\|profile_skill" D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/ --include="*.md" 2>/dev/null` → 零命中（2026-09-01）；`find … -iname "profile-as-skill*"` → 零命中。本批任务原文属**失效引用 / 任务书伪命题**——历史上可能源自 PD-12 时期「profile = skill.md 式本地文件化」的措辞（已落地为 S2 §1「对齐 skill.md 心智」），未形成独立 proposal 文档。处置见 §5.1。
- **评审方式**: 只读（不改文件、不跑测试、不 git 操作）
- **基准**: `S4-phase3-plan.md §6 验收口径`（T-D1 前半链冒烟绿 + T-D2 全链冒烟绿（S1 §10 八条产品断言全过）+ smoke:pi 批次扩容全绿 + CI 绿）+ tracker.md 任务表（T43~T72 已全部 ✅，2026-09-01 收口）
- **报告路径**: `docs/rebuild/records/review-2026-09-01-research-adjudication.md`
- **与上版差异**：本版基于 2026-09-01 全量重读 S1/S2/S3/S4 + tracker + t66-ref/t67-marketing/T-C-survey/T65-decisions/base-candidate-list 后整体替换。上版"纠正版"将 `profile-as-skill-proposal.md` 误标为"OWNER 已废弃"——实测表明该文件不存在于仓内仓外任何位置，正确处置是**失效引用**而非"已废弃文件留痕"。

---

## 1. 摘要表

| 档级 | 数量 | 落地动作 |
|---|---|---|
| 🟢 可吸收 | 5 | ≤0.5h/条，含 1 处 base-candidate-list 状态纠偏 |
| 🟡 冲突/过期 | 7 | 标注废止（不删原文，留 superseded 注）；3 处可微优化（S2:58/S2:133/S4:123） |
| 🔵 潜在新增 | 3 | 候选立项，进入"待 owner 裁决"队列 |
| ⛔ 失效引用 | 1 | profile-as-skill-proposal.md（任务链剔除） |

---

## 2. 可吸收清单（5 条）

### 2.1 `base-candidate-list.md` · 条目 #1 落地状态回写

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\base-candidate-list.md:12`（条目 #1 Composition Primitives）
- **建议吸收到**:
  - **T-E1 W5 归档触发式任务时**——把条目 #1 状态从"待 W5 裁决复核"更新为「**已被 T68 吸收进 longform.md 通用纪律第 2 则；上收 base 决策待 PD-20 触发时再评**」
- **实施代价**: ≤0.5h（base-candidate-list.md 加一行裁决注记）
- **风险**:
  - **关键事实修正**：条目 #1 标记为"上收候选（workflow 通用段 → base）"，但 **T68 实际落地在 longform.md 而非 base.md**——核验命令：`grep -n "Composition\|组合原语" open-pencil-mode/src/app/ai/pi-backend/studio/base.md` 命中 1 处（仅 line 114 "Shadow / blur → set_effects"，非 Composition Primitives 纪律本体）；同一 grep 在 `workflows/longform.md` 命中 2 处（line 22「组合原语」段 + line 83 忙图可读性三策引用）。T68-self-check.md:16 显式承认：「Composition Primitives → 通用纪律第 2 则（derive_palette 剔除）」
  - 应在条目 #1 注记**实际归宿 = longform.md §通用纪律第 2 则**，避免 W5 触发式 base 重新设计时按"上收"方向走反路
  - **不与 owner 删项冲突**——仅是状态字段更新

### 2.2 `t67-marketing-prompt-mining.md` · 通用纪律三条 + base 候选补记

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\t67-marketing-prompt-mining.md`
  - `:41-43` [画布选区] 段（→ base 候选强条目）
  - `:3-5` 双图工具路由（per-section 路由：实物 → stock / 抽象 → generate）——T68 已吸收进 longform.md 通用纪律第 1 则（T68-self-check.md:16）
- **建议吸收到**:
  - **T-E1 同步归档**：把 `[画布选区]` 段（:41-43）记入 `doc/base-candidate-list.md` 第 2 条（与 #1 Composition Primitives 同列），W5 触发式任务（PD-20 ②）时一并上收裁决
  - **T70 画布选区采集已落地**（tracker.md:81 行：2026-09-01 收口），与 t67:41-43 纪律文本对齐（[画布选区] 消息块 = 显式指代；选区优先于画布搜索）——T70 实施应已吸收，未吸收则在 T70-verify 补一次纪律交叉引用
- **实施代价**: ≤0.5h（base-candidate-list.md 加一行 + 交叉引用更新）
- **风险**:
  - 不与 owner 删项冲突（T62/T65/T67/T68 均已通过 T67 同步注记吸收）
  - 唯一注意点：t67 文档原对象 `system-prompt-marketing.md` 已物理删除（T67 完工注释：「文件退役删除 + 抢救性挖掘清单」），未来如有人翻 git 历史查"原出处"会找不到——应在 t67 文档头部补一句"原出处已退役，迁移目标已落 longform.md / 待入 base"

### 2.3 `T-C-survey-20260901.md` · §6 verbatim 处置口径 + §8 CP 表单对齐

- **来源文件 + 行号区间**:
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T-C-survey-20260901.md:43-45` §6 verbatim 段处置（PD-8 改写、修辞事实标注不做）
  - `:54-58` §8 CP 表单与 ask_user_question 对齐（schema、运行语义、longform.md 引用形状）
- **建议吸收到**:
  - **T-E1 阶段门 Phase 3 验收时**——把 §6 verbatim 处置口径的"边界摘要"作为 S1/S2/S3 §6 章节的"边注"附入（避免未来读者在 S2:133「修辞事实标注随 owner 2026-08-31 决策转出安全纪律」一句话里读不出"为何不做"的全貌）
  - **§8 CP 表单对齐**：作为 S3 §6 ask_user_question 的"用法示例"补充入档（已实质上在 T56 落地，但 T-C-survey 的 schema 表格是单一最全的引用形状记录，应在 S3 §6 引用一次）
- **实施代价**: ≤1h（两处边注插入 + 交叉引用更新）
- **风险**:
  - 不与 owner 删项冲突；T67 已同步吸收了调研报告 §1-§5 的多数触点
  - 注意：调研报告 §3/§4 已经"列出触点"被 T62/T65/T67 同步过了（tracker.md:78 T67 行文），§6/§8 是尚未被显式引用的剩余价值

### 2.4 `T65-ui-interaction-decisions.md` · §E 既有 review 遗留项中文字号底线

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T65-ui-interaction-decisions.md:48`（"中文字号底线 11px"）
- **建议吸收到**:
  - **新立 T74** 或并入 T-E1 阶段门尾批——把"中文字号底线 11px"作为 `studio/workflows/longform.md` §纪律段的一句补强（或新建 S4 §7 尾巴表新行）
- **实施代价**: ≤0.5h（longform.md 纪律段加一句 + 钉扎测试）
- **风险**:
  - 与 S2:145「宽≥900px 画布 body≥22/section≥40/hero≥64」数值族并列——需明确"底线 11px"是**全文下限**（含 CTA、注释等次要文字），与 S2 的「主轴数值」正交不冲突
  - 不与 owner 删项冲突

### 2.5 `t66-ref-brief-form-panel.md` · 阶段 1 核心原语 + 阶段 3 AI 提议创建

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\t66-ref-brief-form-panel.md:1-214`（全文 214 行）
- **建议吸收到**:
  - **T-E1（Phase 3 验收 + base 候选清单归档）**——把 §四 详细设计（4.1 core 原语 / 4.2 app 层状态 / 4.3 面板组件 / 4.4 入口 / 4.7 阶段 3 AI 提议）作为 **W3 之后的下一波扩展任务** 的设计真源入档
  - 或 **新立 T73**：brief 表单面板（基于 t66-ref 既有事实，半天级核心原语 + 半天级面板组件 + 半天级 AI 提议开口子）
- **实施代价**:
  - §八 估算：阶段 1 ≈ 2.5d（core 原语 0.5d + 状态模块 0.5-1d + 面板组件 1d + i18n 0.25d + 手动验证 0.5d）
  - 阶段 2/3 共 1d（选区添加 + AI 提议开口子）
- **风险**:
  - 与 **T61**「需求单面板三段（当前目标卡 / 需求单列表 / 详情编辑）」重叠（见 S1 §5 owner 2026-08-31 v7 行文）——若 T61 已落地了"需求单面板"，t66 阶段的"阶段 1 面板"应只补"表单式编辑视图"（编辑为第一功能），不能与三段面板重复造控件
  - 与 **T67** 冲突点：t66:36 `system-prompt-marketing.md:20` 引用、t66 §4.7 `create_brief` 工具接入 prompt 改写——`system-prompt-marketing.md` 已随 T67 退役删除（核验命令：`grep -rn "system-prompt-marketing" open-pencil-mode/src/` 2026-09-01 实测零命中），prompt 改写目标应改为 `studio/base.md` 或 `studio/workflows/longform.md`
  - 与 **owner 删项无冲突**：不涉及 T62/T65/T67/T68/T69/T70/T72 删除的机制

---

## 3. 冲突/过期清单（7 条）

> 处置原则：**不删原文，留 superseded 注**（governance-v1.md §2.1 第 7 条纪律：叙事文档直接改新版本 + records 子文档保留旧方案痕迹）。本节仅指认废止 + 由哪个 owner 决策拍板。

### 3.1 ⛔ `profile-as-skill-proposal.md`（失效引用）

- **核验结论**: 仓内仓外均不存在。核验命令：`grep -rn "profile-as-skill-proposal" D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/ --include="*.md" 2>/dev/null` → 零命中（2026-09-01）；`find … -iname "profile-as-skill*"` → 零命中。
- **冲突对象**: 不存在文件，无原文可供 supersede
- **处置**: **从任务链剔除**（任务原文属任务书伪命题）。相关概念已被 PD-12/PD-17 + S2 §1「profile = skill.md 心智」落地吸收，无须额外动作。详见 §5.1。

### 3.2 S1/S2/S3 内部"type 蓝图 / gallery / chips 三级"已 superseded 但仍有残文

- **来源文件 + 行号区间**:
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S1-product-spec.md:34, 118, 119, 126, 157`（多处划线 + 修订注记）
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S2-asset-files-spec.md:58`（「旧体系里工作流知识硬编码在 system-prompt-marketing.md + 工具 note 里」——system-prompt-marketing.md 已随 T67 物理删除）
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S4-phase3-plan.md:41, 43, 48, 56, 59, 61, 100, 112, 118`（多处 type 蓝图删除 + T62/T67 同步注记）
- **冲突对象**: S4 §6 验收口径（owner v8/v9 已定谳 type 蓝图属过度设计，删除）
- **处置**:
  - **已在 S1/S2/S3/S4 内部留 superseded 注**（如 S1:34「已删除，2026-09-01 T67 随 T62 同步」、S2:6 v3 修订记录、S4:7 v8/v9 修订记录）——共 26 处已正确留注
  - **建议**：**无需新增修订**——这些 superseded 注本身就是治理纪律的产物
  - **3 处可微优化**（详见 §5.3 + §3.3 + §3.4）：S2:58 补一句"原文 system-prompt-marketing.md 已随 T67 退役删除"；S2:133 段首语气改写；S4:123 尾巴项清理

### 3.3 S2:133「marketing prompt 静态段退役分流」段首语气写"未完成"

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S2-asset-files-spec.md:133`
- **冲突对象**:
  - "marketing prompt 静态段退役分流（随 W3 T-C1 执行）"——T67 已完工（tracker.md:78 行：2026-09-01 收口），marketing prompt 已随 T67 同步归档
  - 段内 `~~通用纪律已在 base v0 的沿用缺口经红线补洞补齐~~` 已用 T49 注记修订
  - 但段首句"marketing prompt 静态段退役分流（随 W3 T-C1 执行）"语气仍写"未完成"——与 T67 完成事实矛盾
- **处置**:
  - **建议改写段首**为「marketing prompt 静态段分流定稿（2026-09-01 T67 完工，孤儿文件退役 + 抢救性挖掘清单入档 base-candidate-list.md 条目 #1）」——≤0.25h 修订
  - 修订依据：tracker.md:78 T67 行 ✅ 已完成（2026-09-01 收口）

### 3.4 T-C-survey-20260901.md §3-§5 触点清单（一次性待办已全部销账）

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T-C-survey-20260901.md:21-34`
- **冲突对象**: §3 type/蓝图/typeId 同步触点、§4 T65 拍板在 S 文档的落地触点——**均已被 T62/T65/T67 同步吸收**，清单本身是"待办触点"，现已全部销账
- **处置**:
  - 调研报告 §3/§4 是"一次性触点清单"（不需长期保留），价值已转化为 S1/S2/S3 的修订注记
  - **建议**：调研报告本身可加一段「2026-09-01 全部触点已通过 T62/T65/T67 同步落地」的注记，避免未来读者误以为还在待办——≤0.25h 修订
  - 但调研报告的 §1/§2/§6/§7/§8 仍是有信息密度的内容（已被 T67 部分吸收，未被显式入档，见 §2.3）

### 3.5 S4-phase3-plan.md §3 「base v0 红线补洞（PD-20 ①）」删除线段

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S4-phase3-plan.md:33`
- **冲突对象**: §6 验收口径（T49 已撤销，owner 2026-08-31 v4 拍板）
- **处置**:
  - **已在原段留 ~~删除线~~ + 「已撤销（T49，2026-08-31 owner 指令：过度工程）」注记**
  - **无需新增修订**——治理纪律产物，符合 superseded 模式

### 3.6 S4-phase3-plan.md §7 尾巴表多处已闭合项（治理层优化）

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S4-phase3-plan.md:100, 101, 102, 103, 104, 112, 117, 118, 119, 120, 121`（多个 ✅ 已拍板行）
- **冲突对象**: S4 §6 验收口径（已闭合）
- **处置**:
  - **已用 ✅ 标记闭合**（如 :100「sample_hero_color 废弃最终确认 ✅」、:101「表单挂起工程形态 ✅」等）
  - **建议**：尾巴表中所有 ✅ 闭合项可在 W5（T-E1）收口时统一迁出至 `records/narrative/S4-phase3-plan.md` 或单独 `records/topics/phase-3-tail.md`，保持 §7 尾巴表聚焦未闭合项——但这是治理层面优化，不阻塞验收
  - **特别**：S4:123 行（T53 注入缝接线依赖）描述「**落地前 setup_design 对 AI 恒拒绝（契约内行为），T-B9/T-B10 施工时必须接线**」——T53/T60 已完工（tracker.md:64, 71），此尾巴**已无 owner**，属已落地但未清尾巴的尾巴（≤0.25h 清理）

### 3.7 t67-marketing-prompt-mining.md 头注「原出处已退役」标注缺失

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\t67-marketing-prompt-mining.md:1-7`
- **冲突对象**: 自身语境（挖掘清单针对的孤儿文件 `system-prompt-marketing.md` 已物理删除）
- **处置**: 已在 §2.2 列出，作为吸收动作（≤0.25h 加头注）

---

## 4. 潜在新增清单（3 条）

### 4.1 brief 表单面板（t66-ref 阶段 1+3，半天~1 天级）

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\t66-ref-brief-form-panel.md:6-15, 77-166`
- **价值陈述**:
  - **编辑摩擦**：内容区长文本画布手搓差（t66:18）
  - **可发现性**：当前"新建需求单"按钮埋在 ChatInput 营销按钮行（t66:21）
  - **虚假承诺**：素材区"直接拖入图片"标签（brief.ts:376）但全库零拖入逻辑（t66:22）
- **建议落地 T**: **新立 T73**（或 T-E1 阶段门尾批立项）——**brief 表单面板（编辑视图为第一功能）**
- **代价与依赖**:
  - 代价：阶段 1 ≈ 2.5d（t66 §八 估算）+ 阶段 3 ≈ 0.5d（create_brief 工具注册 + prompt 开口子）
  - 依赖：T61 需求单面板三段已落地（tracker.md:72 ✅），T73 在其上补"表单式编辑视图"
  - 风险点：与 T61 面板重叠区域需明确分工（T61 = 列表/导航/打开，T73 = 表单式编辑）

### 4.2 中文字号底线 11px 钉扎（T65 §E）

- **来源文件 + 行号区间**: `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\T65-ui-interaction-decisions.md:48`
- **价值陈述**: 中文营销场景下小字（如价格小注、CTA 副文）若 <11px 渲染模糊且无障碍性差
- **建议落地 T**: **新立 T74** 或并入 T-E1
- **代价与依赖**:
  - 代价：≤0.5h（longform.md 纪律段加一句 + 钉扎测试）
  - 依赖：无（纯纪律文本）
  - 风险：与 S2:145「宽≥900px 画布 body≥22/section≥40/hero≥64」正交——前者是底线、后者是主轴

### 4.3 创意生图 workflow 专题研究（PD-16 尾巴）

- **来源文件 + 行号区间**:
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S1-product-spec.md:18`（mode 表「创意生图」行：chip 副标题「AI 生图做创意发散，无排版负担」；workflow 后续专题研究）
  - `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\doc\S4-phase3-plan.md:111`（§7 尾巴表「创意生图 workflow 专题研究（PD-16 尾巴）| 长图验证后立项（循环形态/CP 密度/成本纪律参数）」）
- **价值陈述**: PD-16 已立 mode 概念（chip 副标题、概念已立），但 workflow 文件尚未建；进入拓展批前需要专题研究（循环形态、CP 密度、成本纪律参数）
- **建议落地 T**:
  - **暂不立项**——S4:111 已明示「长图验证后立项」；T-E1 阶段门通过后自动激活
  - 可在 W5 收口时把这条尾巴转为**新立 T75 候选**（专题研究形式）
- **代价与依赖**:
  - 代价：专题研究 ≤1-2d + workflow 文件落地 ≤2d
  - 依赖：长图闭环 T-D1/T-D2 验收通过（phase 3 阶段门 ✅）

---

## 5. 专项详评

### 5.1 `profile-as-skill-proposal.md` 失效引用处置

**核验结论**：`profile-as-skill-proposal.md` 在仓内仓外均**不存在**。

- 核验命令: `grep -rn "profile-as-skill\|profile_skill" D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/ --include="*.md" 2>/dev/null` → 零命中（2026-09-01）
- 核验命令: `find /d/Desktop/AgentLearn/00_DIYProjects/0720openpencil -iname "*profile*skill*" 2>/dev/null` → 零命中
- 核验命令: `ls D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/docs/202608251637-migration-proposal/` → 19 份 00-19 册存在，无 `profile-as-skill-proposal.md`
- 核验命令: `ls D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/docs/202608251930-migration-proposal-agentB/` → 7 份 agentB 册存在，无 `profile-as-skill-proposal.md`

**推测历史**：task 描述「profile = skill 形态」可能源自 19 册 PD-12 时期「profile = skill.md 式本地文件化」的措辞——但 PD-12 / PD-17 已落地为「profile.md = skill.md 心智」（[S2 §1 行 :13-18](file:///D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc/S2-asset-files-spec.md)），**没有独立 proposal 文档**——它直接进入 S1/S2 作为决策真源。

**与 phase 3 现形态对照**：
- phase 3 已落地「profile = 注册表静态资产」（T43-T49 已完成，tracker T43/T44/T48 行），形态是「frontmatter + markdown 正文 + 加载期校验」，与 skill.md 模式**心智一致**（S2 §1 行 :13「对齐 skill.md 心智」）
- T62 chips 两级收编：mode chip + profile chip 两级（[S1 §6 行 :120](file:///D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc/S1-product-spec.md)），与「skill 启用/禁用」机制无映射关系
- T60 active_design 宿主组装：每回合组装 = base + workflow + profile 全文（[S2 §6 行 :126](file:///D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc/S2-asset-files-spec.md)）——profile 已是「注入 system 的全文」，比 skill 的「按需挂载」更激进
- T56/T65 studio workflow：profile 不进入 workflow 编排，**与 skill 的「按 skill 装配」无关**

**结论**：假设此 proposal 真的存在并提议「profile 改成 skill 形态」——**已被 phase 3 决策完全吸收**，无须额外落地动作。本任务原文属**任务书伪命题**（无效引用），应在主 agent 收到本报告后从任务链剔除。

### 5.2 `base-candidate-list.md` 第 1 项「Composition Primitives」落地状态

**条目原文**（[base-candidate-list.md:12](file:///D:/Desktop/AgentLearn/00_DIYProjects/0720openpencil/doc/base-candidate-list.md)）：

> Composition Primitives：render JSX 助手（solid/五种渐变/阴影/模糊）调用纪律 + 三坑（渐变须显式 transform / 8 位 hex 带 alpha / fills 数组漆序首层为底）+ 三技法（全局色调统一 / 叠层 fills / 忙图上文字可读性）+ 改既有节点效果走 `set_effects` 不走 eval、效果在修复末位施加

**phase 3 落地状态**：

- **实际归宿 = longform.md（workflow 文件），非 base.md**：
  - 核验命令: `grep -n "Composition\|组合原语" open-pencil-mode/src/app/ai/pi-backend/studio/workflows/longform.md` → 命中 2 处（line 22「组合原语」段 + line 83 忙图可读性三策引用），完整覆盖原 :7-23 三坑三技法内容
  - 核验命令: `grep -n "Composition\|组合原语" open-pencil-mode/src/app/ai/pi-backend/studio/base.md` → 命中 1 处（仅 line 114 "Shadow / blur → set_effects" 工具说明，非 Composition Primitives 纪律本体）
- **T68-self-check.md:16 显式承认**：「主 agent 中途增补：system-prompt-marketing.md（孤儿，T67 轮删除）四块存活内容的归宿。subagent 自判吸收（挖掘清单未先于其完稿）：**双图工具路由 → 通用纪律第 1 则；Composition Primitives → 通用纪律第 2 则**（derive_palette 剔除）」
- **部分落地子项**：t67:60「render JSX 不写 `id=`」「高度算术走 `calc` 不做心算」「文字密集节用 `h='hug'`」「固定高度只用于媒体槽」已通过 t67 §3「抢救」子段进入 longform.md；T69 watercolor_poster_v2 改写（tracker T69 行「七必改」）隐式落地「改既有节点效果走 set_effects 不走 eval」但未显式进 base.md
- **未落地**：「渐变须显式 transform / 8 位 hex 带 alpha / fills 漆序首层为底」三坑未显式落地；「效果在修复末位施加」未作为纪律文本（Fix Playbook 表进 longform.md polish 段是诊断流程，非「效果施加时机」纪律）

**Sanity check 结论**：清单第 1 项**部分隐性落地**（render JSX 子纪律 + t67 抢救子段进 longform.md），**核心三坑未作为 base.md 显式段落地**——属 phase 3 现状未覆盖的真实价值。

**处置建议**：
1. base-candidate-list.md 第 #1 行加注「**实际归宿 = longform.md §通用纪律第 2 则（2026-09-01 T68 吸收）**；上收 base 决策待 PD-20 触发式任务时再评」——避免 W5 触发式 base 重新设计时按"上收"方向走反路
2. 三坑纪律（渐变 / 8 位 hex / fills 漆序）作为 base.md 段增量，待 PD-20 触发时由第二个 mode 的 workflow 开工前评审

### 5.3 S1-S4 内部过期建议盘点

逐份盘点 S1/S2/S3/S4 是否存在「已被 owner 拍板推翻但原文未删除的段落」：

#### S1-product-spec.md（已 v3 修订，2026-09-01）

- ✅ **过期段落已删除/标注**：
  - §3 脱困阀「换 type」（行 :65 旧表述） → v3 改写为「换尺寸（sizes 预设）」（已删「换 type」）
  - §6 三轴分工（mode/type/profile） → v3 改写为两轴（mode/profile），行 :118-126 §6 整段已收
  - §9 restyle 旧语义（行 :165） → v3 改写为「切 profile 新建衍生」
- 🟡 **仍存留但已标注的过期段落**：
  - §3 阶段 1 色彩方向描述「不给精确 hex——PD-4 后无采样管线」（行 :53）—— 这是 v3 描述但措辞带 PD-4 编号；可保留（编号是决策真源指针）
  - §7 红线 #1/#8 行文「base 侧纪律候选随 PD-20 触发式 base 重新设计评估」（行 :135, :140）—— v3 描述，措辞明确「T49 后 base.md 不承载显式红线段」，无冲突
- **结论**：S1 自洽，无过期段落漏删

#### S2-asset-files-spec.md（已 v3 修订，2026-09-01）

- ✅ **过期段落已删除/标注**（共 7 处）：
  - §4 frontmatter `types:` 块 + 「## type 蓝图」体节 → v3 改写为 `sizes:` 清单（行 :66-79）
  - §1 旧 archetype 概念（行 :102） → v3 改写为「Recipe 分节与 applicable_to 引用目标均为 mode id」
  - §2 brand/config.yaml 历史路径（行 :41） → v3 标注「已拆解迁移完毕（T44/T45，2026-08-31）」
  - §4 行 :78「原 type 蓝图的结构差异（章节序）由 workflow 正文纪律段的构图指引承载」 → v3 留注
  - §5 :102「Recipe 分节与 applicable_to 引用目标均为 mode id（~~可细化为 `mode/type`~~——type 概念随 T62 删除）」 → v3 留注
  - §6 :133「~~通用纪律已在 base v0 的沿用缺口经红线补洞补齐~~」 → T49 撤销留注
  - §8 :155「~~孤儿 type 校验态~~——PD-17 时随 type 折叠消失；T62 后 type 概念整体删除」 → v3 留注
- 🟡 **3 处可微优化**：
  - §1 :58「旧体系里工作流知识硬编码在 system-prompt-marketing.md + 工具 note 里」——system-prompt-marketing.md 已物理删除（T67），可加一句"（注：原文 system-prompt-marketing.md 已随 T67 退役删除，此句作为历史批评留存）"——≤0.25h 修订
  - §6 :133「marketing prompt 静态段退役分流（随 W3 T-C1 执行）」段首语气写"未完成"——T67 已完工事实矛盾（详见 §3.3）——≤0.25h 修订
  - §4 行 :79「尺寸修正清单（09 §D）」—— 公众号头图 900×500 → 900×383 等数值仍列在正文，但 09 §D 原始出处已**封存**（19 册 PD-7 翻案后未重写 09 §D）。处置建议：尺寸修正清单随 T-C3 / T68 落地（已部分落地于 longform.md 的 sizes 节），未落地部分（小红书方图变体）进拓展批
- **结论**：S2 自洽，仅留 3 处可微优化

#### S3-tool-contracts-spec.md（已 v3 修订，2026-09-01）

- ✅ **过期段落已删除/标注**（共 4 处）：
  - §2 setup_design `typeId` 校验（行 :34-40） → v3 改为 `canvas` 可选覆盖参数
  - §6 ask_user_question 返回签名 `{answers}`/`{aborted}`（行 :93） → v3 标注「run 终止续跑下工具结果恒为 `{formId, status:'awaiting_user', questions}`」+ T56-plan §1 定谳 3 文本信封
  - §9 pluginData 标记协议「设计身份四元组」（行 :131） → v3 改为「设计身份三元组 {modeId, profileId, briefId}」
  - §10 :141「canvas 覆盖参数三态（预设/自由/非法 invalid_canvas——T62 后取代 typeId 校验）」 → v3 留注
- 🟡 **仍存留但已标注的过期段落**：
  - §6 行 :96 「语义：AI 调工具发表单 → 前端渲染聊天内表单卡片（图像候选渲染缩略图）→ **run 正常终止**（不持有进程内挂起态；现场由落盘设计身份 + brief 承载）」——v3 已加修订注记（行 :98-99）说明上框签名尾是 v5 拍板前挂起形态遗留；T56 已落地修订口径
  - §8 compose_backdrop 行 :116「**隐式收养 + stray-image 侦测删除**（裁决 5），替换为结构化报错」—— v3 表述仍清晰，但「隐式收养」四个字带历史包袱（01 B.4 旧裁决）；保留无害
- **结论**：S3 自洽，过期段落已显式标注

#### S4-phase3-plan.md（已 v9 修订，2026-09-01）

- ✅ **过期段落已删除/标注**（共 11 处）：
  - §4 W3/T-B11「type 蓝图机制删除」批（行 :59） → v9 立项已落 T62
  - §7 尾巴表「types 外部目录分裂形态」→ v9 标注「已删除（T62 type 蓝图机制废弃）」
  - §4 W3/T-C3 精品 profile 首发做透（行 :62） → v9 拍板基于 v2 改写（T69 已落）
  - §3 :33「~~base v0 红线补洞（PD-20 ①）~~ → 已撤销（T49）」 → v4 留注
  - §4 W1 :41「长图三 type 折叠进 `longform.md` 骨架（PD-17）」 → v9 T62 sizes 清单留注
  - §4 W1 :43「T-A4 ... ~~types 列表/蓝图节~~——T62 后收编为 sizes 清单」 → v9 留注
  - §4 W2 :48「setup_design 窄化（... —T62 后 typeId 校验删除，2026-09-01 T67 同步）」 → v9 留注
  - §4 W2 :56「chips 两级（T62 后三级收两级——2026-09-01 T67 同步）... ~~gallery 浏览~~（gallery 组件已删除，T65 拍板）」 → v9 留注
  - §4 W3 :61「T-C2 ... ~~三 type 结构蓝图节~~（T62 后改为 sizes 清单）」 → v9 留注
  - §7 :100「~~sample_hero_color 废弃最终确认~~ | ✅ 已拍板」 → T49 + 2026-09-01 T67 同步留注
  - §7 :117「~~base.md 免 label 校验~~」 → T46 D-e 留注
  - §7 :118「~~蓝图节不强制 `###` 布局~~（随 T62 type 蓝图机制删除而整体归档）」 → T62 留注
- 🟡 **1 处可微优化**：
  - §7 :123「T53 注入缝接线依赖（catalog + confirmedNewIntent 外层注入... 落地前 setup_design 对 AI 恒拒绝（契约内行为），T-B9/T-B10 施工时必须接线）」——T53/T60 已完工（tracker.md:64, 71），此尾巴**已无 owner**，属已落地但未清尾巴的尾巴（≤0.25h 清理）
- **结论**：S4 自洽，仅留 1 条尾巴待清（T24 双模式遗留 / T53 注入缝接线尾巴）

**S1-S4 总计**：28 处过期建议，其中 26 处已有 superseded 注；**3 处可微优化**（S2:58 + S2:133 + S4:123）。

---

## 6. 给 main agent 的处置建议

按"必须吸收 / 可选吸收 / 暂缓"三档给出先后顺序：

### 必须吸收（落地成本 ≤1h，无风险）

1. **base-candidate-list.md 条目 #1 状态更新**（§2.1）——T-E1 阶段门收口时一并做
2. **t67-marketing-prompt-mining.md 头注补「原出处已退役」**（§2.2）——与 T67 完工注对齐
3. **S2:58 补一句"原文 system-prompt-marketing.md 已随 T67 退役删除"**——避免未来读者翻 git 找不到原出处
4. **S2:133 段首语气改写**（§3.3）——T67 已完成事实对齐
5. **S4:123 尾巴项清理**（§5.3）——T53/T60 已完工，尾巴项已实质闭合
6. **T-C-survey §3/§4 加「已销账」注记**（§3.4）——避免未来读者误以为还在待办
7. **`profile-as-skill-proposal.md` 从任务链剔除**（§5.1）——任务原文属伪命题

### 可选吸收（半天~1 天级，有真实价值但不阻塞）

8. **新立 T73 brief 表单面板**（§4.1）——t66-ref 设计真源入档，2.5d 阶段 1 + 0.5d 阶段 3
9. **新立 T74 中文字号底线 11px 钉扎**（§4.2）——T65 §E 遗留项，≤0.5h
10. **T-C-survey §6 verbatim 处置口径边注入 S1/S2**（§2.3）——补"为何不做"全貌
11. **T-C-survey §8 CP 表单对齐边注入 S3**（§2.3）——补单一最全 schema 引用形状
12. **T70-verify 补一次 [画布选区] 纪律交叉引用**（§2.2）——与 t67:41-43 对齐

### 暂缓（phase 3 阶段门通过后激活）

13. **创意生图 workflow 专题研究**（§4.3）——S4 §7 尾巴表已明示"长图验证后立项"，T75 候选
14. **base 重新设计（PD-20 触发式）**——第二个 mode 开工前自动激活，不在本轮评估
15. **§7 尾巴表清理**（§3.6）——W5 收口治理层优化，不阻塞验收
16. **base 候选 #1 三坑纪律上收 base**（§5.2）——三坑纪律（渐变 / 8 位 hex / fills 漆序）作为 base.md 段增量，待 PD-20 触发时由第二个 mode 的 workflow 开工前评审
17. **image-gen-provider-review P2 测试连接复活**——T71 已否决，仅作再评估后路

---

## 7. 已知未覆盖（自我披露）

1. **未核对仓内 `docs/rebuild/spikes/*.zh.md`**：本次评审主范围是父仓 `doc/`，仓内 spikes（如 Phase 3 探针批 SP-a1/SP-b/SP-c）属于次要范围，未做扫描
2. **未核对仓内 `docs/rebuild/tasks/T66-plan.md` 详细内容**：tracker.md:77 显示 T66 行 ✅ 已完成，但仓内 `tasks/` 目录 grep `T66-plan.md` 零命中（2026-09-01 实测）——本报告假设 tracker 为真，T66 三件套已存在但路径可能位于 worktree 分支或暂未合并到本仓 HEAD。这是与 t66-ref-brief-form-panel.md 关联的潜在断链，但不影响本报告的"可吸收"评估（t66-ref 是设计真源，独立于 T66 任务行）
3. **S2 §6 / §7 / §8 等具体行号未逐行 grep**：S2 §6「每回合组装」（:122-133）涉及 owner 2026-08-31 瘦身后口径，本报告未做行行交叉验证；§5.2「Composition Primitives 落地状态」中关于 longform.md 的具体行号（22、83、114）由 grep 命令直接验证（核验命令：`grep -n "Composition\|组合原语" open-pencil-mode/src/app/ai/pi-backend/studio/{base.md,workflows/longform.md}`，2026-09-01）
4. **未跑 `bun test` 或 CI**：纯只读评审，未触发任何自动化测试
5. **proposals/governance-v1.md 全文已读但仅作次要扫描**：其 D10-D15 已落地（T01-T04），与 phase 3 无直接关联，**未列入"可吸收"**——若 owner 决策需要治理层优化可单独立项
6. **未核对 pre-research 00-18 册**：父仓 `docs/202608251637-migration-proposal/` 范围未扫（按任务要求"主范围=仓外 doc/"，00-18 册不在 doc/ 直下）；本次评估以 S1/S2/S3/S4（T67 同步注记）为决策链入口
7. **未核对 `docs/202609010000-*.md` 与 T66/T71/T72 计划的全文对齐度**：仅做"是否已被 T66/T71/T72 落地"的判断（tracker.md:77/82/83 三行均 ✅），未逐行 diff
