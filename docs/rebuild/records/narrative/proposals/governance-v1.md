<!--
  写作纪律（改本文前必读）：
  - 本文是 proposals/governance-v1.md 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/proposals/governance-v1.md

> **状态**：已建立 | **时间**：2026-08-21 | **核验人**：主 agent
> **物理绑定**：[proposals/governance-v1.md](../../proposals/governance-v1.md)（一一对应）
> **身份**：本档案持有针对 proposals/governance-v1.md 的迁移记录。proposals 文档是 append-only 的外部建议，本身不腐烂——只有内化/采纳动作记录。

---

## 决策类

## 迁移-N · 外部 proposal 内化到仓库内（2026-08-21）

- **类型**：迁移
- **时间**：2026-08-21
- **触发**：T05 owner 提问"外部建议文档的真实地址不在仓库内……现在应该怎么处理？内化到仓库内并放到合适的目录下？"
- **处置**：
  - 源路径：仓库根外 `docs/rebuild-docs-governance-proposal.md`（17257 字节；T05 之前位于工作区根 `docs/` 子目录而非本仓库内）
  - 目标路径：`docs/rebuild/proposals/governance-v1.md`（仓库内）
  - 内容完整复制 + 加头部元信息（纪律提示块 + 状态/时间/作者/来源/身份/采纳映射）
- **采纳映射**：proposal 中所有决策点已在仓库内落地为 D10 / D11 / D12 / D13 / D14 / D15 决策登记
- **后续**：所有引用路径从 `docs/rebuild-docs-governance-proposal.md` 改为 `docs/rebuild/proposals/governance-v1.md`（T01-plan.md ×2 + docs-governance.md ×2）
- **影响**：proposal 不再依赖仓库根外路径；版本控制覆盖；采纳决策点可追溯

---

## 修正类

（暂无）

---

## 核验类

## T05 自检确认（2026-08-21）

- **类型**：核验
- **核验人**：主 agent + subagent A（独立核验）
- **范围**：[proposals/governance-v1.md](../../proposals/governance-v1.md) 完整复制 + 头部元信息 + 引用路径替换
- **结论**：通过。详见 [tasks/T05-verify.md §2 逐条核验](../../../tasks/T05-verify.md)
