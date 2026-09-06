<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T61 计划 · Phase 3 W3/T-B10：选择器 UI 重做（chips + 新建意图确认 + 面板）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：T60/T61 联合调研 subagent 2026-09-01；契约真源 = S1 §5/§6/§9 + S3 §9 + S4 T-B10 行 + v6/v7 修订

## 1. 现状实证（调研在案）

- 现存 ChatModeSelect.vue / ChatStyleProfileSelect.vue = reka-ui Select 薄封装（T24 旧件，S4 明示随 PD-16 翻案重做）；**type 级 chip 从未落地**（T62 调研实证），三级收两级无存量 UI 触点。
- AskUserQuestionCard.vue（T56，294 行）= 卡片交互范式：part 渲染 → emit submit → ChatPanel handleFormSubmit → 信封文本注回；answeredFormIds 置灰。
- mode-selection.ts：localStorage `open-pencil:pi-chat-mode` 全局选择态；transport.ts:35-43 每请求带 chatMode/pickedProfileId；document-key.ts:148-156 getPiRequestContext 消费——T24 链本任务退役。
- manifest 数据源 ensurePiStudioManifest 进程内一次拉取，失败 → null 静默降级（须按契约改显式暴露）。
- 需求单面板/brief 面板尚不存在（src/components 无 brief 件）。

## 2. 与 T60 的共享契约（两边各自 plan 钉同一条，集成期主 agent 对账）

1. 新建意图信封：消息首行 `[新建意图确认 modeId=<id> profileId=<id>]`（字段可缺省）；宿主剥离置旗标，剩余文本进 run（T60 消费）。
2. 切换通道端点：`POST /api/pi/active-design {nodeId}` → 宿主校验（存在/设计区根框/同页/briefId 一致）+ 移槽 + 返回身份三元组 {modeId, profileId, briefId}（T60 供）；面板「设为当前」按钮与 set_active_design 同意卡共用此端点。
3. set_active_design 工具 part 形状 `{proposed:{nodeId,...}}`（mutates:false，不落槽）；同意/不同意均不伪装用户消息——同意调端点，不同意本地系统行。
4. 物化判定（Case A/B 话术分叉）：设计区根框内存在 IMAGE fill 节点或骨架分区标记即「物化后」（实现期按 T52/T57 标记复核并在 self-check 钉扎）；前端经 editor store 读画布同判据。
5. chips 回显数据源：前端经 editor store 读 root sharedPluginData `activeDesignNodeId` + 设计区节点标记三元组（读穿，T60 单槽口径）；无 active → chips 回显默认态（general + 无 profile）。

## 3. 交付物（本任务领土：src/components/**、src/app/i18n/fork/**、mode-selection.ts、document-key.ts、transport.ts）

1. **chips 重做**：输入条内联 chips（mode → profile 两级；数据驱动——manifest.modes[].types 若存在则渲染中间级，T62 删除后自然两级，本任务不建 type 级专属逻辑）。chips 恒回显 active_design（指针移动自动同步，系统同步不触发意图）；无 active 时回显默认态。ChatModeSelect/ChatStyleProfileSelect 旧件退役删除。
2. **新建意图确认卡**：用户手动改 chip + 发消息 → 发送前弹聊天内确认卡（复刻 T56 卡片范式，宿主发起非工具 part）；确认 → 信封 + 用户消息送出；取消 → chips 回滚回显、消息留输入框。话术分叉：物化前 Case A（方向草稿作废提示一行）；物化后 Case B 四项（旧产物保留说明 / 新设计区启动 / 携带物勾选[brief 素材区自动继承 + 已生成图片可选 references] / 废弃半径声明）。只拨 chip 浏览不发消息 = 无意图事件。
3. **设计列表面板**：扫描当前页营销设计区（复用 core scanMarketingDesigns 或 store seam，arch 规则优先——被拦则经既有 store 通路），active 可见面（当前标记）；切换只走条目显式「设为当前」按钮 → 端点（v7：列表点击 = 打开定位画布，不切换）。
4. **需求单面板三段**（v7）：当前目标卡（无状态字段）/ 需求单列表（点击 = 打开不切换）/ 详情编辑视图（编辑为第一功能，写回经既有桥/工具通路——实现期复核可用通路并在 self-check 钉扎）。
5. **gallery 浏览**：modes/profiles 只读浏览（manifest 数据）。
6. **失败显式暴露**：manifest 拉取失败 → chips 禁用 + 错误条 + 重试按钮（08 P0-2 纪律）。
7. **set_active_design 同意卡**：工具 part 渲染（proposed 身份 + 目标设计名）；同意 → 端点；不同意 → 本地系统行。
8. **T24 前端链退役**：transport 停发 chatMode/pickedProfileId；document-key.ts getPiRequestContext 去 mode 消费；mode-selection.ts 重构为 active_design 同步态 + 未确认新建意向暂存（localStorage 路由语义删除）。
9. **i18n**：fork 命名空间新增 chips/panel/confirm 键（useFork* 先例），中文为内容语言。

## 4. 验收标准

1. typecheck/lint/format/arch/dupes/i18n/zones/bindings/docs 九门禁 unpiped 全 exit 0；`bun test tests/engine/rebuild/` 与 smoke:pi 不回退。
2. 与 T60 共享契约五条逐条对账一致（核验 subagent 双侧核对）。
3. 视觉与交互冒烟归 W4 T-D 批次（本任务不做 Playwright 验证，但组件须可构建可挂载）。
4. zones.json 新 ownedFiles 登记带 T61 指针（主 agent 集成期）；三件套齐 + 核验 PASS 后 flip。

## 5. 红线

- chips 永不改写既有设计；切换只走显式按钮/同意卡；画布选中不接任何路由逻辑。
- 不碰 src/app/ai/pi-backend/**、packages/core/**、studio/**、prompt-overlay.ts（T60/T62 领土）。
- 卡片信封格式逐字遵守共享契约（与 T56 信封 `[表单作答 formId=…]` 不混淆）。
