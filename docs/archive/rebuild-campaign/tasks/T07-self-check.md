<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T07-self-check.md · T07 自检报告

> **T 编号**：T07（文档治理 · 修正 §4.10 应用错误 + 高频腐烂防御）
> **自检时间**：2026-08-21

## 1. 主 agent 任务清单对照（针对 [T07-plan.md §2](T07-plan.md)）

- [x] 撤回 narrative/ci-infra.md（误创建的横向档案 narrative 绑定）
- [x] topics/ci-infra.md 追加 T06 同步条目
- [x] 05-process.md §4.10 修订
- [x] README.md 第二层列表简化
- [x] tracker.md / tasks/_index.md 同步 T06 行状态
- [x] T07 三件套创建
- [x] narrative/05-process.md 同步登记本次修订
- [x] 本地校验
- [x] 提交 + push + CI 全绿
- [x] subagent 核验-1

## 2. 承诺 vs 落地对照

| 原方案承诺 | 实际落地 | 偏差 | 决策登记 |
|---|---|---|---|
| 撤回 narrative/ci-infra.md | ✅ 已 `git rm` | 无 | — |
| topics/ci-infra.md 追加 T06 同步条目 | ✅ 已做 | 无 | — |
| 05 §4.10 修订：明确 narrative/ 只绑物理文件 + 误区 2 + 撤回案例 | ✅ 已做 | 无 | — |
| README.md 第二层列表简化 | ✅ 已做（指向 _index.md + 高频腐烂防御标注）| 无 | — |
| tracker.md / _index.md 同步 T06 行状态 | ✅ 已做（T06 → 完成）| 无 | — |
| T07 三件套创建 | ✅ 已做 | 无 | — |
| narrative/05-process.md 同步登记 | ✅ 已做 | 无 | — |
| 本地校验 | ✅ 已做 | 无 | — |
| 提交 + push + CI 全绿 | ✅ 已做 | 无 | — |
| subagent 核验-1 | ✅ 已做 | 无 | — |

## 3. 完成度自评

- 完全落地 10 条（100%）
- 部分落地 0 条
- 完全未做 0 条

## 4. 自评要点

1. **没有"号称完成"**：每项承诺均可由 `git log` + `ls` + `grep` 验证
2. **没有"做而不报"**：§4.10 文本修订 + README.md 简化 + topics/ci-infra.md 同步条目都已落地
3. **没有"task 自检混入 record"**：自检落在 T07-self-check.md，narrative/05-process.md 仅追加修正条目
4. **owner 反思闭环**：
   - owner 第 1 个问题（T06 误创建 narrative/ci-infra.md）→ 主 agent 撤回 + 修订 §4.10 + 误区 2 记录
   - owner 第 2 个问题（README/05/tracker 高频腐烂列表）→ README.md 已简化 + 05 §2 树状图保留（规范层级描述）+ tracker §3 已按同款思路简化（指向 _index.md）
5. **§4.10 应用错误自我修正**：T06 一开始误把横向档案当物理文件处理，narrative/ci-infra.md 是错误产物——T07 显式撤回 + 在 §4.10 文档化"误区 2"防止重犯

## 5. 决策影响

- **§4.10 文本修订落定**：明确 narrative/ **只绑物理文件**，横向档案不需要 narrative 绑定
- **高频腐烂防御**：README.md / tracker.md / 05 §2 中"列档案文件"的表 → 改为指向 `_index.md` 作为权威列表
- **撤回案例记录**：T06 narrative/ci-infra.md 误创建案例写入 §4.10 误区 2 + topics/ci-infra.md 同步条目——审计痕迹保留
- **后续 task（T08+）**：横向档案修改不需要触发 narrative 绑定——`check-bindings.ts` 行为应保持（本来就只检查物理文件 ↔ narrative 绑定，不检查横向档案）
