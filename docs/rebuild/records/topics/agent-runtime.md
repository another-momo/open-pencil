<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/agent-runtime.md · agent 后端 / runtime

> **状态**：已建立 | **时间**：2026-08-20 18:30 | **核验人**：主 agent
> **身份**：runtime 选型相关的决策、修正、核验记录。叙事/调研见 `docs/rebuild/03-phase-1-runtime.md` 与 `docs/rebuild/spikes/01-dsh-integration-routes.zh.md`、`02-pi-sdk-runtime.zh.md`、`03-weshop-case-deep-dive.zh.md`、`04-dsh-x-design.zh.md`。

---

## 决策类

## D7 · runtime 选型

- **类型**：决策
- **时间**：2026-08-18 14:00（R4 核验）
- **状态**：open（Phase 1 spike 后定）
- **内容**：候选 = pi sdk 直接驱动 / dsh（X 入壳或 Y 无头）。R4 后已确认 pi sdk 与 dsh 共用 pi-ai 多 provider 网关，因此选型对立面实为「pi sdk 直接驱动 vs Cordis + pi-ai」（见 spikes/02-pi-sdk-runtime.zh.md §P6）。
- **依据**：`docs/rebuild/spikes/02-pi-sdk-runtime.zh.md`、`04-dsh-x-design.zh.md`、R4 实测（2026-08-18）。

## D9 · dsh 集成形态

- **类型**：决策
- **时间**：2026-08-20 17:00（v3 重写时确认状态）
- **状态**：open（待 owner 拍板）
- **候选**：
  - a) 编辑器入壳（编辑器作 dsh 插件，React 壳）
  - b) 无头 runtime（dsh 藏在我们后端）
  - c) pi 直接驱动（库形态，spikes/02-pi-sdk-runtime.zh.md 推荐）
- **当前推荐**：c 推 1、b 推 2，a 受 weshop 实证上修（≈37-38 人日 vs b 25 / c 20）
- **依据**：spike 01-04 源码级证据齐；X 真实瓶颈 = 自写 ChatPanel 消费 SessionFace + 跨 session 配置白名单约束（`remote-events.ts:28` 仅 11 个事件）。

---

## 修正类

## 修正-1 · spikes/01-dsh-integration-routes.zh.md v2 修正（X 路线工作量上修）

- **类型**：修正
- **时间**：2026-08-20 17:20
- **依据**：SP-3 weshop 案例实证
- **内容**：X2 改「自写 ChatPanel」；Z1/F0.4 同步；工作量表 F0 +4 / C5a +0.5；总工作量 ≈33 → ≈37-38 人日
- **影响范围**：01-target-state.md §2 F0.4、03-phase-1-runtime.md（v3）

## 修正-2 · 03-phase-1-runtime.md v3 重写（附录 A 迁移）

- **类型**：修正
- **时间**：2026-08-20 17:00
- **依据**：本轮整改（docs-governance.md D10 决策）
- **内容**：从三路线（X/Y/pi）→ 双路线（X/pi）。Y 路线已被你排除，不再构成有效候选
- **X 路线深化**：从 spikes/01-dsh-integration-routes.zh.md §X 节升级到 spikes/04-dsh-x-design.zh.md v4（316 行专项设计，含术语表 / session 切换不卸载实测 / 自写 ChatPanel 三因素论证 / 4 落地伪代码）
- **pi 路线深化**：从 spikes/01-dsh-integration-routes.zh.md §Y4 / §P 系列升级到 spikes/02-pi-sdk-runtime.zh.md（pi-coding-agent 库形态确认 + RPC event 流同构 + JSONL 树形 session）
- **决策框架简化**：v2 三选项（a/b/c）→ v3 双选项（X/pi），A 选项（dsh-X）保留为推荐
- **身份声明更新**：从「决策依据」明确改为「case study 调研（辅助参考信息）」，决策依据在 [01-target-state.md §7](01-target-state.md) + 本文档 D9
- **前置验证条目**：gh api + npm view 双数据采集加入（v2 缺失）

---

## 核验类

## SP-1 · dsh 集成路线对比（X 入壳 vs Y 无头）

- **类型**：核验
- **时间**：2026-08-19
- **核验人**：研究 subagent
- **范围**：dsh + pi 本地仓库，95 次工具调用
- **结论**：`docs/rebuild/spikes/01-dsh-integration-routes.zh.md`：**推荐 Y**；Y 唯一阻塞项 = 官方 sdk-jsonrpc-server 只 create 不 resume（自写 ~250 行薄 host 插件补 resume/cancel，2-3 人日，spike S1 验证）；多模态路径与旧 media-rewriter 同构（pi-ai 合成 user 消息带图）；X 的 tab 卸载孤岛硬伤 + 无 host→浏览器通道
- **状态**：**已被修正-2 推翻**——后续 weshop 案例（SP-3）证明 X 路线真实形态不是「镶 dsh Chat」而是「自带 ChatPanel 消费 SessionFace」，tab 卸载孤岛硬伤不成立

## SP-2 · pi sdk 作为 runtime 可行性

- **类型**：核验
- **时间**：2026-08-20
- **核验人**：研究 subagent
- **范围**：pi monorepo 完整源码 v0.84.2，6211 commits
- **结论**：`docs/rebuild/spikes/02-pi-sdk-runtime.zh.md`：**推荐 pi 直接驱动（库形态）**，F0+层 1 ≈ 20 人日；Q0-Q3 全部有源码级正面答案；resume 是一行 API 无 fork；流式 RPC event 流字段同构；session JSONL 树形天然支持 in-place branch
- **状态**：成立

## SP-3 · weshop 案例深度实证

- **类型**：核验
- **时间**：2026-08-20
- **核验人**：研究 subagent
- **范围**：weshop-dsh-plugin 全源码
- **结论**：`docs/rebuild/spikes/03-weshop-case-deep-dive.zh.md`：**校正 spikes/01-dsh-integration-routes.zh.md 偏差**：weshop overlay 是「自带 React CanvasChat 消费 SessionFace」非「镶 dsh Chat」；X 路线工作量上修为 ≈37-38 人日（vs Y 25），差距从 30% 拉到 50%；新发现强约束：跨 session 营销配置同步必须经 dsh `settings/document-updated` 白名单通道（`remote-events.ts:28` 仅 11 个白名单事件）
- **影响**：触发修正-1（spikes/01-dsh-integration-routes.zh.md v2）+ 催生 spikes/04-dsh-x-design.zh.md（X 路线专项设计）

## SP-4 · dsh-X 路线专项设计

- **类型**：核验
- **时间**：2026-08-20 18:00
- **核验人**：主 agent
- **范围**：spike 01-03 + weshop 案例 + dsh 本地源码（AppFrame.tsx:194 vs ConversationSession.tsx:168-172）
- **结论**：`docs/rebuild/spikes/04-dsh-x-design.zh.md`（v4，314 行）：X 路线核心论证 = shell.overlay 切 session **不卸载**（无 `only` 参数）；自写 ChatPanel 三因素论证（session 持久化 > 控制自由度 > UX 控制权）；M1-M5 五 commit 里程碑；6 项 S-X spike 验证清单
## SP-5 · runtime 选型前置数据实采（03 §5.2 落地）

- **类型**：核验
- **时间**：2026-08-21（T09）
- **核验人**：主 agent
- **实测**：
  - dsh（`gh api repos/deepseek-ai/deepseek-harness`）：stars 175,615 / forks 19,021 / open_issues 0
  - npm 周下载（`curl https://api.npmjs.org/downloads/point/last-week/<pkg>`，窗口 2026-08-13..19）：`@deepseek-ai/dsh` = 648,007；`@earendil-works/pi-coding-agent` = 1,904,277
- **结论**：两路线均远超 03 §5.2 阈值（dsh stars ≥1k 且 weekly ≥500；pi weekly ≥1k）——外部信号不阻塞选型，D9 按路线优缺点 + owner 目标拍板
- **修正**：03 §5.2 原命令 `npm view <pkg> weekly-downloads` 无效（实测返回空），已改为 npm downloads API

## 修正-3 · X 路线工作量数字对齐 + 推荐方向不一致登记（T09）

- **类型**：修正
- **时间**：2026-08-21
- **内容**：
  1. 03-phase-1-runtime.md §2.2/§4.1 的「15.5 人日」系 v3 重写误植的无源数字（引用目标 spike 04 §5 与修正-2 均无此数字），已按本档案修正-1 / SP-3 与 [01-target-state.md §8](../../01-target-state.md) 对齐为 ≈37-38 人日
  2. **推荐方向不一致登记**：03 §5.1 曾标「A（dsh-X）推荐（你已表达偏好）」，与本档案 D9「当前推荐：c（pi 直接驱动）推 1」矛盾——已按冲突裁决（records > 叙事）在 03 §5.1 显式标注，推荐以 D9 + owner 拍板为准。与 [records/topics/docs-governance.md D16](docs-governance.md)（Y 路线排除的拍板状态）并列为 D9 拍板前需一并厘清的两件事

## D20 · upstream 合并先行 + Phase 1 双 spike 并行（S-pi 先）

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner（会话原话：「先拉分支完成合并，然后再开启 phase 1」+「拉分支分别推进 dsh-x 路线和 pi 路线的 spike」）
- **内容**：
  1. **upstream 合并先行**：漂移实测 79 commits / 864 文件 / 约 2 天（0332b062→5201404f），触发 05-process.md §3.3「漂移显著时提前」；合并承载 task = T10，合并前不开 spike
  2. **双 spike 并行登记**：T11 = S-pi（spike/s-pi 分支）、T12 = S-X（spike/s-x 分支）；**S-pi 先行**（主 agent 建议：等成本下 S-pi 有早期退出价值——pi 落地 ≈20 人日 vs X 37-38，D9 记录推 1；S-pi 全过则 S-X 可整体省掉）
  3. **D9 维持 open**：spike 产证据后再拍板；03 §5.3 启动条件由「D9 拍板后启动 spike」改为本决策
- **理由**：上游 2 天 79 commits 的速度下，合并每推迟一周冲突面翻倍；且 spike 验证的缝（transports.ts +61 行、ChatPanel/ChatInput、EditorView 被上游删除）本轮均被上游触及——对过期缝做 spike 会产出带保质期的证据

## SP-6 · 上游已产品化 pi harness 传输路径（D9 重大证据，T10 合并发现）

- **类型**：证据（核验）
- **时间**：2026-08-21
- **发现**：upstream/master@5201404f 在 chat 缝新增**第三条传输路径**——`HarnessChatTransport`（`src/app/ai/harness/transport.ts`，新包 `@open-pencil/harness`），adapter = 'pi'（`@ai-sdk/harness-pi@1.0.76`）+ sandbox 'just-bash'（`@ai-sdk/sandbox-just-bash`），走 `providerID === 'harness:pi'`，设置面有 thinkingLevel/permissionMode，MCP 经 `buildPiMCPServers()` 接入
- **核验命令**：`git show upstream/master:src/app/ai/chat/transports.ts`（createActiveHarnessTransport）；`cat packages/harness/package.json`（deps）
- **对 D9 的意义**：pi 路线在本代码库内已被上游亲自走过一遍并产品化——「pi event 流 → UIMessage v1 同构」（spike 02 §Y2）从源码推断升级为**上游在产实证**；S-pi spike 可直接对照上游实现做参照
- **限制**：上游 harness 路径 `isConfigured` 要求 `IS_TAURI`（仅桌面端可用，web 端恒 false）——它是 coding-agent 面（bash/edit 工具），不是设计 runtime；不替代 D9 的选择，但是强参照
- **处置**：T10 合并保 harness 裁 ACP（理由：harness 与 Phase 1 方向同向且上游持续维护，裁掉反而每次合并都重新冲突；ACP 为死面）；若 D9 最终不采用任何 pi 形态，再裁不迟（登记于此备查）

## 修正-4 · T11-plan 整体评估（owner 质疑 DeepSeek 降级项系 dsh-y 污染）

- **类型**：修正（按对象：tasks/T11-plan.md）+ 决策相关事实澄清
- **时间**：2026-08-21
- **起因**：owner 质疑 T11 S-pi-2「再切 DeepSeek 验证占位降级静默不报错」疑似从 dsh-y 路线污染
- **核验**（subagent 只读评估，2026-08-21）：**非污染**——该句逐字出自真源 spikes/02 §6（02-pi-sdk-runtime.zh.md:631）；机制本体在共享 pi-ai 层（`transform-messages.ts:35-57` 静默降级 vs dsh `llm-deepseek/serialize.ts:63-66` 显式抛 UNSUPPORTED_CONTENT，spikes/02 P3.2 明牌此为两路线行为分叉点）；open-pencil 默认 DeepSeek 系 text-only 模型，C4a 图片在 DeepSeek 路径必然降级（02:211），故降级路径运行时表现是 pi 路线层 1 验收的正当证据。owner 直觉部分成立之处：「静默不报错」已是源码级【事实】，spike 的边际价值在运行时未知量（端到端不炸 + 任务可续，02:631）与离线前置（§9-1 catalog input 字段）
- **处置**：T11-plan 六处修订——S-pi-2 表述改为验证运行时未知量 + §9-1 离线前置、P1 补 R-pi-8 Windows npm install 必测、包名声明补 npm view 核验命令与日期、§1.1 风险/回退倒置修正、S-pi-4 补 150-200 行锚点；T12-plan 顺带评估无污染

## D21 · harness 路线暂时搁置，S-pi 按直用 pi SDK 形态执行

- **类型**：决策
- **时间**：2026-08-21
- **拍板**：owner
- **状态**：已拍板
- **内容**：D9 子问题「直用 pi SDK vs 复用 harness 抽象」（spike 05 §5 选项 A/B/C）——**暂时搁置 harness 路线，S-pi（T11）按直用 pi SDK 形态直接执行**。树形分叉能力损失 owner 明确可接受
- **理由**：经 spike 05 讨论收敛——(1) B/C 差别本质是「Vercel 胶水 vs 自写胶水」，service 层两案都自写，成本差仅 150-300 行胶水便利；(2) 版本耦合硬事实：harness-pi@1.0.76 锁 pi `^0.80.10`（0.x caret 锁 minor）+ pi-ai `0.74.2` 精确锁，而核查与 spike 证据全在 0.84.2，升级闸门交给 Vercel 发布节奏（R-pi-1 加重版）；(3) 能力天花板：D2a 通道 A 降级阀（prompt 纯文本）与 B1b 审批回合（六事件无 approval 往返）受阻，extensionFactories 逃生舱未实测；(4) backend 可换期权对我们非刚需——知道要选 pi
- **搁置而非否决**：spike 05 建档保留全部核查结论；packages/harness 包保留在仓（T10「保 harness 裁 ACP」决策不变——跟随上游、不占我们的 runtime 路径）；若 T11 spike 实测暴露直用 SDK 的意外成本，可回摆重议
- **supersede 注记**：修正-4 中「DeepSeek 占位降级验证该留」的论证语境是 spike 02 旧口径（通道 A 主线）；D2 drift 修正后（spike 01/02 已改），降级验证降为通道 A 时间盒备选探测，本决策维持该定性
