<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T62 计划 · Phase 3 W3/T-B11：type 蓝图机制删除（过度设计，owner 2026-09-01 v8 拍板）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：T62 调研 subagent 2026-09-01（全触点清单 + 切除段 :145-242 精确范围在案）

## 1. 切除范围（调研实证，文件:行号）

- `setup.ts`：:59-71 catalog types 形状、:81/106/109-111/120-121 信封 typeId、:90-99 三错误码（九码收六码：type_not_in_mode/type_forbidden/type_required 删）、**:145-242 切除段整段**（parseBlueprintSize/ResolvedBlueprint/validateProfileId 中 type 部分/resolveBlueprint）、:254/263 命名域去 typeId、:344/368 落盘与信封、:382/398 读穿。前瞻注记注释同步删。
- `brief.ts:62` DESIGN_TYPE_KEY 删；`brief-edit.ts:82,192,201` 投影 typeId 删。
- `texts.ts:47,53,60-65` type 三条文案删 + catalogUnavailable/generalDesignName 措辞改。
- `setup-tool.ts:29-42` ToolDef 去 typeId（description 大段 type 文案同步删）。
- `setup-catalog.ts:21,35-39`：投影收为 `{modes:[{id,label}], profileIds[]}`。
- studio：`types.ts:17-24,41-42`（StudioWorkflowType + workflow.types）、`validate.ts:59-104,106-165`（parseWorkflowType/SIZE_RE + types 校验段含蓝图节校验；stepBudget/subtitle 保留）、`registry.ts:166,177`、`manifest.ts:13,19,52,58`。
- `workflows/longform.md`：frontmatter types 列表删 + `## type 蓝图` 节做**最小改写**（只留 mode 级尺寸说明，内容精品重写归 T-C2）。
- `prompt-overlay.ts:17,26,31-64`：material types 段整段 + T24 遗留一并清理（自 T60 让渡，避免同文件撞车）；`prompts/system-prompt-marketing.md:55-65,92,166` 死引用最小同步删除（内容重写归 T-C2）。
- `studio/parse.ts:82-84`：三级索引保留（无害），注释口径改写。
- 测试：setup.test.ts ⑦typeId 三态整例删、①②尺寸语义重钉、⑥ types:'none' 断言改、信封/落盘/读穿/命名/注入缝用例去 typeId；studio/registry.test.ts C3 四例删改；manifest.test.ts 两处删改；builtin-assets.test.ts 三 type 钉扎改；brief.test.ts:335,358 投影删。

## 2. 定谳（主 agent 拍板，owner 授权 W3 删除范畴内）

1. **尺寸语义重钉**（删除后最大空洞）：画布尺寸来源改 **workflow frontmatter 可选 `canvas: <宽>x<高>`**；缺省 = 750 宽 + 高度 HUG（现状 general 语义不变）。longform.md frontmatter 落 `canvas: 750x2000`（实现 subagent 先读 longform.md 原 types 蓝图尺寸，若主蓝图非此值则以原主蓝图值为准并在 self-check 记录证据）。setup_design 信封 size 语义不变（{width, height|null}）。
2. **schemaVersion 不 bump**：读穿侧容忍旧画布的 `typeId` 残留键（忽略未知键），写入侧不再写；命名去重域收为仅 modeId（旧画布既有名称仅为展示字符串，无兼容动作）。BRIEF_SCHEMA_VERSION 机制本身不动。
3. **设计身份 = 三元组 {modeId, profileId, briefId}**（T60 同口径）；S1/S2/S3/S4 行文同步归 T-C 批次（触点清单调研蓝图 §五已备）。
4. **chips 三级收两级**：存量 UI 无 type 级触点（调研实证 type chip 从未落地）——本任务只删 manifest.modes[].types 数据面；T61 chips 按数据驱动渲染，types 缺席自然两级。
5. **validation order** 收为：confirmedNewIntent → brief → mode → profile；general 恒过；unknown_mode/catalog_unavailable 等其余六码保留。

## 3. 不做清单

- S1/S2/S3/S4 蓝图节改写、longform.md 内容精品化、system-prompt-marketing.md 内容重写 → T-C1/C2/C3。
- studio parse 三级索引机制删除（保留）。
- fork/index.ts 注册面不动。

## 4. 验收标准

1. 全仓（src/ packages/ tests/）grep `typeId|blueprint|蓝图` 零命中（除 git 历史与仓外 doc/ 规格、无关同名如字体 budget blueprint 措辞——名单以调研蓝图为准逐条核对）。
2. `bun test tests/engine/rebuild/` 与 smoke:pi 全绿；九门禁 unpiped 全 exit 0。
3. setup_design 契约：九码收六码、信封无 typeId、catalog 投影无 types、尺寸按定谳 1。
4. 三件套齐 + 核验 PASS 后 flip。

## 5. 红线

- 只删 type 蓝图机制；mode/profile/brief 语义、五键 stamping 其余键、schemaVersion 机制不动。
- prompt-overlay.ts 清理限 material types 段 + T24 遗留；其余 overlay 逻辑不动。
- zones.json 零新增（落点全在已登记领土）。
