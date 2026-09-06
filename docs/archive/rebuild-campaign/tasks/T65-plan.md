<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T65 计划 · UI 交互修整批（owner 2026-09-01 两轮 review 共 12 条拍板）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent ×2 + 核验 subagent
> **决策真源**：仓外 doc/T65-ui-interaction-decisions.md（A 哲学 / B 布局 / C 尺寸 / D 补缺 / E 遗留并入 / F 治理）

## 1. 拍板摘要（决策录逐条编号）

- **哲学**：输入条只放「随下一次消息发送生效」的意图暂存；状态查看类一律移出（A）。
- **布局**：当前设计 = 画布工作状态 → 移出输入条；当前设计显示 + 设计列表 + 需求单面板**三合一**为画布工作状态面板，trigger 按钮本身显示当前设计名，面板内分节不分 tab，位置 = 聊天面板 header（B1/B2）；gallery 组件删除（B3）；模型名 label 暂留（B4）。输入条终态 `[mode chip] [profile chip] [模型名] …… [发送]`。
- **尺寸（type 语义重构）**：预设 = **名称 + 尺寸**清单，写 workflow frontmatter；用户按名称显性选择或自定义；未指定时 agent 按语义意图自选预设之一或自定义。无 typeId/无校验轴/无 chip 级（C）。
- **补缺**：新建需求单入口（D1）；restyle 不立入口（= 切 profile 新建衍生，D2）；切换成功聊天回执 = 对话流分割线（D3）；设计/需求单扫描统一**当前页** + 文案明示（D4）。
- **并入前轮 P0/P1**（E）：chips 暂存一键撤销（badge 可点 ×）+ badge 内容化「将新建：…」+ 拨 chip 即时反馈；需求单详情编辑防丢（重开不重置 + dirty 关闭确认）；空槽引导；Case B references 缩略图；宿主卡片系统视觉；中文 ≥11px。
- **治理**：ChatPanel 族转 owned（F，集成期主 agent 盘点 chat/ 目录后落地）。

## 2. 尺寸契约（C 的工程形）

1. **frontmatter**：`sizes: [{label, canvas}]` 清单；canvas 格式 `750x`（高 HUG）或 `750x2000`（固定高）；sizes 缺席 → 缺省 750x HUG（现状语义）。T62 落的单值 `canvas: 750x` 升级为 sizes 清单（longform = 电商详情 750x + 小红书 1080x，原三蓝图证据在案——前两档同 750x 只收一条，label 取主蓝图名）。
2. **setup_design**：加可选 `canvas?: string` 参数（预设 canvas 值或自由值），格式正则 `\d+x(\d+)?`，非法 → 新结构化错误码 `invalid_canvas`（七码）；缺省 = frontmatter 首选预设或缺省。落盘 size 语义不变（{width, height|null}）。
3. **catalog/manifest 投影**：modes[] 条目加 `sizes: [{label, canvas}]`（registry StudioMode 透传 workflow.sizes；manifest 同步；buildSetupCatalog 的 catalogJSON 带 sizes——AI 据此按语义选）。
4. **新建意图信封扩展**：`[新建意图确认 modeId=<id> profileId=<id> canvas=<值>]`（全字段可缺省；canvas 值为 canvas 字符串）。
5. **集成缺口修复（T60/T61 遗留，本任务必修）**：宿主剥离信封后，确认参数对 AI 不可见（旗标只真假）——剥离时向 context 注入一行系统提示「用户已为本次新建确认参数：modeId=… profileId=… 尺寸=…（选择即锁定，不得覆盖）」，缺省字段省略。

## 3. 前后端共享契约（两实现 subagent 对账用）

- 信封格式 §2.4 逐字；host 剥离正则同步扩展（active-design-host.ts NEW_INTENT_MARKER）。
- manifest modes[].sizes 形状 §2.3（前端确认卡尺寸 chips 消费）。
- 切换回执：前端新 data part `data-context-switch`（data {name}），渲染为分割线；端点 200 后 appendHostMessage 注入；set_active_design 同意路径同形态（替换原系统行）。
- 新建需求单：core create_brief 原语经 makeFigmaFromStore 桥直调（不触发 setup_design）；落位后面板列表重扫 + 定位画布。
- 确认卡尺寸行：NewIntentPartData 加 `sizeChoices: [{label,canvas}]`（按选中 mode 投影）+ 用户选择进信封 canvas 字段；Case B references 加缩略图（renderExportImage 先例）。

## 4. 领土划分

- **subagent X（core+backend）**：studio/{types,validate,registry,manifest,parse}.ts sizes 面、setup-catalog.ts、setup.ts（canvas 参数 + 尺寸解析 + invalid_canvas）、setup-tool.ts、active-design-host.ts（信封扩展 + 系统提示注入）、texts.ts、longform.md frontmatter 升级、tests/engine/rebuild/{studio,marketing,pi-backend} 相关测试。
- **subagent Y（frontend）**：ChatInput.vue（瘦身）、ChatPanel.vue（header 面板挂载 + 分割线 + 确认卡接线）、ChatModeChips.vue（撤销/badge 内容化/即时反馈）、ChatNewIntentCard.vue（尺寸行 + 缩略图 + 系统视觉）、ChatSetActiveDesignCard.vue（系统视觉）、设计/需求单面板三合一重构（ChatDesignListPanel + ChatBriefPanel 合并，ChatGalleryPanel 删除）、新建需求单、编辑防丢、空槽引导、字号、当前页统一+文案、mode-selection.ts、i18n fork 三命名空间。
- **主 agent 集成**：chat/ 目录盘点 → ChatPanel/ChatMessage/ChatInput 转 owned（patch 退役注记）或整目录 ownedRoot（按盘点结果）、zones.json 登记、门禁、三件套、核验、提交。

## 5. 验收标准

1. 输入条只剩 mode/profile/模型名；header 状态面板三合一可用（trigger = 当前设计名）。
2. sizes 契约：frontmatter 清单解析、catalog/manifest 投影、setup_design canvas 参数（预设/自由/非法三态）、信封 canvas 字段、确认参数系统提示行注入（测试钉扎）。
3. 补缺四项：新建需求单、分割线回执、当前页统一+文案、chips 撤销/badge 内容化。
4. 全门禁 unpiped exit 0（rebuild 测试 + smoke:pi + 九门禁 + format:check）；SFC 模板编译扫描（compiler-sfc 脚本）全过。
5. zones.json 登记带 T65 指针；三件套齐 + 核验 PASS 后 flip。

## 6. 红线

- 不复活 type 轴：无 typeId、无清单成员校验、无 chip 级、无三级联动。
- chips 永不改写既有设计；当前设计面板只做查看/显式切换。
- 需求单编辑写回仍走 core brief-edit 原语；新建需求单不触发 setup_design。
- S1/S3/S4 行文同步归 T-C 批次（本任务不动仓外文档）。
