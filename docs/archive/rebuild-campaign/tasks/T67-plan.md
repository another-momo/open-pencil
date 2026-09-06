<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T67 计划 · Phase 3 W3/T-C1：marketing prompt 静态段分流定稿 + S 文档同步

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：doc/T-C-survey-20260901.md（仓外，2026-09-01，全触点清单带 文件:行号）

## 1. 范围

### A. system-prompt-marketing.md 分流定稿（仓内 src/app/ai/pi-backend/prompts/）

按调研 §5 裁定执行（行号以现状文件为准，施工时重新核对）：

**原地修订（不迁移）**：
1. derive_palette 死引用清除（PD-4 已拍板废弃）：:99「When the recipe continues with `derive_palette`…」句、:139「When a `derive_palette` color ticket exists…」段——改写为 compose_backdrop 自动采样语义（色票角色体系已随 derive_palette 废弃，一致性检查只保留 palette/font/spacing 核查，section 颜色来源改写为「profile 配方与 compose_backdrop 采样结果」）。
2. verbatim 段按 PD-8 改写（调研 §6 已定谳：可创作、不加标注段）：:29「Use this text verbatim…」、:66「Verbatim-marked copy must be explicitly confirmed…」改写为「brief 内容区是约束性输入，遵循其事实与约束；文案表达允许创作」。**:59 initial_content 逐字转录纪律不动**（S1:114 需求保真）。
3. checkpoint 口径现代化：:47「At a checkpoint you send a text message WITHOUT any tool calls」——T56 后 checkpoint = ask_user_question 表单（run 终止续跑），改写为表单口径；全文各「ask … and STOP」表述保持（语义等价：发表单即终 run）。
4. restyle/修改请求句（:49）按 T65 拍板⑧改写：换风格 = 切 profile 新建衍生（原设计保留），其余修改请求维持「直接编辑既有节点，跳阶段」。
5. 「Active style profile」措辞（:51 等）改 PD-19 后装配事实：profile 全文进 system（不再是 overlay 追加段），措辞改为「若 system 中包含 style profile 文件…」。
6. brief 协议段（:25-39）：S1 §5 已是四区（含关联设计区），现文是旧三区口径——按四区重写（关联设计区只读投影 + 绑定语义）。
7. T66 收口已修的 :137 备份泄露句保持现状（不再动）。

**迁移分流（内容落 longform.md 归 T68，本任务只删不迁）**：:45-152 的 Phase 0-4 长图专属流程段、:154-156 Design State Tracking（由 resume 协议取代）、:158-179 Section 实现模式、:181-183 Step budget。
**分流后的 system-prompt-marketing.md 留存面**：双图工具路由（:3-5）、Composition Primitives（:7-23）、brief 协议（四区重写后）、[画布选区]（:41-43）、profile 权威（改写后）。——即「workflow 通用、所有 render 型 mode 为真」的内容。

**裁决说明**：Phase 段整段移出后 marketing prompt 是否还有存在意义？——有：marketing mode 家族（不止 longform 一个 workflow）共享的通用纪律留此；长图专属执行序归 longform.md。若迁移后留存面过薄（<40 行），实现 subagent 可反向裁决「全量并入 longform.md、marketing prompt 文件退役」，但须在 self-check 记录证据链（装配面 modes.ts/service.ts 的引用同步清理）并经核验确认。

### B. base 候选清单补记（仓外 doc/base-candidate-list.md）

按调研 §5：Composition Primitives 段（:7-23）记为 base 候选强条目（对所有 render 型 mode 为真的渲染技术纪律）。格式照 :10-11 表头，位置栏注明实际出处文件（system-prompt-marketing.md 行号）。

### C. S 文档同步（仓外 doc/S1/S2/S3/S4）

按调研 §3/§4 触点清单逐条执行：
- **T62 同步**（调研 §3 全清单）：S1（:34/:47/:65/:102-104/:110-111/:118-126/:157/:180）、S2（:25/:40-41/§4 :56-94/:102/:139/:160/:167/:173/:176）、S3（:30/:33-44/:56/:122/:128/:138/:146）、S4（:43/:48/:56/:61/:112/:118）——type/蓝图/typeId 行文收编为 sizes 清单语义（T65 拍板⑪⑫：名称+预设、用户按名称选或自定义、agent 语义自选）+ 三元组身份。
- **T65 同步**（调研 §4）：gallery 删除注记（S1:119/S2:17/:102/:142/S4:56）；chips 哲学（S1:121「回显只是草稿默认初值，拨动才产生语义」）；**S1:111 需求单面板全文档扫描 → 当前页口径**（直接冲突项）；S1:110 补「新建需求单只建 brief 不触发 setup_design」；S1 §5/§9 补切换回执=分割线一行。
- **restyle 新语义**（T65 拍板⑧）：S1:165/:121 末句/:207、S2:86——「原地重入」改「切 profile 新建衍生（旧设计保留，携带物经确认卡勾选）」。
- 修订方式：沿用各文档既有修订注记惯例（文首 revision 行或行内注记），不静默改写历史定谳。

## 2. 领土与门禁

- 仓内：src/app/ai/pi-backend/prompts/system-prompt-marketing.md（单文件）；若触发装配面（modes.ts/service.ts 引用清理）须同步并在 self-check 记录。
- 仓外：doc/S1-S4、doc/base-candidate-list.md（不经 zones/CI）。
- 门禁：`bun run smoke:pi`（t24 prompt 装配冒烟必跑）+ `bun test ./tests/engine/rebuild`（prompt 内容断言若存在须同步）+ typecheck（若碰装配面）。grep 复查：derive_palette/sample_hero_color 在 prompts/ 与 studio/ 零残留（v3 profile 除外——v3 随其改写轮处理，T69 不做）。

## 3. 不做清单

- longform.md 内容填充本体 → T68（本任务只把分流裁定落地为「移出」，迁入内容定稿归 T68）。
- watercolor_poster_v2 改写 → T69；v3/editorial/solid 不动。
- base.md 本体不动（候选清单只是建档，下放与否 W5 裁决）。

## 4. 验收标准

1. system-prompt-marketing.md：derive_palette/verbatim/checkpoint 纯文本口径/restyle 旧语义/Active style profile 旧措辞五类死口径零残留（grep）；留存面 ≤ 调研 §5 清单范围。
2. doc/base-candidate-list.md 补记条目格式合规。
3. S1/S2/S3/S4 触点清单逐条落地（调研 §3/§4 全清单核对表，核验 subagent 抽查 ≥10 条带行号）。
4. smoke:pi + rebuild 测试全绿；若 marketing prompt 全量并入 longform.md 的反向裁决被采纳，装配面引用零残留。
5. 三件套齐 + 核验 PASS 后 flip tracker。
