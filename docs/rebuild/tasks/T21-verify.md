<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T21-verify.md · T21 独立核验记录

> **T 编号**：T21（Phase 1-pi 实施 · pi 原生 provider/凭据管理 + 全量 core tools + system prompt + 环绕补齐）
> **状态**：⬜ 未到核验阶段（收口时由 subagent 独立核验后就地重写本文）

## 核验项（预审自 [T21-plan.md §2](T21-plan.md) 验收清单派生）

| #   | 核验项                                                                           | 结果 | 证据 |
| --- | -------------------------------------------------------------------------------- | ---- | ---- |
| V1  | A1 后端 pi 原生 model/auth 落地（catalog/credential/provider 端点，无 read-key） | ⬜   | —    |
| V2  | A2 设置 UI 改向（UI 存 key → auth.json → 聊天可用，全程无 env key）              | ⬜   | —    |
| V3  | A3 全量 24 core tools + system prompt 接入（多工具协作冒烟）                     | ⬜   | —    |
| V4  | A4 环绕补齐（桥 undo 条目 + 后端 step budget `_warning`）                        | ⬜   | —    |
| V5  | A5 chat 面零改动 + T19/T20 回归                                                  | ⬜   | —    |
| V6  | A6 key 卫生 + 无占位 + CI 绿                                                     | ⬜   | —    |
| V7  | A7 文档纪律（三件套齐、tracker/\_index 登记、事实可复验）                        | ⬜   | —    |
