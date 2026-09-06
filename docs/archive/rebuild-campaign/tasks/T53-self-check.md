<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T53 自检 · Phase 3 W2/T-B2：setup_design 窄化 + 无状态三态解析

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent

## 1. 立项段自查（2026-09-01）

1. **调研在案**：Explore agent 产出（旧 setup.ts 396 行 / registry.ts 116 行全读；S3 §2/§9/§10 契约清单化；新仓 grep setup_design/setup_material_type/scanMarketingDesigns 零命中确认缺口）。
2. **关键裁决前置**：数据层（studio registry 仅后端）≠ 执行层（桥端浏览器）→ catalog 快照注入缝（T22 document_id 先例）；新建意图确认双层（core 校验 + 宿主短路）；「单键原子铸造」读作语义级（逐键写五键 + 重读，T52 setBriefMarker 先例）——物理单键 JSON 与 brief-edit 读穿投影冲突，排除。
3. **前瞻接缝**：owner v8 指令（type 蓝图 W3 删除，T62）在案——typeId/蓝图逻辑集中于 setup.ts 单一校验段（文件内注释明示「W3 切除只动本段」）。
4. **落点全在 ownedRoots**：fork/ + tests/engine/rebuild/；zones 零新增（集成期仅 P22/P134 既有 patch 覆盖面内接线）。

## 2. 实现段核验（2026-09-01 实测填报）

- **C1 四职责**：蓝图快照建框（'WxH'→FIXED / 'Wx'→HUG 初始 400）+ 最小空闲 `"label N"` 命名 + 四元组五键落盘（role 标记 + DESIGN_* 四键 + schemaVersion，逐键重读）+ registerBriefDesignEntry 登记（含绑定标签 `关联：<设计名> · <页名>`）。
- **C2 校验链**：confirmedNewIntent → briefId（findBrief not-found/ambiguous 复用）→ modeId（general 恒过 / catalog 在册）→ profileId → typeId（required/forbidden/not_in_mode 三态）；九 error code 信封 `{error, message}` zh-cn 文案。
- **C3 无状态三态**：`scanMarketingDesigns`（当前页 role=marketing-root 扫描读穿四元组，死节点不出现，两次扫描独立）+ `resolveMarketingDesign`（ok/none/ambiguous/**not-found** 四态——实现补的第四态镜像 BriefResolution，显式 id 未中场景）。
- **C4 恒新建**：无领养无幂等；同参数再调 = 第二框（label 递增断言在案）。
- **C5 测试**：`bun test tests/engine/rebuild/marketing/setup.test.ts` 24/24 绿（九契约 + 信封 + 恒新建 + 放置/视口 + catalog-less general + unknown_profile + 扫描/解析 + ToolDef 注入面钉扎：schema 恰四参、`__catalog` JSON 解析、畸形 JSON 视为未注入）。
- **C6 集成接线**（主 agent）：SETUP_TOOLS → fork/marketing/index.ts → FORK_TOOLS（fork/index.ts）；pi-backend 注入缝 = 新建 setup-catalog.ts（buildSetupCatalog 投影 + SetupDesignContext 类型）+ tools.ts defineBridgeTool 仅 setup_design 注入 `__catalog`/`__confirmedNewIntent` + service.ts 闭包（catalogJSON 请求时 getStudioRegistry 现取；newIntentConfirmed 恒 false 待 T61 通道）。
- **C7 标记收敛**：image-gen/history.ts 本地 MARKETING_ROLE_ROOT 副本删除（旧 raw key 读取看不到 shared 编码键，属潜伏 bug）→ import isMarketingDesignRoot（getSharedPluginData 通用面，编码+旧格式双兼容）；头注适配段同步改写。
- **C8 套件**：`bun test tests/engine/rebuild/` 236/236 绿；marketing/ 目录 136/136 ×3 连跑稳定。

## 3. 实测修正记录

1. **lint  acronym 规则**：setup-catalog.ts 接口方法 `catalogJson` 被 no-mixed-case-acronym-identifiers 拦（JSON 须全大写）→ `catalogJSON`，三文件同步（setup-catalog/service/tools）。
2. **校验顺序**：plan 未钉——实现定 confirmedNewIntent → brief → mode → profile → type（确认先行镜像宿主短路层）；推论：longform + 坏 profileId + 缺 typeId 报 unknown_profile（profile 先于 type_required）。
3. **types:'none' 且无 typeId 的 mode**：plan 只钉 general 默认尺寸——实现复用 general 默认（750w + HUG，SETUP_GENERAL_DEFAULT_WIDTH）覆盖一切无蓝图 mode。
4. **缺省键不写**：typeId/profileId 缺省时对应 pluginData 键不落地（读穿投影显示「—」如旧）；五键 = role + 四元组实键 + schemaVersion。
5. **命名域**：当前页 + 同 (modeId,typeId) 身份内最小空闲（旧仓为文档级按 material-type 去重；v1 同页限定随 S4 v6）。
6. **并行期一次性 flake**：T56 agent 报告并发开发期 setup.test.ts「catalog 缺省」一例瞬败（隔离跑 3/3 过）；集成后 marketing 套件 ×3 连跑 136/136 稳定，未复现——归因并发写盘窗口，记录在案。
