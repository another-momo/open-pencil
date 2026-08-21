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
