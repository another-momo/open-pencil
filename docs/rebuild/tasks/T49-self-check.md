<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T49 自检 · base 红线补洞段及机制撤除 + S1 §7 层归属修正

> **状态**：🔄 进行中 | **时间**：2026-08-31 立项 | **负责人**：主 agent（实现段派 subagent 执行，主 agent 复核 diff 后提交）

## 1. 立项段自查（目标面实证，2026-08-31）

1. **补洞段当前形态**：`src/app/ai/pi-backend/studio/base.md` L125-138 为 `<!-- T46 红线补洞段 begin/end -->` 包裹的 Trust & Safety 节（sed -n '120,160p' 实测）；机制配套 = build-t46-base.mjs SECTION 常量 + verify-t46-base-fidelity.mjs BLOCK_RE + studio-builtin-assets.test.ts 两条钉扎（`grep -rln "Trust & Safety\|补洞\|修辞事实标注" src/ tests/ tools/ docs/` 命中清单在案）。
2. **S1 §7 现状**：11 行纪律表中 9 行层归属含 base（doc/S1-product-spec.md L125-142 实读）；§8 不做清单「base 重新设计」行守卫含「红线补洞现在做」；附录索引含「§3/§7 修辞事实标注」行。
3. **S4 牵涉面**：§3 前置工程批补洞行 / §4 T-A5 行 / T-C1·T-C2 修辞事实标注工作项 / §7 双源收编行「补洞段」表述（grep 实测）。
4. **决策记录**：owner 指令原文入 T49-plan 规格真源行；层归属目标形态 = D-d 表（删 3 行 / 5 行改宿主 / #1 保持 base+宿主与 #8 改宿主均标注 base 侧候选随 PD-20 触发式任务评估）。

## 2. 实现段核验

（subagent 执行、主 agent 复核 diff 后填报 C1-C6 实测值）

## 3. 实测修正记录

（实现段发现逐条登记）
