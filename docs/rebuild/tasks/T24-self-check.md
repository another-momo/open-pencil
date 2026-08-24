<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T24-self-check.md · T24 自查记录

> **T 编号**：T24（Phase 1-pi 实施 · prompt 装配）
> **状态**：✅ 已收口（2026-08-24 独立核验 V1-V6 全过「可以收口」——[T24-verify](T24-verify.md)；CI 整改翻转后远端全绿）

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

1. **外部传入的 DefaultResourceLoader 必须自行 `reload()`**——createAgentSession 只在自构 loader 时才 reload（sdk.js `if (!resourceLoader)` 分支）；不 reload 则 extensionsResult 停留初始空集（resource-loader.js:183 初始值），inline extension 永不登记、before_agent_start 永不 fire。实证：首版实现 probe 不落盘、SSE 直接 finish('stop')（2026-08-24 调试复现）；补 `await loader.reload()` 后注入生效。此坑 T19-T23 未踩只因此前无 extension
2. **pi buildSystemPrompt 固有尾巴**：自定义 systemPrompt 之后恒追加 `\nCurrent working directory: <cwd>\n`（正斜杠规范化）——「byte 级原样」精确口径 = 文件字节 + 该尾巴。T21 起即如此（同一条 resourceLoader 路径），非 T24 引入。冒烟断言按此口径（2026-08-24 探针 diff 实证：公共前缀 28032 = 文件全长，尾巴 82 字节）
3. **auth 预检拦在 before_agent_start 之前**（agent-session.js：hasConfiguredAuth 检查 → 无 key 直接 throw，钩子不 fire）——免 key 装配冒烟必须先经 POST /api/pi/credentials 写 dummy key（写进 tempRoot 自带 agentDir，不碰真实 .openpencil）
4. **探针机制**：env `PI_PROMPT_PROBE_DIR` 显式设置时登记第二个 inline extension（service.ts），位于装配 extension 之后——runner 链式语义（runner.js:846-868 currentSystemPrompt 传递）保证探针读到的 event.systemPrompt 即最终注入值；每 run 覆写 `last-system-prompt.md`
5. **runner else 分支复位**（agent-session.js:905-908）：钩子不返回时 systemPrompt 回 _baseSystemPrompt——ui 模式钩子返回 undefined 即零注入，per-run 不粘连
6. 模式切换驱逐前 `await existing.queue.catch(...)` 再 dispose——防御性排队防腰斩活跃流（前端流式中已禁发，此为后端兜底）
7. 冒烟实证附属发现：Windows 上 `proc.killed` 在 kill() 后立即置位（不代表进程已退），冒烟清理必须等 exit 事件 + rmSync 重试；首两轮失败运行残留 12 个孤儿 bun 后端（各占监听端口），已清——积聚会顶爆 oxlint 的 fixed-size allocator（lint 报 Insufficient memory 的真因）

## 3.2 与计划的偏差

1. **prompt 签名从位置参数改为 options bag**（`prompt(sessionId, text, emit, { model, documentId, chatMode, pickedProfileId })`）——参数增至 5 个后可读性差；server.ts 唯一调用点同步改
2. **brand-manifest.ts 落入 brand/ 文件夹**（brand/manifest.ts）——lint 规则 no-sibling-domain-prefixed-files 要求；类型契约单源语义不变
3. **选择态持久化用 useLocalStorage**（storage.ts 先例，`open-pencil:pi-chat-mode` 键）而非裸 localStorage——lint 规则 no-direct-storage-access 要求
4. **re-pick 提示段文案改指路**——上游提 MarketingConfigBar（本仓无），改为「re-pick in the chat profile dropdown」（prompt-overlay.ts 头注释登记；C5a 落地 MarketingConfigBar 时再对齐）
5. **yaml 升为直接依赖**（^2.9.0）——此前仅 pi 包的传递依赖；种子解析需显式依赖

## 3.3 已知边界

1. marketing 工作流段提到 generate_image / setup_material_type / read_brief / compose_backdrop / derive_palette 等工具，本仓尚无（F0.3②/C3a/C1a 范围）——模型被指示「只调用工具列表里实际存在的工具」（工作流段 Phase 2.5 末句），缺口不伪造
2. manifest 失败路径：前端 profile 下拉禁用空态 + 后端 overlay fallback 段，两侧降级语义一致；manifest 进程内只拉一次（不轮询不订阅）
3. pickedProfileId 不随模式切回 ui 清空——回切 marketing 时选择仍在；ui 模式请求体仍带该字段（后端注册表兜底忽略），不视为泄露（id 非敏感）
4. 模式切换入口在流式中禁用（前端 disabled + 后端 queue 排队兜底）；切换=驱逐重建对聊天 UI 无感（chat.messages 不动，历史回填语义不变）
5. 本机环境限制（与改动无关，已 stash 实证为既有）：check:secrets 缺 gitleaks/go 二进制无法本机运行；check:audit 因 npmmirror 镜像 404；tools/type-shapes 一宗 Windows 路径分隔符测试既存失败（干净树同样失败，CI Linux 不受影响）
6. ~~T19/T20/T21 LLM 冒烟仍待 owner 补 OPENROUTER_API_KEY 后补跑~~ → **2026-08-24 已补跑全绿**（key 实证就在本机 .openpencil/key-env）：admin 21/21、settings 11/11、tools 9/9、T19 smoke 15/15、T20 tool-smoke 18/18。阻塞项完全消解——CI 无 LLM 冒烟 job（grep .github/workflows 实证），不存在 CI 补跑面——详见 [T22-self-check.md §3.1-20](T22-self-check.md)
7. 独立核验附赠发现（2026-08-24）：装配冒烟 stop() 在 Windows+bun 下仍可能残留孤儿后端（绿色运行后两进程仍监听，核验时已手动 taskkill）——§3.1-7 的「kill 后等 exit + taskkill 兜底」在该组合下未真正杀死子进程（疑似 exit 事件虚假置位跳过兜底分支）。不影响断言结论（验证工具非交付代码），建议 T25 或冒烟维护时把 stop() 改为「kill 后按端口/pid 实证复查」
