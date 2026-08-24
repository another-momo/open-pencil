<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T24-plan.md · T24 计划

> **T 编号**：T24（Phase 1-pi 实施 · prompt 装配）
> **状态**：🔄 方案定稿（owner 三轮评审拍板 2026-08-24：四层抽象体系，待实施）

## 1. 问题与决策

### 1.1 现状缺口（证据见 self-check §2）

当前 pi 后端的系统提示是单块静态文本：`system-prompt.md`（576 行）经 `DefaultResourceLoader({ systemPrompt })` 在建会话时一次定型（service.ts:131-138），无 chatMode 概念、无 marketing 段、无 brand overlay——上游的两段式 prompt（base + marketing）与每轮 overlay 注入在本仓零基础（brand/brief/marketing 全仓零残留，2026-08-24 recon 实证）。这是 F0.6「prompt 注入点」，也是层 1 闭环 C2a（选 type/profile 到模型可见）的前提。

### 1.2 决策

- **D1 四层抽象体系（owner 拍板 2026-08-24）**：`AgentMode（会话构建期：base prompt + 工具集）→ 工作流段（per-run 注入）→ style profile overlay（per-run 注入）`。模式是注册表条目：每个 mode 声明建会话时的 base prompt 与工具集、可选的 per-run 工作流段、是否接受 profile overlay。
- **D2 两个初始模式**：
  - `ui`（默认）：base = 现 `system-prompt.md` 原样（**不拆不改**，576 行实战文件零行为漂移）+ 现有 26 件工具集；无工作流段、无 profile overlay。
  - `marketing`：base = 上游 `system-prompt-base.md`（118 行 fork 策划件移植）+ 现有工具集（营销工具归 C3a，落地时进本模式工具集）+ per-run 工作流段 = 上游 `system-prompt-marketing.md`（192 行移植）+ per-run profile overlay。
- **D3 注入路径分层**：base 段与工具集走 `createAgentSession`（resourceLoader.systemPrompt / customTools，建会话期定型）；工作流段与 profile overlay 走 pi inline extension 的 `before_agent_start`，每 run 链式返回 `原 systemPrompt + 工作流段? + overlay?`（ephemeral、不落盘、run 后自清、重启安全——pi 无 ctx.inject/section API，这是 recon 实证的受控注入点，extensions/types.ts:715-727,1118-1122）。不走 `context` 事件（user 消息位、工具回合重复注入、token 成本高）；不走 message 结果（持久化污染历史）。
- **D4 chatMode 请求级 + 切换即重建会话对象**：随请求体上送（默认 ui），后端按 sessionId 记住上次模式，不匹配则驱逐缓存 SessionEntry，下个 prompt 经 `SessionManager.open` 重建（同一 sessionId、同一 JSONL 历史——JSONL 不存 systemPrompt，session-manager.ts:32-39，重建无损；新对象自然携带新模式的 base 与工具集）。**不开新 sessionId、不 fork**——族谱不受模式切换污染，用户感知为同一段对话继续（上游 chatMode 切换亦不断消息）。profile/工作流段内容变化不触发重建（per-run 注入兜底）。
- **D5 overlay 形状复刻上游 + 单源化**：`\n\n` 前缀 Markdown 段；`## Material types in the current brand` 列表段恒在（空则输出引导 custom 的 fallback）；`## Active style profile: {id}` + profile.markdown 段**仅当用户显式 picked**；picked 未命中输出 re-pick 提示段。构建器单源（`src/app/ai/pi-backend/prompt-overlay.ts` 纯函数零依赖）——上游前后端 byte-mirror 人工对齐是已知脆弱点，本仓后端单源。
- **D6 brand 数据源薄切**：YAML 种子单层（port 上游 `public/default-brand/config.yaml`），后端启动加载，无 SQLite 覆盖层/CRUD/写路由（C2a 范围）。只读 `GET /api/pi/brand/manifest` 供前端选择器。种子缺失/为空 → overlay fallback 段（`setup_material_type` 注册表联动属 C3a，本任务无该工具）。
- **D7 请求载荷最小化**：前端每请求只多带 `chatMode` + `pickedProfileId`（可 null），沿 T22 已打通的 `PiRequestContext → transport → server → service.prompt` 管道。types/profiles/工作流段永远后端读——客户端无法伪造任意注入文本（信任边界）。
- **D8 薄 UI 承接**：聊天输入条挂「模式切换（设计/营销）+ profile 下拉（仅 marketing 模式可用）」（照 ChatProfileSelect 先例，ChatInput.vue #model slot 区），选择态持久化进全局 settings store（照 aiModelSettings 先例）。MarketingConfigBar 完整形态归 C5a。
- **D9 浏览器旧 ToolLoop 退役另行清扫**（T25），不塞进本任务。

### 1.3 决策副作用与边界

- 工作流段与 overlay 均下一轮生效（per-run 重装配），无进行中 push——与上游语义一致（prepareCall 每轮重建）。
- 模式切换驱逐 SessionEntry 重建会话：历史保留（SessionManager.open 读 JSONL），但进行中的 run 不能切模式（流式中切模式 = 下一轮才生效，入口在流式态禁用，同 T23 切换会话纪律）。
- YAML 种子单层意味着「用户自定义 brand」能力缺席，overlay 永远反映种子内容——C2a 接 SQLite 覆盖层时本装配层不变，只换数据源。
- marketing 工作流段提到 generate_image / setup_material_type 等工具，本仓尚无（F0.3②/C3a 范围）——prompt 文本先行移植，工具缺口登记为已知边界，不伪造；工具落地时进 marketing 模式的 create-time 工具集（D2 注册表位已留）。
- ui 模式的 base prompt **byte 级不变**（现 system-prompt.md 原样），ui 用户零感知、零回归面；新能力全部长在 marketing 模式与共享注入管道上。

### 1.4 明确不做

- BrandRepository（SQLite 覆盖层、CRUD、/v1/brand 写路由）——C2a。
- MarketingConfigBar 完整 UI、ProfileGalleryDialog——C5a。
- setup_material_type / generate_image 等营销工具——C3a（F0.3② 生图凭证链先行）。
- brief 原语与需求单面板——C1a。
- 旧 ToolLoop 删除——T25。

## 2. 验收清单

- **C1 装配正确**：ui 模式请求 → 模型收到现 system-prompt.md **byte 级原样**（无 marketing 内容，探针断言 marketing 工作流段独有句式不出现）；marketing 模式 → 建会话时 BASE 段烘焙 + 每 run 注入 MARKETING 工作流段（探针断言独有句式出现在当次 run system prompt）。
- **C2 overlay 注入**：marketing 模式 + picked profile → 当次 run 的 system prompt 含 `## Active style profile: {id}` 与种子 profile.markdown；未 picked → 只有 types 列表段；种子为空 → fallback 引导段；**ui 模式任何情况下无 overlay**（mode 声明不接受 profile）。
- **C3 每轮重装配 + 模式重建**：切换 profile 后下一条消息的 system prompt 反映新 overlay（不重建会话文件、历史保留）；ui→marketing 模式切换后下一条消息 = BASE 基底 + MARKETING 工作流段（SessionEntry 驱逐重建，同 sessionId、JSONL 历史仍在——T22 回填不破）。
- **C4 载荷最小**：/api/pi-chat 请求体仅新增 `chatMode`/`pickedProfileId` 两字段（抓包断言无 manifest/工作流段内容）。
- **C5 薄 UI**：模式切换 + profile 下拉可用（profile 下拉仅 marketing 模式可用，ui 模式禁用/隐藏）、选择持久化（刷新后保留）、流式中禁用；manifest 拉取失败时 profile 下拉降级为空态、overlay 输出 fallback。
- **C6 回归**：T22/T23 冒烟全绿（history 12/12、sessions 14/14、sessions-bind 19/19、bind 15/15）；gates 全绿 + CI 绿。

## 3. 实施面

### 3.1 后端

1. 移植 prompt 段：`src/app/ai/pi-backend/prompts/system-prompt-base.md` + `system-prompt-marketing.md`（上游 fork 文件移植，标注来源与「不机械同步」纪律）。
2. `modes.ts` 模式注册表（D1 抽象的代码化身）：每个 mode 声明 `basePrompt`（读盘路径，ui → 现 system-prompt.md / marketing → system-prompt-base.md）、`workflowSegment`（可空，marketing → system-prompt-marketing.md）、`acceptsProfile`（ui=false / marketing=true）、工具集位（初版两模式同享现有 26 件，营销工具落地时在此分流）。
3. `prompt-overlay.ts` 纯函数单源：`buildMarketingOverlay({ types, profiles, pickedProfileId })` 复刻上游 brand-overlay.ts 输出形状。
4. brand 种子：`src/app/ai/pi-backend/brand/`（YAML 加载 + effectiveTypes/effectiveProfiles 只读面）+ `GET /api/pi/brand/manifest` 只读路由。
5. service.ts：`createSession(sessionId, modelSpec, chatMode)` 按注册表选 base prompt 烘焙；inline extensionFactory 每 session 注入，`before_agent_start` 闭包读 entry 的当次 overlay 袋 + 注册表工作流段，返回 `原 systemPrompt + 工作流段? + overlay?`（ui 模式钩子直接不返回/返回空 → 基底原样）；模式变更驱逐重建；`prompt(..., chatMode, pickedProfileId)`。
6. server.ts：body 解析两新字段 + manifest 路由。

### 3.2 前端

7. document-key.ts：`getPiRequestContext` 增 `chatMode`/`pickedProfileId`（读全局选择 store）。
8. 选择态 store（照 aiModelSettings 先例，localStorage 持久化）+ manifest 拉取缓存（失败 → null → 降级）。
9. ChatInput 工具条：模式切换 + profile select（ChatProfileSelect 先例；profile 下拉仅 marketing 模式可用；流式禁用；manifest 失败空态）。

### 3.3 测试/冒烟

10. 后端装配冒烟（免 LLM key，route 拦截 /api/pi-chat 的姊妹方案不可见 system prompt——需后端探针：测试用 extension 或日志断言当次 run 实际 systemPrompt 内容；优先用 pi extension 钩子捕获 before_agent_start 入参落临时文件断言）。
11. 浏览器冒烟：选 profile → 发送 → 探针问句验证 overlay 生效；切模式 → 发送 → 验证基底+工作流段切换且历史回填不破（T22/T23 回归）。

## 4. 风险与边界

- pi extension 的 `before_agent_start` 链式语义已 recon 实证（runner.ts:1087-1121），但我们自创 inline extension 是首个用法——冒烟必须断言注入真的到达模型（探针句式），不接受代码推演。
- 模式切换驱逐重建依赖 SessionManager.open 保历史——T22 history 冒烟覆盖该路径（12/12 已绿），C3 回归时复跑。
- 种子 YAML 移植自上游 fork 资产，内容版权/口径由 owner 知悉；种子为空是合法降级态。
- 本任务交付后「营销闭环」仍缺生图工具与 brief——层 1 验收不归本任务。

## 5. 身份

- **owner 诉求链**：F0.6 prompt 注入点（01-target-state.md:33）→ C2a 依赖前提（01-target-state.md:45）
- **recon 证据**：T24-self-check §2（pi 能力面 / 上游语义 / 仓内底座三路，2026-08-24）
