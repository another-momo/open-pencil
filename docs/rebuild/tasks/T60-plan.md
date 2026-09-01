<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T60 计划 · Phase 3 W3/T-B9：宿主路由与每回合组装（active_design 单槽）

> **状态**：🔄 进行中 | **时间**：2026-09-01 立项 | **负责人**：主 agent + 实现 subagent + 核验 subagent
> **调研蓝图**：T60/T61 联合调研 subagent 2026-09-01；契约真源 = S3 §9（doc/S3-tool-contracts-spec.md:118-135）+ S1 §5/§6/§9 + S4 v6/v8 修订与尾巴表
> **身份维度**：typeId 随 T62 删除（owner 2026-09-01 v8）——本任务设计身份 = **三元组 {modeId, profileId, briefId}**；S3 §9/S1 行文「四元组」由 T-C 批次同步

## 1. 现状实证（调研在案，文件:行号 2026-09-01）

- 每回合组装点 = service.ts `assembly` InlineExtension before_agent_start（:230-244），现按建会话期烘焙 chatMode 拼段——与「按 active_design 落盘 mode 每回合组装」不符，本任务重构核心。
- chatMode 切换 = 驱逐 SessionEntry 重建（:324-330）——随单槽模型退役。
- T53 注入缝：setupDesign context 闭包（:207-210），`newIntentConfirmed: () => false`（:209）——本任务接一次性旗标真源。
- studio 快照启动期固定（:135），须改每回合取 registry 单例。
- T24 遗留：prompt-overlay.ts:31-64「Material types」段、modes.ts 旧双模式——prompt-overlay.ts 整段清理归 T62（types 删除后该段必须重写，同一文件单边动手避免撞车），modes.ts 归本任务。

## 2. 定谳

1. **单槽落盘**：root sharedPluginData 只存 `activeDesignNodeId`；三元组身份从设计区节点标记读穿展示（T53 五键 stamping 的 DESIGN_* 键，去 typeId）。core 侧新建读写函数（packages/core 单槽模块或随 setup.ts 领土扩展，实现期定——不得新增 steiger 前缀违例文件）；宿主经桥读，SessionEntry 加每回合缓存袋（同 target/documentId 先例）避免回合内多次桥跳。
2. **四事件移槽**（全部用户确认；画布选中/最近活跃永久退出路由信号）：
   - ①新建完成：setup_design 桥执行返回成功（结果含新 root id）→ 宿主移槽；
   - ②面板点选 + ③AI 声明+同意：统一走**宿主端点** `POST /api/pi/active-design {nodeId}`（非聊天消息）——宿主合法性校验（节点存在 / 是设计区根框（isMarketingDesignRoot）/ 同页 / briefId 一致），通过则移槽 + 返回身份三元组；③的 AI 声明侧 = 新工具 `set_active_design`（core fork，mutates:false，返回 `{proposed:{nodeId,...}}` 不落槽），同意卡与端点调用归 T61；
   - ④表单作答：宿主在 ask_user_question 工具调用时记录 `formId → 当时 activeDesignNodeId` 映射（会话内，不落盘——runState 不落盘原则）；`[表单作答 formId=…]` 信封到达时映射存在且节点仍合法 → 移槽；刷新丢映射则事件④静默不发生（已知边界，入 self-check）。
3. **删除悬空清槽**：每回合组装读穿时发现槽位节点不存在 → 清槽 + 向 context 注入一行系统提示（中文，用户语言化）。
4. **每回合组装**：`system = base + workflow(落盘 mode 的 body 全文) + profile 全文(选中时)`，base→workflow→profile 顺序固定；`context = 设计身份封套(三元组+节点 id) + 会话历史 + 用户消息`。空槽（无 active_design）= general mode + 无 profile + 无封套（新建意图场景）。registry 每回合读单例（getStudioRegistry 进程级缓存已在）。落盘 mode 的 workflow 缺失 → S1 §5 显式报错路径（一行系统提示 + 按 general 组装）。
5. **新建意图一次性旗标**：信封格式首行 `[新建意图确认 modeId=<id> profileId=<id>]`（字段可缺省）。宿主 prompt() 入口剥信封 → 本回合 `newIntentConfirmed()` 返真 → run 结束 finally 强制复位 false；剥离后剩余文本照常作为用户消息进 run。信封永不跨回合滞留；会话切换/新建天然清零。
6. **mode 生命周期**（S1 §9）：Case A/B 的确认卡话术与物化状态判定由 T61 渲染侧承担，宿主提供判定数据（设计区是否已有物化产物：设计区根框内存在 IMAGE fill 或骨架分区即物化后——实现期按 T52/T57 标记判定并在 self-check 钉扎判据）；Case B 确认后执行 = 旗标 + 合成用户消息进 run（复用 setup_design 链，宿主不复制创建逻辑）；Case C = 组装函数读落盘 mode 天然实现 + 一行告知归 AI 纪律（不进宿主代码）。一回合一 mode = 单槽天然属性，无额外机制。
7. **chatMode 链退役（后端侧）**：SessionEntry.mode/overlay 字段、驱逐重建语义、请求体 chatMode 消费全删；modes.ts T24 遗留删除（prompt-overlay.ts 归 T62 领土，见 §1）。请求面字段删除的前端生产侧归 T61；后端对残留字段忽略不报错（兼容窗一波次）。
8. **前缀缓存**：组装顺序固定即履约；命中率实测为观察项（self-check 记录是否具备测量手段，无手段则转 W5 观察清单）。

## 3. 测试清单

- core：单槽读写（写入/读穿/缺槽 null/节点删除后读穿语义）；set_active_design 工具定义与 proposed 返回形状、mutates:false 钉扎。
- 宿主（smoke:pi 同基建）：组装函数（空槽/有槽/落盘 mode 缺失/profile 有无/顺序固定）；信封剥离 + 旗标置真/复位/不滞留；①桥回调移槽；④formId 映射移槽与刷新丢失边界；端点合法性四驳回（不存在/非根框/跨页/briefId 不符）+ 通过路径；清槽 + 系统提示注入。

## 4. 验收标准

1. `bun test tests/engine/rebuild/` 与 smoke:pi 全绿（新增用例在内）；九门禁 unpiped 全 exit 0。
2. setup_design 在旗标真时可新建、旗标假时恒拒绝（契约行为钉扎测试）。
3. zones.json 新 ownedFiles 登记带 T60 指针（主 agent 集成期）；三件套齐 + 核验 PASS 后 flip。

## 5. 红线

- 宿主永不猜测：不做时序推断/语义猜测/画布选中侦听。
- runState 不落盘；formId 映射会话内。
- 不碰 src/components/**、mode-selection.ts、transport.ts、document-key.ts（T61 领土）；不动 setup.ts 切除段与 studio/（T62 领土）。
