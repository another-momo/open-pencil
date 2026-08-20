<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# 01 · 目标态定义

> **状态**：已核验 | **时间**：2026-08-20 16:00（R1-R4 后 2026-08-18 14:00 + D2/D9 增补）| **核验人**：subagent A-D + 主 agent + owner 拍板 D2
> **身份**：**本文是「做哪些加法」的决策依据**；02-phase-0.md 是 Phase 0 执行依据；03-phase-1-runtime.md 与 spikes/*.md 是 case study 与技术调研，身份是辅助参考信息，不直接驱动 Phase gate。
> **结构原则**：按依赖排序，不按价值排序。没有支撑底座，闭环跑不起来——这是首轮 review 的核心修正。

## 1. 一句话定义

**一个 localhost 形态的营销设计 AI 工作台**：用户在上游编辑器画布上，用「需求单 + 品牌配置（type/profile）」驱动 AI 完成营销物料设计；agent runtime 建在 pi sdk / dsh 上、可再替换；编辑器内核永久跟随上游。

架构前提（已实测）：工具定义在 core、经 WebSocket 在编辑器内执行，agent 后端不碰 SceneGraph；对 AI SDK 的耦合仅两个 import（`tool`、`valibotSchema`）外加 core 的 `ai-adapter.ts`（移植时剥离）。

## 2. 层 0：支撑底座 F0（地基切片）

**没有 F0，任何闭环都跑不起来。** F0 的目标：一次工具调用端到端可见——用户在 chat 输入一句话，runtime 驱动一个工具在编辑器里执行，画布变化可见，session 可恢复。

| 块 | 内容 | 地面依据（实测） | 处置 |
|---|---|---|---|
| F0.1 runtime 内核薄切 | session 持久化 + 流式输出 + extension 注入钩子 | 当前会话持久化为零（前端 `Chat` 纯内存，后端每请求新建 agent）——**从零新建** | 重建（Phase 1） |
| F0.2 工具执行桥 | WS RPC 双向。**三进程**：vite dev server + agent 后端 + MCP 桥服务器（port 7600，discovery 文件 + token 注册/中继）；dev 下由两个 vite 插件分别拉起 | `src/app/automation/bridge/`（11 文件）、`packages/mcp/`、`agent-vite-plugin.ts` | 移植 + 复审 |
| F0.3 凭证双链 | ①聊天 key 下发（`/v1/auth` provision，1h TTL）②**生图独立凭证**（key/baseURL/model 三键 + `setImageGenCredentials` 进程级注入 + 设置 UI）——无第二链 generate_image 必断（无 provider 注册，工具直接返回 error） | `agent-transport.ts:194-208`、`marketing/settings.ts:29,107-114`、`image-gen/providers.ts:83-99`、`ImageGenKeysSection.vue` | 移植并统一 |
| F0.4 传输契约 + 最简 chat UI | 新 session 模型下的发送/渲染。**传输契约（runtime ↔ 后端 ↔ 前端）**与 **chat UI 组件**是两个独立块，分清楚：契约选型见 [§2-D9 runtime 选型](#27-dsh-集成形态); UI 不论走哪条路线都需要重做或自实现——Y/pi 路线下 Vue 自写，X 路线下 React 自写消费 dsh `SessionFace`。现状：全量 messages POST `/v1/chat`，UIMessage stream v1 SSE，自写 `parseUIMessageStream`。换 runtime 后契约重写 | `http-agent-transport.ts`、`ChatInput/ChatMessage.vue`、`src/components/ChatPanel.vue`（**在 components 根目录，不在 chat/**） | 重建 |
| F0.5 session↔文件绑定 | pluginData 读写 sessionId（编辑器 app 层 owned 代码） | 参照 `restore.ts` 的 pluginData 机制 | 新建 |
| F0.6 prompt 注入点 | runtime extension 钩子；两段式 prompt（base + marketing）+ overlay 的装配点 | `generated/prompts.ts:769` 组装注释、`brand-overlay.ts` | 重建 |
| F0.7 prompts 构建链 | agent 依赖 `prompts/generated/` 预构建，**缺失即启动即崩**——脆依赖 | `scripts/inline-prompts.ts` | 消除（构建进 CI 或运行时直读 md） |

**F0 验收（"hello-tool"）**：一句话 → AI 建一个 frame → 回复可见 → 重开文件 session 恢复。

## 3. 层 1：价值闭环薄切（全部骑在 F0 上）

最小价值闭环：**需求单 → 选 type/profile → generate_image → look → 迭代**。每一环的支撑依赖：

| 环节 | 能力块 | 内容（薄切范围） | 依赖的底座 |
|---|---|---|---|
| 需求单 | C1a | brief 创建/绑定 + 结论区（BriefPanelDialog 最薄可用） | F0.2 桥（core brief 原语经桥执行） |
| 选 type/profile | C2a | brand 服务（`/v1/brand/manifest` + config.yaml seed + SQLite 覆盖层）+ overlay 注入 + MarketingConfigBar 类型选择。**agent 不可达时退化为仅 custom type——闭环在此可断，属验收必测路径** | F0.1 + F0.6 |
| 生成 | C3a | setup_material_type、generate_image（**生图历史快照是内置行为，随移植自带**）、compose_backdrop | F0.2 + F0.3② |
| 看 | C4a | look 图片到达模型：对新 runtime 媒体模型实现（旧语义只取一份：elision K=2 + chat-completions 改写，双份镜像取一） | F0.1 + F0.2 |
| 迭代 | C5a | MarketingConfigBar 集成进最简 chat UI | F0.4 |

**层 1 验收**：闭环端到端真实跑通 + 16 个移植测试文件全绿 + CI 绿。

## 4. 层 2：增强（每块独立、自带验收、可单独进）

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

## 5. 不加清单（和加法同等重要）

- **.fig 素材库机制**——已死透（`library.ts` 实测为 brand 服务 shim）。别让旧文档复活它。
- **「素材图理解（hash 缓存描述）」**——全仓无代码（phantom，与 .fig 库同代残留描述）。如确需此能力，按新建立项并记决策。
- **AI SDK agent loop + 前端全量重发历史**——被 F0.1/F0.4 取代；`packages/agent` 其余 42 文件整体不移植（含 `prompts/generated/` 生成物）。
- **视觉回路双份镜像**——语义只移植一份，新 runtime 上只实现一次。
- **validate readonly baseline**——已废弃语义。
- `src/components/L3/`——实测不存在；ACP / collab / desktop / demos / docs 站——删除区。

## 6. 待拍板决策（拍板前对应块不动工；集中登记于 [tracker.md §1 阶段门](tracker.md)）

| # | 决策 | 影响 |
|---|---|---|
| D1 | 参考图机制形态（参考区 page / 收编 brand config） | C2/C3 边界 |
| D2 | **vision 通道 B 为默认**（look 截图不进主 agent 上下文→成本优势 + 可换视觉模型；A 直送为备选，仅在 B 失败或 vision 模型质量不达标时降级） | C4 + F0.3 |
| D3 | session 模型（一文件一个 / 多个） | F0.5 + C5b |
| D4 | 产品形态（localhost serve 是否定论） | B4 + cli 处置 |
| D5 | chatMode 双模式去留 | C5 与 prompt 装配范围 |
| D6 | 中文字体策略（62MB 全量 / 子集化 / 系统字体） | E1 |
| D7 | runtime 选型（pi sdk / dsh） | Phase 1 spike 后定，见 03；spike 02 推荐 pi 直接驱动 |
| D8 | 「素材图理解」是否新建立项 | C1 增强范围 |

## 7. parity 线（新旧分支切换标准）

**层 0 + 层 1 验收通过**（hello-tool + 最小闭环端到端 + 16 个测试文件绿 + CI 绿），owner 拍板切换。
不是「旧功能全搬完」——层 2 搬不完的让它们在旧分支自然死亡。

## 8. 三路线对比补充（为什么「复用 dsh 基建更多」的 X 反而更贵）

X 路线**复用**的 dsh 基建：
- SessionFace（5 个方法，subscribe/getSnapshot/prompt/cancel/wait.respond）
- Session/skills/tool approval/preset 等
- Cordis 插件 + Slot UI 体系

X 路线**为此付出的代价**（这些代价就是它比 Y/pi 贵的来源）：
1. **跨框架 SessionFace 桥**：dsh 浏览器端是 React + Cordis，`SessionFace` 类型 `ISession & ObservableSnapshot<ConversationSnapshot>`（`packages/client/runtime/src/client/contract/session.ts:89`）只在 dsh 客户端进程存在；我们的 Vue 编辑器要从 React/Cordis 拿 SessionFace 必须自己写暴露层（React wrapper 或 JSON-RPC 桥）。
2. **react-vs-vue 双框架运行时**：编辑器是 Vue、ChatPanel 必须是 React（消费 SessionFace）、Slot 注册需要 React 应用。这不止是包装成本——焦点/快捷键/事件/CSS 隔离全套都要做两套。
3. **跨 session 营销配置同步的 hard 约束**：dsh 跨进程通信事件白名单仅 11 个（`remote-events.ts:28`），marketing 状态桥不能自由订阅 cordis 事件——这是 weshop 没遇到、open-pencil 必须解决的工程问题。
4. **dsh developer preview 颠簸**：版本和 Slot API、cordis.patch.yml 格式都可能变；你的发布节奏与 dsh 升级强耦合。
5. **编辑器孤岛化**：Vue 编辑器作为 dsh 插件时要么走策略 B（SplitPanel 接管 conversation 列）或策略 C（overlay portal + 自管 z-index=1M+ 越界绕过 retro-OS skin）。两个都是 1-2d 的额外工作。

Y / pi 路线**全部**不需要 SessionFace 桥、跨框架运行时、白名单约束——**这就是为什么「复用得多」不一定更便宜**：复用的 dsh 能力（chat UI + session）恰恰是我们必须自己重写的（X 里因为 dsh Chat 在 conversation 列被 SplitPanel 占据，必须自写 ChatPanel）；复用的「同质能力」（SessionFace 那 5 个）被 React/Cordis 锁死，必须有 bridge 才能用。综合下来 X 比 Y 多 12-13 人日、比 pi 多 17-18 人日。
