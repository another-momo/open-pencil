<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T24-self-check.md · T24 自查记录

> **T 编号**：T24（Phase 1-pi 实施 · prompt 装配）
> **状态**：🔄 立项（2026-08-24 三路 recon 完成）

## 1. 立项依据

F0.6「prompt 注入点」是层 1 价值闭环 C2a（选 type/profile → overlay 注入 → 模型可见）的前提（[01-target-state.md §2](../01-target-state.md) F0.6 行与层 1 表）。T23 收口后 owner 指示推进。

## 2. 侦察事实（注册期，2026-08-24 三路并行 recon）

### 2.1 pi SDK 能力面（源码实证：参考项目/pi/packages/coding-agent 0.84.2，与已装包 d.ts 一致）

1. `CreateAgentSessionOptions` 无 systemPrompt 字段（core/sdk.ts:38-87）；唯一注入点 = resourceLoader 的 `systemPrompt / appendSystemPrompt / systemPromptOverride`（core/resource-loader.ts:173-191）
2. AgentSession 无公开 setSystemPrompt；私有 `_systemPromptOverride` 只由 before_agent_start 钩子结果设置（core/agent-session.ts:377,1262-1264）；直接写 `agent.state.systemPrompt` 会在下个 turn 边界被刷掉（agent-session.ts:551、1265-1268、1079 finally 清）
3. system prompt 不在消息历史里——每次 LLM 调用从 context 取（packages/agent/src/agent-loop.ts:298-302），运行期改它不触碰历史
4. **受控运行期注入 = inline extension**：`extensionFactories`（resource-loader.ts:167）+ `pi.on("before_agent_start")` 返回 `{ systemPrompt }`——链式传递（extensions/runner.ts:1087-1121）、本 run ephemeral、run 后自动清、不落盘。`BeforeAgentStartEvent` 带 prompt/systemPrompt（extensions/types.ts:715-727），结果形 `{ message?, systemPrompt? }`（:1118-1122）
5. `context` 事件可换整条消息数组（runner.ts:984-1011，structuredClone 只影响当次调用）但注入在 user 消息位且含工具回合每次触发——token 成本高，非首选；`before_agent_start` 的 message 结果会持久化 custom_message（agent-session.ts:648-656，重启回放），不适合 ephemeral overlay
6. pi 无 ctx.inject / systemPrompt.section API（deepseek-harness 先例 dsh 专有，全仓 grep 零命中）
7. JSONL 不存 systemPrompt（SessionHeader 仅 type/id/timestamp/cwd/parentSession，session-manager.ts:32-39）——恢复时由 ResourceLoader 重新装配（agent-session.ts:401-405,949），调用方每次重传；模式切换驱逐 SessionEntry 重建 = 历史保留 + 新静态段，无损
8. 当前注入点实况：service.ts:72-75 静态读盘缓存 + :131-138 resourceLoader 一次定型；prompt 路径 :158-205，`entry.session.prompt(text)` :192 无任何 prepend 位置

### 2.2 上游两段式 + overlay 语义（../open-pencil 工作区 HEAD 实证，packages/agent 仍在）

9. 三常量结构（packages/agent/src/prompts/generated/prompts.ts:2,575,769，由 scripts/inline-prompts.ts 从三个 md 内联生成）：DESIGN=单段（ui 模式）；BASE（119 行，身份+设计 DSL 参考，fork-owned 策划件）+ MARKETING（193 行，营销工作流）直拼 = marketing 模式；拼接无分隔符（prompts/index.ts:10）
10. overlay 注入点 = prepareCall 每轮重建，追加在 BASE+MARKETING 后（agent-loop.ts:92,101-105；前端镜像 transports.ts:144-154）——下一轮生效，无进行中 push
11. overlay 形状：`\n\n` 前缀纯 Markdown 段（prompts/brand-overlay.ts:31-69）：types 列表段恒在（空→引导 custom 的 fallback）；`## Active style profile` 段仅用户显式 picked；picked 未命中→re-pick 提示段。唯一用户输入字段 = `pickedProfileId`（BrandSelection，brand-overlay.ts:16-19）
12. chatMode `'ui'|'marketing'` 请求级（marketing/settings.ts:23,52 localStorage 持久化；agent-loop.ts:31 后端同型）；ui 模式剔除 marketing-only 工具（agent-loop.ts:80-83）；切换走 markTransportDirty 下条消息生效（settings.ts:140）
13. manifest 不进请求体：前端只发 pickedProfileId（http-agent-transport.ts:56-67），后端 BrandRepository（default YAML 层 + SQLite 覆盖层合并，seed 自 public/default-brand/config.yaml）供 types/profiles（routes/brand.ts:104 GET /manifest）
14. 已知脆弱点：前后端 overlay 构建 byte-for-byte 人工镜像（brand-overlay.ts:22-30 注释约束）——本仓单源化（D4）
15. 无 prompt 组装 golden 测试；overlay 文本零断言——输出格式以 brand-overlay.ts 为事实标准

### 2.3 仓内底座现状（2026-08-24 recon）

16. brief/brand/marketing 全仓零残留（grep 实证）；MarketingConfigBar 不存在；`profile` 现存语义 = AI 模型档案（src/app/ai/models/），非内容 profile
17. 工具面：CORE_TOOLS 22 件 + EXTENDED 白名单 4 件（tools.ts:40-45,194-200），无 setup_material_type/generate_image——营销工具缺口属 F0.3②/C3a
18. 请求上下文管道现成（T22）：getPiRequestContext → transport 请求体 → server body → service.prompt 参数（document-key.ts:142-150、transport.ts:30-40、server.ts:38-44,101、service.ts:158-166）——加 chatMode/pickedProfileId 每层小 diff
19. 选择器 UI 先例：ChatProfileSelect.vue（reka Select + useSelectUI + data-test-id 纪律）挂 ChatInput.vue:202-239 #model slot；全局选择态持久化先例 aiModelSettings（src/app/ai/models/store.ts）
20. 类型枚举种子可用：frame-presets.ts:1-9 FramePresetCategoryId（含 social-media）+ 78 个尺寸预设——可作 type→默认画板尺寸映射数据
21. pluginData 身份通道先例（document-key.ts:36-72 惰性铸造 + findDocIdEntry 只读）可复用于未来 brief 绑定——本任务不需要（C1a 范围）

## 3.1 实施事实

（待实施期回填）

## 3.2 与计划的偏差

（待实施期回填）

## 3.3 已知边界

（待实施期回填）
