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

## SP-7 · T11 S-pi spike 离线面实测结果（直用 pi SDK，0.84.2）

- **类型**：证据（核验）——subagent 独立核验通过（T11-verify.md，F1-F4 已就地修正）
- **时间**：2026-08-21
- **范围**：S-pi-1/S-pi-3 离线面全过（8/8 + 16/16 断言，`spikes/s-pi/` 两测试，`npm run test:offline` 退出码 0）；S-pi-2 离线前置完成；S-pi-4 映射表完成；活模型面阻塞（环境无 ANTHROPIC/DEEPSEEK/OPENAI key，printenv 实测）
- **关键实测结论**：
  1. **离线驱动注入点**：`ModelRuntime.registerNativeProvider(provider)` + pi-ai 官方 `createAssistantMessageEventStream()` 编排脚本化事件流（同 pi 自家 test-harness 的 createFauxStreamFn 模式）——无需 API key 即可驱动完整 agent loop（createAgentSession 公开面），后续单测/CI 可复用该机制
  2. **库形态装配**：`createAgentSession({ model, modelRuntime, sessionManager, customTools, tools })` 全字段实测可用；`defineTool` + `customTools` 直挂自定义工具，agent loop 真实执行（tool_execution_* 事件成对）；`tools` 为 allowlist 语义（空数组 = 全禁含 customTools，报错 "Tool X not found"）
  3. **增量落盘（S-pi-3 核心）**：`prompt()` 返回后、`dispose()` 前 session JSONL 已含全部条目——上游 harness「只有进程退出才持久化 / destroy 删状态」（SP-6/spike 05 §1）的坑在直用 SDK 路线**天然不存在**，无需额外 stop 时机设计（边界：同步微任务推流场景实测；流式中途崩溃属活模型残留项）
  4. **树形分叉实测可用**：`SessionManager.branch(entryId)` 从中间节点长出第二分支、跨重启完整保留、`getTree()` 可见——spike 05 §3 认定的 harness 抽象天花板能力，直用 SDK 在 0.84.2 真实可用（D21 已拍板可放弃该能力，此处仅证实其存在性）
  5. **DeepSeek 纯文本**：pi-ai catalog deepseek-v4-flash/pro 均 `input:["text"]`——D2 通道 B 主线下原生兼容；pi 另有 settings 级 `blockImages` 降级（image→占位文本），可作 D2a 参照
  6. **S-pi-4 映射可行性**：AgentSessionEvent → UIMessageChunk 映射表建立（参照上游 mapPart/mapEvent 两段产线，直用 SDK 跳过第一段）；auto_retry_start 等未实测事件已明示，略去事件清单留实施 task 补评估
  7. **依赖双拷贝**：显式声明 pi-ai/typebox 同版本后 npm 未完全折叠（顶层+嵌套两份物理拷贝，逐字节相同）——仅跨拷贝 instanceof 有害，本 spike 未触发；实施 task 若遇跨包类型断言问题优先排查此处
- **对 D9 的意义**：pi 库形态路线的最大未知量（离线可驱动性、事件流完备性、session 持久化时机、树分叉真实性）全部落地为【事实】；剩余未知量集中在活模型面（DeepSeek 通道 B 消费续跑、视觉通道 A 探测），等 owner 补 key
- **关联**：T11 三件套（plan/self-check/verify）；commit e58a6ea9（spike/s-pi）

## SP-8 · S-X spike 六项验证离线面全绿（dsh-X 路线机制成立，T12）

- **类型**：证据（核验）
- **时间**：2026-08-22
- **核验命令**：`node spikes/s-x/x3-apply-design.mjs`、`node spikes/s-x/x5-gate-test.mjs`、`node spikes/s-x/x6-system-prompt-probe.mjs`（spike/s-x 分支，spikes/s-x/evidence/ 下 JSON+截图）；Playwright MCP 页面内 evaluate（X1）
- **关键结论**：
  1. **X5 硬 gate 通过**：shell.overlay island 在 5 次真实 session 切换（document.title 交替为证）后 React 宿主与 Vue 实例零重建（reactMounts=1/vueMounts=1/vueUid 不变/domNode 引用同一），切换后岛仍可交互——spike 04 §8 的源码断言（renderSlot 无 only 参数）获运行时实证，dsh-X 路线无需退回 split slot
  2. **双框架 island 可行**：React 宿主 portal + 内嵌 Vue 3 应用经 dsh client-modules 加载，console 0 错 0 警告；**Windows 坑位**：rolldown 向上查找 tsconfig 命中仓库根 `jsx:preserve` 会保留生 JSX（weshop 无此问题是因父目录无 tsconfig），修法是插件目录本地 tsconfig 置 react-jsx；tsdown 0.22.14 的 `jsx` 配置键被静默忽略
  3. **7600 WS 桥 1h 0 断连**：1792 ping / 0 超时 / 0 断连 / RTT p95=1ms（后段与 npm 大安装并行仍稳定）
  4. **apply_design 端到端 <50ms 量级富余**：8 节点 diffMs p50≈0.025ms；1000 节点 10 patch max≈8.4ms（幂等重跑数值微漂、量级稳定）；错误路径（坏 path/坏 op）显式 error 帧
  5. **preset 机制通**：首启自动安装（installed:true）、`session.create {agentPreset:"openpencil-design"}` 被 agent 面接受、UI 模式选择器显示「OpenPencil 设计模式」
  6. **systemPrompt 动态注入装配面生效**：section text 函数逐次装配重新求值（真 cordis + 真 dsh-system-prompt 实证），工具翻转 store 后下一次装配文本即变（48→264 字符）
- **阻塞面（未伪造，已上报 owner）**：X3「模型自主调工具」与 X6「模型回复体现变化」需 LLM key；dsh 的 DeepSeek 模型同样 text-only（与 pi-ai 目录一致），离线面无法覆盖
- **对 D9 的意义**：dsh-X 路线机制风险最大的一项（X5 卸载风险）已排除；S-X 与 S-pi（SP-7）离线面均全绿，D9 拍板所需的可离线证据已齐，余下对比项都需 API key
## D22 · D9 拍板：dsh 插件路线（a）先行，pi SDK 产品版后置

- **类型**：决策
- **时间**：2026-08-22
- **拍板**：owner（会话原话：「先推进dsh插件路线，以后有余力的时候再做一个基于pi sdk路线的产品版本」）
- **状态**：已拍板（D9 从 open 闭环）
- **内容**：
  1. **D9 = a（编辑器入壳 / dsh 插件路线，即 dsh-X）作为当前主线**——open-pencil marketing 工作台作 dsh bundle 发布（spikes/04 §2.1 形态），Phase 1-X 实施启动
  2. **c（pi SDK 直驱）后置为独立产品版本**——S-pi 离线证据（SP-7）与上游 harness 在产参照（SP-6）归档保留，pi 产品版启动时直接可用；S-pi 模型面验证随 pi 产品版后置，不在当前主线补跑
  3. **S-X 模型面（X3 模型调工具 / X6 模型回复响应）仍需补**——它在主路上，阻塞解除条件 = owner 补 API key（DeepSeek 即可，spike 量级成本几毛钱）
- **依据**：S-pi（SP-7）与 S-X（SP-8）离线面均全绿、X5 硬 gate 通过、双路线模型面同卡一个 key；owner 按产品形态意图拍板（dsh 买整套 agent 宿主生态：工具/权限/技能/subagent/preset）
- **注记**：D9 原「当前推荐：c 推 1」为 spike 前口径；owner 拍板与推荐不一致时以拍板为准（本条目即拍板结果）

## D23 · overlay 孤岛内编辑器 = 完整编辑器（画布 + chrome），不是仅画布

- **类型**：决策
- **时间**：2026-08-23
- **拍板**：owner（会话原话：「我从来没有想要丢掉这些能力」——针对「overlay 内为何只有编辑器底层」的质询）
- **状态**：已拍板
- **内容**：
  1. **overlay 孤岛内的编辑器提供完整前端能力**——画布 + 编辑器 chrome（工具栏 / 图层面板 / 属性面板等 src/components 编辑器面板族，由 EditorWorkspace.vue 组装面），此前 03 §2.1「编辑画布 + 自写 ChatPanel + 工具面板」的「编辑画布」措辞被本决策取代
  2. 01-target-state 层 0/层 1/层 2 未列编辑器 chrome 块系**计划空白**（T17 收口后 owner 质询暴露），不是「不做」决策；chrome 移植属主线范围，parity 切换前完成
  3. 实施任务待登记，建议紧随 T18 之后立项。已知工作面（2026-08-23 源码实测）：EditorWorkspace.vue 依赖 @/app/tabs 标签页体系（activeTab/getActiveStore）、@/app/shell/layout-storage、menu/shortcut；WorkspaceView 层的 router / tauri / collab / mcp-runtime 接线在 dsh 形态下需剥离而非照搬；焦点/快捷键与 dsh 宿主页隔离（01 §8 代价 2 已预言「两套」）；孤岛布局需从面板尺寸扩至近全屏
- **依据**：技术核验无根本障碍——chrome 全为 Vue 组件，与孤岛同框架；editor 实例已经 provideEditor 注入孤岛（workbench/src/client/editor-boot.js），EditorCanvas 接法（useCanvas+useCanvasInput）已在孤岛实证同源（T15）。成本集中在 tabs 体系适配、快捷键隔离、布局扩张三项

## D24 · 主线切换：dsh-X 暂时搁置，pi SDK 路线升为主线（新分支从 rebuild/v2 HEAD 起）

- **类型**：决策
- **时间**：2026-08-23
- **拍板**：owner（会话原话：「现在我想暂时搁置这条路线，用另外一个分支，从phase 0 开始走pi sdk路线」）
- **状态**：已拍板（取代 D22 的「dsh 先行、pi 后置」排序；D9 双路线证据结论不变，仅主线切换）
- **内容**：
  1. **dsh-X 主线于 T17 收口态搁置归档，不删除**——workbench 孤岛 / ChatPanel / 7600 桥 / dsh 版本钉扎纪律（03 §5.4）随主线休眠，重启即续；归档态 CI 绿、三件套齐
  2. **pi SDK 路线升为主线**：新分支从 rebuild/v2 HEAD 起（保留 T10 upstream 合并 79 commits/864 文件与全部 docs/rebuild 治理资产）；Phase 0 不重做（其验收在原 app 基线成立、结果已入库），重启的是 Phase 1 runtime 于 pi
  3. **S-pi 离线证据直接启用**：SP-7 离线面全绿（T11 核验讫）与 harness 在产参照（SP-6）按 D22 第 2 条归档可用；S-pi 模型面（原阻塞待 key）随 pi 主线补跑——openrouter key 已就位（T13 于 dsh 面实证），pi-ai 走 declarative OpenAI 兼容网关（03 §3.2），可用性需冒烟实测
  4. **pi 形态下前端口径**：保留现有 Vue app（WorkspaceView + 编辑器 chrome 全量不动——D23「编辑器完整能力保留」在 pi 线下自动满足，无孤岛化问题）；chat UI 按 F0.4 既定口径 Vue 自写重建（传输契约随 runtime 重写）；7600 桥概念沿用，实现按 pi extensions 重接
  5. **已知新成本**（03 §3.2/3.4 既有结论，非新发现）：工具审批与 skills 无内置需自写 extension；pi 周更需 pin + 升级 smoke；无官方插件生态，产品形态回到自管 serve（D4 权重上升）；放弃 dsh 用户群触达这一 X 独占价值（03 §3.5）
- **依据**：01 §8 工作量对比实测结论（X 比 pi 多 17-18 人日，差额集中在 SessionFace 桥 / 双框架运行时 / 白名单同步 / 孤岛化等前端与集成成本）；owner 判断 dsh 线整体工作量超预期

---

## 补注 · D24 第 5 条勘误：skills 在 pi 为内置能力，不属「需自写 extension」

- **类型**：补注（对 D24）
- **时间**：2026-08-23
- **内容**：D24 第 5 条「工具审批与 skills 无内置需自写 extension」中 **skills 半句有误**——pi 内置 Agent Skills 标准支持：`~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/`、`.agents/skills/`（cwd 向父级逐层）文件系统发现 + `/skill:name` 展开 + 可经 pi package 分享（pi packages/coding-agent README.md:354-367、docs/extensions.md:895-933，2026-08-23 复核原文；spikes/02 §P8 早有同结论）。**工具审批**半句维持原判（自写 `tool_call` event + `ctx.ui.confirm()`，extensions.md:778-799）。owner 提出「skill 支持可后期引入别人的 extension」——实际更优：skills 无需 extension，第三方 SKILL.md（agentskills.io 开放标准，多工具通用）直接落目录即用
- **同步修正**：03 §3.2 skills 行已就地勘误（原述「无内置子系统」误，与 02 §P8 矛盾，按详细证据文档为准）

## 状态更新 · D9 / D7 闭环确认 + D24 后全局 D 注册表停更说明（2026-08-25）

- **类型**：状态更新（对既有条目；append-only，原条目不改动）
- **时间**：2026-08-25
- **内容**：
  1. **D9 闭环确认**：D9 条目本体状态字段仍为「open（待 owner 拍板）」——系未回刷的滞留值。D9 已由 D22（2026-08-22 拍 a 先行）与 D24（2026-08-23 拍 pi 升主线、取代 D22 排序）实际闭环；D22 条目自称「D9 从 open 闭环」属实，以本条为 D9 条目的正式状态桥接：**D9 = 已闭环（闭环凭证 = D22/D24）**
  2. **D7 闭环**：D7（runtime 选型）状态字段同为滞留 open——D7 与 D9 同体，闭环凭证同为 D24（pi SDK 升主线）：**D7 = 已闭环（= D24）**
  3. **全局 D 注册表停更现象记录**：D24 之后（T20-T25 窗口），owner 拍板只落在各 task 三件套内的任务级 D 编号（T22-plan D1-D6、T24-plan D1-D9、T25-plan D1-D4 等），全局 records/topics/ 层未再新增 D 条目——全局 D 注册表事实停更于 D24。任务级 D 与全局 D 撞名（如 T24-plan 的 D5 overlay 形状 vs 全局 D5 chatMode）已构成检索歧义，整改方案报送 owner（见 2026-08-25 review 报送清单）

## D3 补签 · session 模型 = 一文件多会话 + 族谱，owner 正式拍板（2026-08-25）

- **类型**：决策（补签——对「已事实落地待补签」的形式闭环）
- **时间**：2026-08-25
- **拍板**：owner（2026-08-25 对三方 review 整改 15 项决策批 #3 逐项拍板）
- **状态**：已拍板（D3 从 open 正式闭环）
- **内容**：**session 模型 = 一文件多会话 + 族谱形态确认**——T22/T23 事实落地形态获 owner 正式确认：pluginData docUuid 文件身份 + sessionId 三段式（`doc-<sha1>-<ts>`，clear 即同前缀新后缀开新会话）+ 后端族谱清单（GET /api/pi/sessions）+ ChatPanel 会话栏查看/切换
- **落地凭证**：[tasks/T22-plan.md](../../tasks/T22-plan.md) / [tasks/T23-plan.md](../../tasks/T23-plan.md) / [tasks/T23-verify.md](../../tasks/T23-verify.md)；[01-target-state.md §6 决策表](../../01-target-state.md) D3 行已同步「已拍板」

## 补登 · 全局 D 注册表恢复登记（D25-D29，T20-T25 窗口 owner 拍板补登，2026-08-25）

- **类型**：决策（补登记——原记录在各 task plan 的任务级 D 编号，本条为全局 D 编号层面的统一补登；2026-08-25 owner 决策批 #7 拍板 D 编号规则改口后执行）
- **时间**：2026-08-25
- **拍板**：各条均为 owner 拍板（拍板日期各条标注；本条目为形式补登，非新决策）
- **说明**：D24 后全局 D 注册表停更（见上条状态更新第 3 点）的补救登记——T20-T25 窗口的 owner 拍板原载于各 task 三件套，现按时间序补登全局编号 D25 起；内容一句话 + 出处指针，详情以出处为准
- **补登清单**：
  - **D25 · pi 后端为独立进程（非 vite 中间件）且为唯一 agent 能力来源**——owner 拍板 2026-08-23（T20 开工前两拍板之一）；出处 [tasks/T20-plan.md](../../tasks/T20-plan.md) / [records/narrative/tracker.md](../narrative/tracker.md) T20 行登记条目
  - **D26 · LLM provider/凭据管理一步到位 pi 原生（ModelRuntime + auth.json），不迁移存量凭据、参考 deepseek-harness 产品形态**——owner 拍板 2026-08-24；出处 [tasks/T21-plan.md](../../tasks/T21-plan.md)
  - **D27 · 会话查看/切换 UI 立项（后端族谱清单 + ChatPanel 会话栏下拉），废止 T22-plan §1.4「会话线程列表 UI 不做」约定**——owner 直接诉求 2026-08-24；出处 [tasks/T23-plan.md](../../tasks/T23-plan.md) / [records/topics/chat-ui.md](chat-ui.md)（本条横跨 agent-runtime 与 chat-ui 两主题，登记于此备查）
  - **D28 · prompt 装配四层抽象体系（AgentMode 建会话烘焙 base prompt/工具集 → per-run 工作流段注入 → per-run profile overlay）+ chatMode 请求级 + 切换即驱逐重建**——owner 三轮评审拍板 2026-08-24；出处 [tasks/T24-plan.md §1.2 D1-D9](../../tasks/T24-plan.md)；chatMode 双模式去留本身的闭环见 [records/topics/chat-ui.md](chat-ui.md) D5 补签条目
  - **D29 · 浏览器旧路径切除四决策（T25-plan D1-D4）：harness 路径切除（含 packages/harness 整包）/ 旧模型与凭证设置面切除（analyze 贴图分析知情退化，C4a 恢复）/ VITE_PI_BACKEND 门退役 / 一键启动（server.open + key-env 自助注入）**——owner 拍板 2026-08-24；出处 [tasks/T25-plan.md §1.2 D1-D4](../../tasks/T25-plan.md)
- **后续口径**：自 2026-08-25 起任务内设计决策一律 Tk-Dn 命名、全局 D 仅用于跨任务决策（决策批 #7，规则文见 [records/_index.md §1](../_index.md)）；本组补登是全局 D 最后一次批量回填

---

## D4 · 产品形态，owner 正式拍板（2026-08-28）

- **类型**：决策
- **时间**：2026-08-28
- **拍板**：owner
- **状态**：已拍板（D4 从 open 正式闭环）
- **内容**：**短期 localhost serve，中长期转 Electron，不考虑 Tauri**——T33 建成的 host.ts 生产编排器（`bun run build && bun run serve` 一条链）形态获确认；Phase 0 删除 tauri/desktop 整块的减法获最终背书；Electron 为未来独立立项事项。
- **影响**：B4（cli → serve 入口）与 packages/cli 处置解锁；[01-target-state.md §7 决策表](../../01-target-state.md) D4 行已同步「已拍板」
