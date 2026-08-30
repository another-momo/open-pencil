<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/06 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/06-p3-mode-arch-spikes.zh.md

> **状态**：已建立 | **时间**：2026-08-30 22:00 | **核验人**：主 agent
> **物理绑定**：[spikes/06-p3-mode-arch-spikes.zh.md](../../../spikes/06-p3-mode-arch-spikes.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 06（Phase 3 前置探针批 SP-a/SP-b/SP-c/SP-d）的核验记录。横向聚合登记归 `records/topics/spikes.md` 核验-2。

---

## 核验类

## SP-a1 · generateImages 接口形状钉扎

- **类型**：核验
- **状态**：成立
- **核验命令**：`bun workbench/probe-sp-a1-images-contract.mjs`（2026-08-30，14/14 断言绿；worktree `open-pencil-mode`，分支 `rebuild/mode-arch`）
- **关键结论**：pi-ai v0.84.2 `generateImages`（`./api/openrouter-images`）走 OpenAI 兼容 **chat.completions**；`modalities` 随 `model.output`；响应仅解析 `data:` URL（http 跳过）；无 apiKey 不发请求直接 `stopReason:'error'`；`options.timeoutMs`/`options.fetch` 双注入点存在

## SP-b · 桥层 RPC 超时定谳

- **类型**：核验
- **状态**：成立
- **核验命令**：`bun workbench/probe-sp-b-rpc-timeout.mjs all`（2026-08-30 复核：default → 502 `RPC timeout (20s)` @20010ms；override(60000) → 200 ok @25010ms，mock app 延迟 25s）
- **静态证据**：`packages/mcp/src/browser-rpc.ts:11`（模块加载期常量 `RPC_TIMEOUT`）+ `:180-183`（超时 reject）；pi-coding-agent `agent-session*.js` 无任何定时器（grep 零命中，2026-08-30）；`src/app/ai/pi-backend/tools.ts:82` 裸 fetch 无客户端超时
- **关键结论**：唯一 20s 硬上限在桥且 env `OPENPENCIL_RPC_TIMEOUT_MS` 可放宽（必须 import 前落入进程环境）；Phase 3 dev 链必须配 ≥240s+余量

## SP-c · CanvasKit 避头尾能力

- **类型**：核验
- **状态**：成立
- **核验命令**：`bun workbench/probe-sp-c-kinsoku.mjs`（2026-08-30 复核：3 夹具 × 33 宽度 × 2 locale 违规 0；危险区相邻断点 20 处；4.5em 危险宽度切片 `「中中中」/「中。中中」` 实证断点前移）
- **关键结论**：canvaskit-wasm 0.41.1 ICU 断行器自动执行中文避头尾，与 locale 无关；长图 workflow 不写避头尾软约束条款

## SP-a2 / SP-d 处置登记

- **SP-a2**（真图出图质量）：⛔ 阻塞——本机无 OpenRouter 凭证（`~/.openpencil/` 仅 brand.db，无 pi-agent/auth.json，无相关 env，2026-08-30 核查）；待 owner 提供 key 补测，不阻塞 W1-W3
- **SP-d**（KV paper dry-run）：⏸️ 递延至 KV mode 立项（PD-16：mode 可用性 = workflow 文件存在，KV mode 尚无消费方）
