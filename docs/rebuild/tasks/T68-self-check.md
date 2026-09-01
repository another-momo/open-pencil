# T68 自检 · longform.md 内容填充

> 日期：2026-09-01。实施 = subagent（中断恢复后续作），集成验收 = 主 agent。
> **核验轮追记（2026-09-01）**：独立核验 V3 判 FAIL——挖掘清单三项抢救内容（Section 模式库 / ambiguous 不建 / :49 修改路径段）未见落点。主 agent 补写：「歧义纪律」段（阶段 0）、「修改请求路由」段（restyle 节首）、「Section 模式库」节（四则 + W 参数化声明），longform 144 → 156 行。复跑门禁全绿，复验 PASS（详见 T68-verify.md 末节）。

## 1. 交付

`src/app/ai/pi-backend/studio/workflows/longform.md` 单文件正文重写，**144 行**（≤200 自控线），frontmatter 未动（id/label/subtitle/step_budget/sizes 维持）。零「随 T-C2 填充」/「待 T-C」/「derive_palette」残留（grep exit 1）。

## 2. 九项落点（节名 → 行号面）

①五阶段全文化 → 阶段 0~4 五节（做/不做/工具/CP 挂点，S1 §3 逐条转写）；②工具白名单 → 执行总纲 + 各阶段「工具」行（31 名全部对账注册面：fork/index.ts FORK_TOOLS / pi-backend tools.ts / registry-core / registry-extended，对账表在 subagent 汇报）；③CP1-CP4 表单结构 → Checkpoint 表单节（kind/options 2..12/imageOptions 1..12/逃生口/{formId,status:'awaiting_user'} run 终止/信封原文）；④脱困阀 → PD-18 节（重生 ×2 → CP1 重入，选项 = 改方向/换 profile/换尺寸/换模式）；⑤resume 协议 → runState 不落盘 + 三重 ground truth 三步序 + 超预算进度行 + 固定话术；⑥restyle → 切 profile 新建衍生（T65 拍板⑧）；⑦Fix Playbook → 7 行表（检测项全部经 describe/look 实现核对）；⑧字阶规则 → 1080x 档 22/40/64 + 750x 档 20/36/72 + 「与 profile 冲突以 profile 为准」；⑨sizes 节 → T65 语义段保留 + 尺寸与内容结构关系段。

## 3. 范围增补执行（孤儿文件吸收）

主 agent 中途增补：system-prompt-marketing.md（孤儿，T67 轮删除）四块存活内容的归宿。subagent 自判吸收（挖掘清单未先于其完稿）：双图工具路由 → 通用纪律第 1 则；Composition Primitives → 通用纪律第 2 则（derive_palette 剔除）；brief 四区协议 → 通用纪律第 3 则（与 S1 §5 对账后补可操作细节）；画布选区纪律 → 通用纪律第 4 则。剔除面（type 时代残留/旧 CP 纯文本口径/verbatim PD-8 旧措辞/restyle 旧语义/State Tracking/Style Profile Authority 宿主化段）未带入。**集成复核：挖掘清单 longform 目标项逐项 grep 命中，见 T67-self-check §3。**

## 4. 门禁

- subagent 面：`bun test` 隔离钉扎面 86/86 绿；`smoke:pi` exit 0。
- 集成面（含 T67 删文件 + T69 同批）：`bun test ./tests/engine/rebuild` exit 0（380/0）、`smoke:pi` 0、lint 0、typecheck 0、format:check 0（longform.md 已经 oxfmt --write 归一）、check:zones 0、check:tasks 0。

## 5. 与 S1 出入记录（subagent 汇报原文收录）

1. CP1 重入选项集：「换 type」删、「换尺寸预设」补（T62/T65 口径，plan ④ 授权）。
2. restyle：S1:165 旧「阶段 1 重入」→ T65 拍板⑧覆盖（plan ⑥ 授权）。
3. CP3 载体：S1:71「渲染图表单」→ single_select ×2（骨架确认 + 色调确认）——image_select 须引用画布 nodeId，CP3 确认对象是骨架结构非候选择优（survey §8 同口径）。
4. 750x 字阶梯 20/36/72 系按 v2 profile Fixed system 下限校准（plan ⑧ 授权）；**集成复核：与 T69 落地后 profile :15 的 750 tier 下限（72/36/20）一致，1080 档 profile 区间（104–158/52–70/28–34）均在 workflow 下限（22/40/64）之上，无冲突。**
