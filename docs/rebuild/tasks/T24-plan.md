<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T24-plan.md · T24 计划

> **T 编号**：T24（Phase 1-pi 实施 · prompt 装配）
> **状态**：🔄 立项（2026-08-24 recon 完成，待 owner 评审方案）

## 1. 问题与决策

### 1.1 现状缺口（证据见 self-check §2）

当前 pi 后端的系统提示是单块静态文本：`system-prompt.md`（576 行）经 `DefaultResourceLoader({ systemPrompt })` 在建会话时一次定型（service.ts:131-138），无 chatMode 概念、无 marketing 段、无 brand overlay——上游的两段式 prompt（base + marketing）与每轮 overlay 注入在本仓零基础（brand/brief/marketing 全仓零残留，2026-08-24 recon 实证）。这是 F0.6「prompt 注入点」，也是层 1 闭环 C2a（选 type/profile 到模型可见）的前提。

### 1.2 决策

- **D1 三段装配，次序固定**：`BASE + MARKETING (+ overlay)`，字符串直拼无分隔符（上游语义复刻，见 self-check §2.2）。ui 模式仍用独立单段 DESIGN prompt（现 system-prompt.md 原样承当）。base/marketing 两段内容移植上游 fork 的 `system-prompt-base.md`（119 行）与 `system-prompt-marketing.md`（193 行）——fork-owned 策划件，不机械同步上游。
- **D2 注入路径：静态段走 resourceLoader，overlay 走 pi inline extension 的 `before_agent_start`**（每 run 链式返回 `systemPrompt: 原值 + overlay`，ephemeral、不落盘、run 后自动清、重启安全——pi 无 ctx.inject/section API，这是 recon 实证的受控注入点，sdk.ts:353 / extensions/types.ts:715-727,1118-1122）。不走 `context` 事件（user 消息位、含工具回合每次重复注入、token 成本高）；不走 `before_agent_start` 的 message 结果（会持久化 custom_message 污染历史）。
- **D3 chatMode 请求级**：随请求体上送（`chatMode: 'ui' | 'marketing'`，默认 ui），后端无会话态。因静态段 per-session 烘焙，模式切换 = 后端驱逐该 sessionId 的缓存 SessionEntry，下个 prompt 经 `SessionManager.open` 重建（历史 JSONL 保留，system prompt 换新）——JSONL 不存 systemPrompt（session-manager.ts:32-39），重建无损。
- **D4 overlay 形状复刻上游**：`\n\n` 前缀 Markdown 段；`## Material types in the current brand` 列表段恒在（空则输出引导 custom 的 fallback）；`## Active style profile: {id}` + profile.markdown 段**仅当用户显式 picked**；picked 未命中输出 re-pick 提示段。构建器单源化（`src/app/ai/pi-backend/prompt-overlay.ts` 纯函数零依赖）——上游前后端 byte-for-byte 人工镜像是已知脆弱点，本仓后端单源，前端不复制。
- **D5 brand 数据源薄切**：YAML 种子单层（port 上游 `public/default-brand/config.yaml` 进仓），后端启动时加载，无 SQLite 覆盖层、无 CRUD、无 /v1/brand 写路由（那是 C2a）。只读 manifest 端点 `GET /api/pi/brand/manifest` 供前端选择器。种子缺失/为空 → overlay fallback 段（两侧语义联动降级；`setup_material_type` 工具注册表联动属 C3a 范围，本任务无该工具）。
- **D6 请求载荷最小化**：前端每请求只多带 `chatMode` + `pickedProfileId`（可 null），沿 T22 已打通的 `PiRequestContext → transport → server → service.prompt` 管道走全程（每层小 diff）。types/profiles 永远后端读，前端不传 manifest 内容进 prompt。
- **D7 薄 UI 承接**：聊天输入条挂「模式切换（设计/营销）+ profile 下拉」（照 ChatProfileSelect 的 reka Select 先例，ChatInput.vue #model slot 区），选择态持久化进全局 settings store（照 aiModelSettings 先例）。MarketingConfigBar 完整形态是 C5a，不在本任务。
- **D8 浏览器旧 ToolLoop 退役另行清扫**（transports.ts 双路径收敛单路径），编号 T25，不塞进本任务。

### 1.3 决策副作用与边界

- overlay 下一轮生效（per-run 重装配），无进行中 push——与上游语义一致（prepareCall 每轮重建）。
- 模式切换驱逐 SessionEntry 重建会话：历史保留（SessionManager.open 读 JSONL），但进行中的 run 不能切模式（流式中切模式 = 下一轮才生效，入口在流式态禁用，同 T23 切换会话纪律）。
- YAML 种子单层意味着「用户自定义 brand」能力缺席，overlay 永远反映种子内容——C2a 接 SQLite 覆盖层时本装配层不变，只换数据源。
- marketing 段提到 generate_image 等工具，本仓尚无（F0.3②/C3a 范围）——prompt 文本先行移植，工具缺口在 overlay/工作流语义上登记为已知边界，不伪造。

### 1.4 明确不做

- BrandRepository（SQLite 覆盖层、CRUD、/v1/brand 写路由）——C2a。
- MarketingConfigBar 完整 UI、ProfileGalleryDialog——C5a。
- setup_material_type / generate_image 等营销工具——C3a（F0.3② 生图凭证链先行）。
- brief 原语与需求单面板——C1a。
- 旧 ToolLoop 删除——T25。

## 2. 验收清单

- **C1 装配正确**：ui 模式请求 → 模型收到现 system-prompt.md 单段（无 marketing 内容）；marketing 模式 → BASE+MARKETING 两段次序拼接（探针断言：marketing 段独有句式出现在 system prompt，ui 模式不出现）。
- **C2 overlay 注入**：marketing 模式 + picked profile → 当次 run 的 system prompt 含 `## Active style profile: {id}` 与种子 profile.markdown；未 picked → 只有 types 列表段；种子为空 → fallback 引导段。
- **C3 每轮重装配**：切换 profile 后下一条消息的 system prompt 反映新 overlay（不重建会话文件、历史保留）；ui→marketing 模式切换后下一条消息换 BASE+MARKETING（SessionEntry 驱逐重建，JSONL 历史仍在——T22 回填不破）。
- **C4 载荷最小**：/api/pi-chat 请求体仅新增 `chatMode`/`pickedProfileId` 两字段（抓包断言无 manifest 内容）。
- **C5 薄 UI**：模式切换 + profile 下拉可用、选择持久化（刷新后保留）、流式中禁用；agent 不可得（manifest 拉取失败）时 profile 下拉降级为空态、overlay 输出 fallback。
- **C6 回归**：T22/T23 冒烟全绿（history 12/12、sessions 14/14、sessions-bind 19/19、bind 15/15）；gates 全绿 + CI 绿。

## 3. 实施面

### 3.1 后端

1. 移植 prompt 段：`src/app/ai/pi-backend/prompts/system-prompt-base.md` + `system-prompt-marketing.md`（上游 fork 文件移植，标注来源与「不机械同步」纪律）。
2. `prompt-overlay.ts` 纯函数单源：`buildMarketingOverlay({ types, profiles, pickedProfileId })` 复刻上游 brand-overlay.ts 输出形状。
3. brand 种子：`src/app/ai/pi-backend/brand/`（YAML 加载 + effectiveTypes/effectiveProfiles 只读面）+ `GET /api/pi/brand/manifest` 只读路由。
4. service.ts：`createSession(sessionId, modelSpec, chatMode)` 按模式选静态段；inline extensionFactory 每 session 注入，`before_agent_start` 闭包读 entry 的 overlay 袋返回 `systemPrompt + overlay`；模式变更驱逐重建；`prompt(..., chatMode, pickedProfileId)`。
5. server.ts：body 解析两新字段 + manifest 路由。

### 3.2 前端

6. document-key.ts：`getPiRequestContext` 增 `chatMode`/`pickedProfileId`（读全局选择 store）。
7. 选择态 store（照 aiModelSettings 先例，localStorage 持久化）+ manifest 拉取缓存（失败 → null → 降级）。
8. ChatInput 工具条：模式切换 + profile select（ChatProfileSelect 先例；流式禁用；manifest 失败空态）。

### 3.3 测试/冒烟

9. 后端装配冒烟（免 LLM key，route 拦截 /api/pi-chat 的姊妹方案不可见 system prompt——需后端探针：测试用 extension 或日志断言当次 run 实际 systemPrompt 内容；优先用 pi extension 钩子捕获 before_agent_start 入参落临时文件断言）。
10. 浏览器冒烟：选 profile → 发送 → 探针问句验证 overlay 生效；切模式 → 发送 → 验证段落切换且历史回填不破（T22/T23 回归）。

## 4. 风险与边界

- pi extension 的 `before_agent_start` 链式语义已 recon 实证（runner.ts:1087-1121），但我们自创 inline extension 是首个用法——冒烟必须断言注入真的到达模型（探针句式），不接受代码推演。
- 模式切换驱逐重建依赖 SessionManager.open 保历史——T22 history 冒烟覆盖该路径（12/12 已绿），C3 回归时复跑。
- 种子 YAML 移植自上游 fork 资产，内容版权/口径由 owner 知悉；种子为空是合法降级态。
- 本任务交付后「营销闭环」仍缺生图工具与 brief——层 1 验收不归本任务。

## 5. 身份

- **owner 诉求链**：F0.6 prompt 注入点（01-target-state.md:33）→ C2a 依赖前提（01-target-state.md:45）
- **recon 证据**：T24-self-check §2（pi 能力面 / 上游语义 / 仓内底座三路，2026-08-24）
