<!--
  写作纪律（改本文前必读）：
  - 本文是 spikes/02 的对应 records（一一对应，不一致 → check-bindings 红）
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - append-only：发现错误追加「修正-N」/「ROT-N」，不删旧记录
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/narrative/spikes/02-pi-sdk-runtime.zh.md

> **状态**：已建立 | **时间**：2026-08-20 19:30 | **核验人**：主 agent
> **物理绑定**：[spikes/02-pi-sdk-runtime.zh.md](../../../spikes/02-pi-sdk-runtime.zh.md)（一一对应）
> **身份**：本档案持有针对 spike 02 的核验记录。runtime 选型决策归 `records/topics/agent-runtime.md`。

---

## 核验类

## SP-2 · pi sdk 作为 runtime 可行性

- **类型**：核验
- **派生自**：`records/topics/agent-runtime.md` SP-2
- **状态**：成立
- **关键结论**：**推荐 pi 直接驱动（库形态）**，F0+层 1 ≈ 20 人日；Q0-Q3 全部有源码级正面答案；resume 是一行 API 无 fork；流式 RPC event 流字段同构；session JSONL 树形天然支持 in-place branch

---

## 修正-N · D2 drift 全面修正（通道 B 为 owner 拍板默认）

- **类型**：修正（按对象：spikes/02-pi-sdk-runtime.zh.md）
- **时间**：2026-08-21
- **依据**：同 spikes/01 修正——owner 质疑 T11-plan DeepSeek 降级项后溯源发现：本文多段落按「通道 A 单通道即可、B 倾向砍」撰写，与已拍板 D2（B 默认，[brand-config.md D2/D2a](../../topics/brand-config.md)）冲突
- **内容**（逐段重写，机制事实全部保留，仅修决策框架）：
  1. 头部状态行加修正注记
  2. §0 建议 (b)：spike 确认目标从「多模态在 DeepSeek 的真实接受度」改为「通道 B pi 侧暴露面（text-only tool-result）」，通道 A 降为时间盒备选探测
  3. P3.2 结尾选项枚举 → D2 口径（B 默认、A 备选，占位降级仅 A+非视觉模型时发生）
  4. P3.3 Q1 答案：C4a 主线 = 通道 B 无降级问题；实测项 (b) 降为 A 探测
  5. R-pi-3：风险概率 中→低，限定为备选通道 A 风险
  6. §6 S-pi-2：重写为「通道 B pi 侧（主线，并入 S-pi-1 同构验证）+ 通道 A 时间盒备选探测」，1-1.5d → 0.5d；总预算段 4-5d → 3.5-4.5d，「最大风险点 S-pi-2」论断撤销
  7. §9 前置依赖 D2：建议作废，改为已拍板口径
- **影响**：[T11-plan.md](../../../tasks/T11-plan.md) 的 S-pi-2 行随之过期，将在 T11 开工前按本文新口径重写（owner 指示先完成终态架构推演）
