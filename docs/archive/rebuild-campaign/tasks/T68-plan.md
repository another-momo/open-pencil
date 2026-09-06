<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T68 计划 · Phase 3 W3/T-C2：longform.md 内容填充

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：doc/T-C-survey-20260901.md（仓外）§1/§2/§8；前置：T67（分流定稿）

## 1. 范围（longform.md 单文件重写，src/app/ai/pi-backend/studio/workflows/longform.md）

现状：骨架三节（阶段定义 1 段概述 / 画布尺寸 / 纪律挂点清单），全部「随 T-C2 填充」占位。本任务填实：

### ① 阶段定义全文化（调研 §1 为内容源，S1 §3 为权威）

五阶段逐节写清：**阶段 0 需求接入**（read_brief → 无则 create_brief 逐字转录 → setup_design 仅新建；续作不调 setup）；**阶段 1 方向提案**（大纲+方向只给风格词/构图/色彩氛围不给 hex——PD-4；标题/CTA 由 AI 撰写——PD-8；事实缺失表单内追问）；**阶段 2 hero 物化**（标题最小版式前置 → prepare_hero_scaffold → generate_image 候选 ×2~3 全分辨率——PD-1；单变量受控变异；整批拒绝重生——PD-3 成本提示）；**阶段 3 结构与填充**（skeleton → compose_backdrop 幂等采纳 → 逐节 render→describe→修 error→自检行 → polish 段）；**阶段 4 终审**（describe 全量 + look 分区钻取，禁止全览判断小字；残余事实写 AI 结论区）。

### ② 工具白名单按阶段声明（S2:92 机制：白名单按文件声明）

逐阶段列出该阶段允许的工具集合（setup/read_brief/create_brief/ask_user_question/prepare_hero_scaffold/generate_image/stock_photo/render/describe/look/compose_backdrop/calc/batch_update/set_fill/set_effects/append_brief_conclusion/find_nodes 等——实现 subagent 以仓内实际工具注册面（fork/index.ts FORK_TOOLS + pi-backend tools.ts）为准逐个核对存在性，不得引用不存在工具）。

### ③ CP 表单结构定义（调研 §8 形状对齐 ask_user_question）

- CP1（阶段 1 末，文本表单）：single_select 方向选项集 + text 缺事实追问 + 标题文案锁定确认（「标题在此锁定：同时充当生图参照与最终画面文字」S1:56）；必带「其他/补充」逃生口（S3:94）。
- CP2（阶段 2 内，图像表单）：image_select 候选 nodeId 择优 + 图片来源确认。
- CP3（阶段 3 填充前，渲染图表单）：骨架结构确认 + **色调氛围与方向锁定一致性确认**（S1:71-73：截断「色调跑偏」返工半径——配色无专用工具 PD-4）。
- CP4（阶段 4 末，图像表单）：终审确认。
- 运行语义引用 T56 契约：工具结果 `{formId, status:'awaiting_user'}` 即 run 终止续跑；作答/跳过信封格式；表单内不提供 mode 切换入口（S1:95）。

### ④ 脱困阀（PD-18，T62 修订后定稿）

整批重生 ×2 仍未选中 → 强制回 CP1 重提案；CP1 重入选项集 = 改方向描述 / 换 profile / 换尺寸预设 / 换模式（「换 type」已删——T62；换尺寸 = sizes 清单内另选或自定义，T65 口径）。选「换模式」走宿主 Case B 确认流，不在表单职责内（S3:98）。

### ⑤ resume 协议（调研 §2）

runState 不落盘；续作现场 = 画布产物 + brief 结论区 + 会话历史三重 ground truth（S1:102）；fill 超预算收尾 = 写进度进 brief 结论区 + 固定话术（S1:88）；续作组装 = 按落盘 mode + resume 读现场重建（S1:106）。

### ⑥ restyle 新语义（T65 拍板⑧）

restyle = 切 profile 新建衍生：旧设计保留，携带物经新建意图确认卡 Case B 勾选；不做原地重入（S1:165 旧文由 T67 同步）。

### ⑦ Fix Playbook 表（S1:174 形状：症状→检测→动作→升级条件）

进 polish 段。行项起步集（实现 subagent 按仓内 describe 实际报错码/警告类型核对可检测性后定稿，只写工具能检测或 look 能验收的症状）：文字溢出/截断、对比度不足、占位符残留（灰块未填）、跨节 palette 漂移、hero 接缝可见、字阶越轨（下接⑧）、图片内嵌文字（garbled text）。

### ⑧ 画布尺度字阶规则（S2:145 出处，数值随精品集定稿校准）

宽 ≥900px 画布 body≥22 / section≥40 / hero≥64——落到 sizes 两预设分别校准（750x 与 1080x 各自的字阶梯；与 T69 v2 Fixed system 的 750 字阶对齐，矛盾时以 profile 为准并在文中声明优先序）。

### ⑨ sizes 节定稿（T65 已落 frontmatter [电商详情长图 750x, 小红书长图 1080x]）

正文保留 T65 语义段（用户按名称显性选/自定义；agent 语义自选；缺省首选预设），补齐「尺寸与内容结构的关系」（长图分区章节序随内容驱动，不设固定分区模板——S1 §3 内容驱动原则）。

## 2. 边界与门禁

- 仓内单文件：workflows/longform.md（frontmatter 不动——id/label/subtitle/step_budget/sizes 维持 T65 现状；正文重写）。
- 校验：studio validate.ts 对 workflow 文件有 schema 校验——重写后 `bun test tests/engine/rebuild/studio/` 必过（内置资产钉扎测试含 longform）。
- T67 迁出的 Phase 段内容若被本任务吸收改写，以 S1 §3 为权威源重新表达（不逐字搬运——旧文含纯文本 checkpoint 等过期口径）。
- 门禁：`bun test ./tests/engine/rebuild`、`bun run smoke:pi`（t24 装配冒烟——longform 正文进 system，断言若有内容钉扎须同步）、`bunx oxfmt --check`（md 不在 oxfmt 面内则不跑）。

## 3. 不做清单

- profile 文件改写 → T69；marketing prompt 分流 → T67；S 文档同步 → T67。
- step_budget 数值调整（维持 50，除非实现中发现 S1 另有定谳——查到则改并记录证据）。
- CP 表单的 UI 侧改动（表单渲染器 T56 已就绪，本任务只写 workflow 文本）。

## 4. 验收标准

1. longform.md 九项内容全部填实，无「随 T-C2 填充」占位残留（grep）。
2. 工具白名单逐名与注册面对账（核验 subagent 抽 5 个工具名 grep 注册面实证存在）。
3. CP 表单定义与 ask_user_question schema 逐字段对齐（kind/options 数域/逃生口/信封格式）。
4. studio 测试 + rebuild 全套 + smoke:pi 全绿。
5. 三件套齐 + 核验 PASS 后 flip tracker。
