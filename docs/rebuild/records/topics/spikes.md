<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/spikes.md · spike 文档

> **状态**：已建立 | **时间**：2026-08-30 22:00 | **核验人**：主 agent
> **身份**：spike 文档的核验与修正记录。spike 全文本身归 `docs/rebuild/spikes/<name>.zh.md`，本文档只登记核验结论与修正条目。runtime 选型相关的决策归 `records/topics/agent-runtime.md`。

---

## 修正类

## 修正-1 · spikes/01-dsh-integration-routes.zh.md v2 修正（X 路线工作量上修）

- **类型**：修正
- **时间**：2026-08-20 17:20
- **依据**：SP-3 weshop 案例实证
- **被修正文档**：`docs/rebuild/spikes/01-dsh-integration-routes.zh.md` v2
- **内容**：X2 改「自写 ChatPanel」；Z1/F0.4 同步；工作量表 F0 +4 / C5a +0.5；总工作量 ≈33 → ≈37-38 人日
- **影响**：[01-target-state.md §2 F0.4](01-target-state.md)、[03-phase-1-runtime.md](03-phase-1-runtime.md) v3 同步体现

---

## 核验类

> 详见 `records/topics/agent-runtime.md` SP-1/SP-2/SP-3/SP-4 条目。

## 核验-2 · spikes/06-p3-mode-arch-spikes.zh.md（Phase 3 前置探针批）

- **类型**：核验
- **时间**：2026-08-30
- **执行分支**：`rebuild/mode-arch`（worktree `open-pencil-mode`）
- **核验命令**（本 worktree 当日复核绿）：
  - `bun workbench/probe-sp-a1-images-contract.mjs`（14/14 断言）
  - `bun workbench/probe-sp-b-rpc-timeout.mjs all`（default 502@20s 掐断 / override 200@25s 放宽，双模式实证）
  - `bun workbench/probe-sp-c-kinsoku.mjs`（33 宽度 × 2 locale × 3 夹具 0 违规，危险区相邻断点 20 处）
- **结论**：
  - SP-a1 成立——pi-ai `generateImages` 走 chat.completions，接口形状钉死，可封装；SP-a2（真图质量）阻塞待 owner 提供 OpenRouter key，不挡 W1-W3
  - SP-b 定谳——唯一 20s 硬上限在桥 `packages/mcp/src/browser-rpc.ts:11`，env `OPENPENCIL_RPC_TIMEOUT_MS` 可放宽（模块加载期常量）；Phase 3 dev 链必须配 ≥240s+余量
  - SP-c 成立——canvaskit-wasm 0.41.1 ICU 断行自动避头尾，长图 workflow 不写软约束兜底
  - SP-d 递延至 KV mode 立项
- **影响**：探针批整体通过，Phase 3（T43+ / T-A 批起）解锁，进入 W1 正式推进

## spike 文档清单与状态

| spike | 状态 | 决策影响 |
|---|---|---|
| `01-dsh-integration-routes.zh.md` | 已被修正-1 修正（v3 后不再直接引用，结论已被 02-04 取代） | — |
| `02-pi-sdk-runtime.zh.md` | 成立（716 行） | 推荐 pi 直接驱动 |
| `03-weshop-case-deep-dive.zh.md` | 成立（474 行） | 修正 spikes/01-dsh-integration-routes.zh.md X 路线偏差 |
| `04-dsh-x-design.zh.md` v4 | 成立（314 行） | X 路线专项设计（备选推荐） |
| `06-p3-mode-arch-spikes.zh.md` | SP-a1/SP-b/SP-c 成立（2026-08-30 核验-2）；SP-a2 阻塞待 key；SP-d 递延 | Phase 3（T43+）解锁：生图接口契约、桥 env ≥240s、长图免避头尾软约束 |