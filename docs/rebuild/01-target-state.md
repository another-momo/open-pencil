<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 01 · 目标态定义

> **状态**：已核验 | **时间**：2026-08-25 | **核验人**：主 agent
> **身份**：**本文是「做哪些加法」与「按什么顺序推进」的决策依据**——目标态分层（§3-§6）+ 推进规划（§2）。02-phase-0.md / 03-phase-1-runtime.md 是 Phase 0/1 的执行与验收记录；spikes/*.md 是调研证据层，不直接驱动 Phase gate。
> **结构原则**：按依赖排序，不按价值排序。没有支撑底座，闭环跑不起来。

## 1. 一句话定义

**一个 localhost 形态的营销设计 AI 工作台**：用户在上游编辑器画布上，用「需求单 + 品牌配置（type/profile）」驱动 AI 完成营销物料设计；agent runtime 建在 pi sdk / dsh 上、可再替换；编辑器内核永久跟随上游。**编辑器完整前端能力（画布 + 面板 chrome）在孤岛内全量保留**（D23，2026-08-23 owner 拍板，登记见 [records/topics/agent-runtime.md](records/topics/agent-runtime.md)）。

架构前提（已实测）：工具定义在 core、经 WebSocket 在编辑器内执行，agent 后端不碰 SceneGraph；对 AI SDK 的耦合仅两个 import（`tool`、`valibotSchema`）外加 core 的 `ai-adapter.ts`（移植时剥离）。

## 2. 推进规划（Phase 划分）

**层是图纸——产品由哪几层构成、谁依赖谁（§3-§5）；Phase 是施工顺序——先建哪层后建哪层。** Phase 0/1 是开工前准备（治理机制建设、runtime 选型），不产产品功能，故无对应层；Phase 2 起与层一一对应（施工顺序 = 图纸依赖顺序）。**验收 by phase**：每个 Phase 的验收口径主场在下表指针处；各 Phase 的当前进度与签字状态见 [tracker.md §1 阶段门](tracker.md)。

| Phase | 干什么 | 对应层 | 验收口径（主场） |
|---|---|---|---|
| Phase 0 机制+减法 | 治理机制建设（zones/CI/三件套）+ 旧面删除 | — | [02-phase-0.md §5](02-phase-0.md) 七条验收 |
| Phase 1 runtime spike | runtime 选型：Q0-Q3 有代码答案 + 拍板（D24 拍 pi，2026-08-23） | — | [03-phase-1-runtime.md](03-phase-1-runtime.md) Q0-Q3 + 选型决策 |
| Phase 2 地基切片 | F0.1-F0.6 建成 | 层 0（本文 §3） | 本文 §3 hello-tool 验收 + F0 各块处置列全「已建成」 |
| Phase 3 最小价值闭环 | C1a-C5a 五环建成 | 层 1（本文 §4） | 本文 §4 层 1 验收 |
| Phase 4 增强补齐 | 层 2 各块逐块进 | 层 2（本文 §5） | 逐块自带验收，无整段出口 |
| parity 切换 | 新旧分支切换 | — | 本文 §8 parity 线，owner 拍板 |

## 3. 层 0：支撑底座 F0（地基切片）

**没有 F0，任何闭环都跑不起来。** F0 的目标：一次工具调用端到端可见——用户在 chat 输入一句话，runtime 驱动一个工具在编辑器里执行，画布变化可见，session 可恢复。**F0 是纯聊天地基**——生图独立凭证链不在此层（与其唯一消费者 generate_image 同入层 1 C3a，D32，2026-08-25 owner 拍板）。

| 块 | 内容 | 地面依据（实测） | 处置 |
|---|---|---|---|
| F0.1 runtime 内核薄切 | session 持久化 + 流式输出 + extension 注入钩子 | 当前会话持久化为零（前端 `Chat` 纯内存，后端每请求新建 agent）——**从零新建** | **已建成（T19，2026-08-24）**：pi SDK 薄 service + session JSONL 持久化 + UIMessage v1 SSE 流式——见 [tasks/T19-plan.md](tasks/T19-plan.md) |
| F0.2 工具执行桥 | WS RPC 双向。**三进程**：vite dev server + agent 后端 + MCP 桥服务器（port 7600，discovery 文件 + token 注册/中继）；dev 下由两个 vite 插件分别拉起 | post-merge 实况（2026-08-23 核验）：`src/app/automation/bridge/` 在仓（`ls` 实测 11 项）、`packages/mcp/` 在仓；`agent-vite-plugin.ts` 已随 T10 上游合并消失（`find src` 零命中）——dev 拉起面需按新基线重查 | **已建成（T20，2026-08-24）**：后端独立进程化 + hello-tool 全链（defineTool → 7600 /rpc → 活编辑器建 frame）——见 [tasks/T20-plan.md](tasks/T20-plan.md) |
| F0.3 聊天凭证链 | 聊天 key 下发（旧方案为 `/v1/auth` provision，1h TTL） | post-merge 实况（2026-08-23 核验）：原引证**全部消失**（`find/grep` 零命中：agent-transport.ts、/v1/auth）——营销 agent 后端已随 T10 上游合并整体移除 | **已建成（T21，2026-08-24）**：pi 原生 provider/凭据管理（ModelRuntime + auth.json + 设置 UI 改向）——见 [tasks/T21-plan.md](tasks/T21-plan.md)。生图独立凭证链原列本块 ②，已随 D32（2026-08-25 owner 拍板）移入层 1 C3a——凭证与其唯一消费者 generate_image 同阶段开发 |
| F0.4 传输契约 + 最简 chat UI | 新 session 模型下的发送/渲染。**传输契约（runtime ↔ 后端 ↔ 前端）**与 **chat UI 组件**是两个独立块，分清楚：契约选型已由 D24 拍板 pi SDK 库形态（见 [03-phase-1-runtime.md §5 选型决策](03-phase-1-runtime.md)）；UI 按 pi 路线 Vue 自写。换 runtime 后契约重写 | post-merge 实况（2026-08-23 核验）：`http-agent-transport.ts` 已消失（`find src` 零命中）；现存为 `src/app/ai/chat/transports.ts` 双路径——浏览器内 AI SDK ToolLoopAgent（`createToolLoopTransport`）+ harness sidecar（`harness:pi`，`storage.ts:39`；D21 搁置不占 runtime 路径）；`ChatInput/ChatMessage.vue` 在 `src/components/chat/`（`ls` 实证），`ChatPanel.vue` 在 components 根目录 | **已建成（T19，2026-08-24）**：UIMessage v1 SSE 契约 + 前端 Chat 类零改动（文本回路）；T25（2026-08-24）清扫后收敛为 pi 单路径——见 [tasks/T19-plan.md](tasks/T19-plan.md) / [tasks/T25-plan.md](tasks/T25-plan.md) |
| F0.5 session↔文件绑定 | pluginData 读写 sessionId（编辑器 app 层 owned 代码） | 参照 `restore.ts` 的 pluginData 机制 | **已建成（T22/T23，2026-08-24）**：pluginData docUuid 身份 + 三段式 sessionId + 历史回填 + 会话查看/切换 UI——见 [tasks/T22-plan.md](tasks/T22-plan.md) / [tasks/T23-plan.md](tasks/T23-plan.md) |
| F0.6 prompt 注入点 | runtime extension 钩子；两段式 prompt（base + marketing）+ overlay 的装配点 | `generated/prompts.ts:769` 组装注释、`brand-overlay.ts` | **已建成（T24，2026-08-24）**：四层抽象（AgentMode → per-run 工作流段 → per-run profile overlay）+ chatMode 请求级——见 [tasks/T24-plan.md](tasks/T24-plan.md) |
| F0.7 prompts 构建链 | agent 依赖 `prompts/generated/` 预构建，**缺失即启动即崩**——脆依赖 | post-merge 实况（2026-08-23 核验）：`scripts/inline-prompts.ts` 与 `packages/agent`（prompts/generated 宿主）均已随 T10 消失（`find` 零命中）；现存系统提示为 `src/app/ai/chat/system-prompt.md` 运行时 `?raw` 直读（`transports.ts` import 实证）——**脆依赖实体已不在仓，消除目标上游已完成** | 已消除（T10 上游合并顺带完成） |

**F0 验收（"hello-tool"）**：一句话 → AI 建一个 frame → 回复可见 → 重开文件 session 恢复。

## 4. 层 1：价值闭环薄切（全部骑在 F0 上）

最小价值闭环：**需求单 → 选 type/profile → generate_image → look → 迭代**。每一环的支撑依赖：

| 环节 | 能力块 | 内容（薄切范围） | 依赖的底座 |
|---|---|---|---|
| 需求单 | C1a | brief 创建/绑定 + 结论区（BriefPanelDialog 最薄可用） | F0.2 桥（core brief 原语经桥执行） |
| 选 type/profile | C2a | brand 服务（`/v1/brand/manifest` + config.yaml seed + SQLite 覆盖层）+ overlay 注入 + MarketingConfigBar 类型选择。**agent 不可达时退化为仅 custom type——闭环在此可断，属验收必测路径** | F0.1 + F0.6 |
| 生成 | C3a | setup_material_type、generate_image（**生图历史快照是内置行为，随移植自带**）、compose_backdrop + **生图独立凭证链**（key/baseURL/model 三键 + 进程级注入 + 设置 UI；凭证与工具同阶段开发，D32） | F0.2 桥 |
| 看 | C4a | look 图片到达模型：对新 runtime 媒体模型实现（旧语义只取一份：elision K=2 + chat-completions 改写，双份镜像取一） | F0.1 + F0.2 |
| 迭代 | C5a | MarketingConfigBar 集成进最简 chat UI | F0.4 |

**层 1 验收**（2026-08-25 owner 拍板口径，决策批 #13，登记见 [records/topics/docs-governance.md](records/topics/docs-governance.md)）：C1a-C5a 五环各配一条端到端冒烟且全绿 + `smoke:pi` 批次全绿 + CI 绿。`smoke:pi` 批次现状 = 五套件 80 断言（`grep '"smoke:pi"' package.json`，2026-08-25）；五环冒烟随各环施工逐条补入，未齐前本验收不通过。（原「16 个移植测试文件全绿」口径的宿主——packages/agent 与 tests/engine/tools/{marketing,image-gen}——已随 T10 上游合并消失（2026-08-25 实测 `find tests/engine/rebuild -type f` 仅 1 文件），该口径废止。）

## 5. 层 2：增强（每块独立、自带验收、可单独进）

| 块 | 内容 | 备注 |
|---|---|---|
| C1b | BriefPanel 完整编辑体验、结论分组 | — |
| C2b | ProfileGallery、风格锁定（`[风格档案]` 块）、BrandConfigPanel | — |
| C3b | 工具补齐：derive_palette、prepare_hero_scaffold、sample_hero_color、stock_photo、append_brief_conclusion（均已注册于 CORE_TOOLS，实测存在） | 移植 |
| C3c | validate 工具 | **新建，非移植——当前代码库无此工具注册**（实测） |
| C4b | 媒体省略精化；vision 通道 B（独立视觉模型） | 去留见 D2 |
| C5b | session 列表 UI | 依赖 D3 |
| B1b | skills、工具审批（桥协议扩审批往返） | — |
| B4 | `packages/cli` → serve 入口 + 文件 API | 依赖 D4 |
| E1 | 中文字体（普惠体移植/子集化） | 依赖 D6 |
| E2 | debug 面板 | 低优先 |
| F1 | rebrand、zh-cn+en 双语、CI 发版 | 最后 |

## 6. 不加清单（和加法同等重要）

- **.fig 素材库机制**——已死透（`library.ts` 实测为 brand 服务 shim）。别让旧文档复活它。
- **「素材图理解（hash 缓存描述）」**——全仓无代码（phantom，与 .fig 库同代残留描述）。如确需此能力，按新建立项并记决策。
- **AI SDK agent loop + 前端全量重发历史**——被 F0.1/F0.4 取代；`packages/agent` 其余 42 文件整体不移植（含 `prompts/generated/` 生成物）。
- **视觉回路双份镜像**——语义只移植一份，新 runtime 上只实现一次。
- **validate readonly baseline**——已废弃语义。
- `src/components/L3/`——实测不存在；ACP / collab / desktop / demos / docs 站——删除区。

## 7. 待拍板决策（拍板前对应块不动工；登记处 = `records/topics/` 各主题档案，按 D 主题列指针）

| # | 决策 | 影响 | 状态 | 登记档案 |
|---|---|---|---|---|
| D1 | 参考图机制形态（参考区 page / 收编 brand config） | C2/C3 边界 | open | [records/topics/brand-config.md](records/topics/brand-config.md) |
| D2 | **vision 通道 B 为默认**（look 截图不进主 agent 上下文→成本优势 + 可换视觉模型；A 直送为备选，仅在 B 失败或 vision 模型质量不达标时降级） | C4 + F0.3 | **已拍板**（owner，2026-08-20） | [records/topics/brand-config.md](records/topics/brand-config.md) D2 |
| D3 | session 模型（一文件一个 / 多个） | F0.5 + C5b | **已拍板**（owner，2026-08-25：一文件多会话 + 族谱形态；落地 = T22/T23） | [records/topics/agent-runtime.md](records/topics/agent-runtime.md) |
| D4 | 产品形态（localhost serve 是否定论） | B4 + cli 处置 | open | [records/topics/agent-runtime.md](records/topics/agent-runtime.md) |
| D5 | chatMode 双模式去留 | C5 与 prompt 装配范围 | **已拍板**（owner，2026-08-25：双模式保留；落地 = T24 chatMode 请求级） | [records/topics/chat-ui.md](records/topics/chat-ui.md) |
| D6 | 中文字体策略（62MB 全量 / 子集化 / 系统字体） | E1 | open | [records/topics/brand-config.md](records/topics/brand-config.md) |
| D7 | runtime 选型（pi sdk / dsh） | Phase 1 spike 后定，见 03 | **已拍板 = D24**（owner，2026-08-23：pi SDK 升主线，dsh-X 搁置） | [records/topics/agent-runtime.md](records/topics/agent-runtime.md) D22/D24 |
| D8 | 「素材图理解」是否新建立项 | C1 增强范围 | open | [records/topics/chat-ui.md](records/topics/chat-ui.md) D8 条目 |

## 8. parity 线（新旧分支切换标准）

**层 0 + 层 1 验收通过**（hello-tool + 层 1 验收——口径见本文 §4），owner 拍板切换。
不是「旧功能全搬完」——层 2 搬不完的让它们在旧分支自然死亡。
