<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/03 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/03-weshop-case-deep-dive.zh.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[spikes/03-weshop-case-deep-dive.zh.md](../../../spikes/03-weshop-case-deep-dive.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 03 的核验记录。修正影响归 `records/topics/spikes.md`。

---

## 核验类

## SP-3 · weshop 案例深度实证

- **类型**：核验
- **派生自**：`records/topics/agent-runtime.md` SP-3
- **状态**：成立
- **关键结论**：weshop overlay 是「自带 React CanvasChat 消费复用 SessionFace」非「镶 dsh Chat」；X 路线工作量上修为 ≈37-38 人日（vs Y 25），差距从 30% 拉到 50%
- **影响**：触发 spike 01 v2 修正 + 催生 spike 04（X 路线专项设计）

---

## 修正-N · spikes/03-weshop-case-deep-dive.zh.md 头部路径描述修正（D17 owner 反馈）

- **类型**：修正（按对象：spikes/03-weshop-case-deep-dive.zh.md）
- **时间**：2026-08-21
- **依据**：D17 owner 反馈（禁止本机绝对路径入库）
- **原内容**：`open-pencil/` = `D:\Desktop\AgentLearn\00_DIYProjects\0720openpencil\open-pencil`（v3 fork 当前分支）
- **新内容**：`open-pencil/` = 本仓库 `open-pencil-rebuild` 工作树（v3 fork 当前分支；早期曾在另一 worktree）
- **影响**：删除本机绝对路径，避免上传 GitHub 后干扰其他用户
