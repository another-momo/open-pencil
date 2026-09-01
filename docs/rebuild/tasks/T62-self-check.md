<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T62 自检 · Phase 3 W3/T-B11：type 蓝图机制删除

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 实现段核验（2026-09-01 实测填报）

- **C1 切除面**：22 文件——setup.ts（:145-242 切除段整段删 + 外溢 4 处：信封/落盘/读穿/命名域）、brief.ts DESIGN_TYPE_KEY 删、brief-edit.ts 投影删、texts.ts type 三条删、setup-tool.ts 去 typeId；setup-catalog.ts 投影收 `{modes:[{id,label}], profileIds[]}`；studio types/validate/registry/manifest/parse/index 去 types 面；prompt-overlay.ts material types 段 + T24 遗留整段删；system-prompt-marketing.md 死引用删；longform.md types 删 + canvas 落 + 蓝图节改 mode 级「画布尺寸」节。
- **C2 契约收编**：九码收六码；validation order = confirmedNewIntent → brief → mode → profile；信封/读穿无 typeId；身份三元组 {modeId, profileId, briefId}。
- **C3 grep 硬条**：`grep -rn "typeId|blueprint|蓝图|Blueprint" src packages tests`（排除 node_modules）——触碰文件零命中；白名单残留 = 字体 budget blueprint 措辞两处 + kiwi 同名字段 3 处 + 删除注记注释 5 处 + active-design 残留键容忍钉扎 3 处（核验 V-系逐条核对均为非存活机制）+ 仓外 doc/ 规格（T-C 批次领土）。
- **C4 尺寸语义重钉**：workflow frontmatter 可选 `canvas: <宽>x<高>`，缺省 750 宽 + HUG；longform.md 落 `canvas: 750x`——证据：原三 type 尺寸 750x/750x/1080x（全 HUG），主蓝图 ecommerce_detail=750x。
- **C5 schemaVersion 不 bump**：读穿容忍旧 typeId 残留键；BRIEF_SCHEMA_VERSION 机制不动；命名去重域收为仅 modeId。
- **C6 测试改写**：setup.test.ts（⑦typeId 三态整例删、①②尺寸重钉、⑥断言改、信封/落盘/读穿/命名/注入缝去 typeId）、studio registry/manifest/builtin-assets 测试删改、brief.test.ts 投影断言删。`bun test tests/engine/rebuild/` 323/323 绿、smoke:pi 76/76（2026-09-01 集成后）。

## 2. 实测修正记录

1. **切除段比前瞻宽**：T53-plan 注记「只动本段」实际外溢 4 处（命名域 :254/263、落盘 :341-344、信封 :366-368、读穿 :377-401）——调研蓝图已精确圈定，切除干净。
2. **领土外最小同步三处**：studio/index.ts、brief-tools.test.ts、t24 smoke 断言——编译/grep 硬条所迫，改动最小化并已在门禁实证。
3. **canvas 键仅落数据面**：validate/registry 消费接线归 T-C 批次（plan 定谳 1 范畴内分期）。
4. **type-shapes 撞型**（集成期主 agent 修正）：PiStudioModeEntry 与 StudioMode 删 types 后形状全等 → 改 `type PiStudioModeEntry = StudioMode` 别名不双写。
5. **prompt-overlay.ts 让渡执行**：plan 定谳该文件归本任务（原 T60 让渡），material types 段与 T24 遗留一并清理，无撞车。

## 3. 遗留

- S1/S2/S3/S4 蓝图节行文同步、longform.md 内容精品化、system-prompt-marketing.md 内容重写 → T-C1/C2/C3（触点清单在 T62 调研蓝图 §五）。
- parse.ts 三级标题索引保留（无害），注释口径已改。
