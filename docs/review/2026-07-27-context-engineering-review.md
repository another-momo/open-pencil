# 上下文工程规划评审（2026-07-27）

> 评审对象：`../plans/l2-context-engineering.md`（原 `marketing-context-engineering-plan.md`）。
> 结论：方向整体成立，详细设计有 5 处需修订。**按决定，plan 文档原文不改，实施时以本评审为准合并。**

## 做对的（确认保留）

- 问题诊断准确（prompt 47% 硬编码运行时数据、历史 60K-150K tokens 无裁剪、状态 AI 自述不可验证）
- A0 计量先行——"必须先于一切优化"的纪律正确，且是视觉回路的共同前置
- 摘要从注册表确定性生成而非 AI 总结；`commit_section` 带 canvas 交叉校验
- 静态前缀 / 动态尾部的缓存友好设计
- Checkpoint 重置的窗口化语义方向正确

## 问题 1：双数据源是设计气味（最重要）

注册表（内存）+ Manifest（pluginData）的双真源设计，迫使文档写了 6 行一致性规则表（谁优先、divergence 警告、惰性重建）。一致性规则表的存在本身就是 bug 培养皿的征兆，§10 风险表也不得不为它单列一行。

**修订**：单源化——Manifest（pluginData）为唯一真源，注册表只是其内存索引/缓存。所有读从注册表走（快），所有写先落 pluginData 再失效内存缓存。6 行规则表缩成 1 条："内存是磁盘的缓存"。undo、重开文档、协作场景全部归一到同一条路径。

## 问题 2："代码写入非 AI 自述"名不副实

文档宣称状态"代码写入非 AI 自述"，但 `lock_direction` / `commit_campaign_fact` / `commit_section` 全是 AI 主动声明制——AI 忘记调、调错参数，状态一样失真，只是从"对话里失真"变成"画布里持久化地失真"（后者更难发现）。只有 `commit_section` 有交叉校验。

**修订**：按"能否从画布推导"分两类——

- **可推导的状态不写**：section 完成度可从画布结构推导（frame 存在、非空、无占位符）；实际用色/字体可统计分析 fills/fontName。推导是确定性的，不依赖 AI 自觉。
- **画布上没有的信息才声明**：活动事实（品牌名、价格）需要声明，但这类信息未来主要来自需求单节点（L3 已实现）——可以从需求单读，连声明都省了。
- 附带收益：化解 Checkpoint 重置的隐患（原设计假设"关键决策已落 Manifest"，AI 忘调 commit 则重置即丢上下文；推导制没有这个前提）。

## 问题 3：窗口化裁剪对象没排除用户消息

Layer 3 裁剪"assistant + tool 消息链"，但用户消息的去留没说清。用户消息便宜且常含硬约束（"不要用红色"、"价格不能改"）。

**修订**：用户消息永不裁剪，只裁工具链。一行规则，写进 Layer 3 设计。

## 问题 4：两个已知未来没有预留接缝

- **media 消息**：视觉回路接入后 tool result 含 image part，窗口化的 elision 语义（替换为文字占位，而非丢整条或留 base64）现在不写，Phase C 实现完就得返工。
- **per-root-frame 键控**：制作清单（L3 已定方向）要求一份文档多类型并存，而 Layer 0 的注册表和 Manifest 节点都是文档级设计，Phase B 做完即过时。

**修订**：Layer 3 补 media elision 规则；Layer 0 注册表现在就按 rootFrameId 键控（成本近零，日后改伤筋动骨）。

## 问题 5：验收缺质量维度，Phase E 价值存疑

- C6/E5 验收只有 token 对比 + 重跑冒烟，没有质量判据——窗口化裁掉上下文后设计质量是否下降无人判定（呼应 eval 体系缺失，见 `2026-07-27-agent-design-review.md` 第二部分 §2）。
- Phase E 软门控（`_phase` 尾标 + 跨阶段 warning）每条工具结果都加噪音，按"注入可靠性排序"方法论属于第三级，AI 大概率无视。

**修订**：Phase E 砍掉，跨阶段 warning 合并进 validate；Phase C 验收增加质量对照（同一需求窗口化前后各跑一次，人工对比产出）。

## 修订后的实施顺序

```
A0（token 基线）
  → 视觉回路 V0（见 ../plans/l2-visual-loop.md，其结论决定 Phase C 的 media 设计深度）
  → B（单源化 Manifest + 推导制状态 + per-rootFrame 键控）
  → C（窗口化：保留用户消息 + media elision）
  → A/D（prompt 拆分 + patterns 注册表，顺序可互换）
  → 砍 E
```