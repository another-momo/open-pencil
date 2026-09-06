<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# records/topics/brand-config.md · brand config / type / profile

> **状态**：已建立 | **时间**：2026-08-28 | **核验人**：主 agent
> **身份**：brand config 相关决策与核验记录。

---

## 决策类

## D1 · 参考图机制形态

- **类型**：决策
- **状态**：**已拍板**（owner，2026-08-28）
- **拍板内容**：不设专门参考图/参考区机制（原候选 a) 文档内参考区 page 与 b) 收编 brand config 均不建）——需要参考时由用户指定画布节点作为 ref 传入。C2/C3 边界压力解除；C3a 生图工具的参考输入形态 = 画布节点引用。
- **归属**：C2/C3 边界

## D2 · vision 通道 B 去留

- **类型**：决策
- **时间**：2026-08-20 16:45
- **拍板**：owner
- **状态**：已拍板 B 默认
- **内容**：B 为默认（不进主 agent 上下文 → 成本优势 + 可换视觉模型），A 为备选
- **理由**：R2 实测：双份视觉回路 + 独立凭证是旧仓奠基代码；visionB 产品正确方向是「图片不进主 prompt」；spike 02 重新评估：pi 与 dsh 共用 pi-ai 的多模态路径，通道 B 与通道 A 是同 provider 配置下的两个调用形态选择，不增加工程复杂度

## D2a · vision 通道 A 何时降级

- **类型**：决策
- **时间**：2026-08-20 16:50
- **拍板**：owner
- **内容**：主 agent 需要看图（如 `setup_material_type` 自动判断 frame 内配色）或视觉模型质量不足时降级到 A
- **理由**：A/B 同 provider 配置下两个调用形态——工程实现是同一段 RPC 路径，差异仅在「图字段不进 message 还是进」

---

## 核验类

## V2 · 营销+生图测试 + brand config 实测

- **类型**：核验
- **时间**：2026-08-18 14:00
- **方法**：`bun test ./tests/engine/tools/marketing ./tests/engine/tools/image-gen`
- **结论**：16 文件全绿，运行时报告 224 通过
- **brand config 实测（核验人：subagent B R2）**：7 type + 8 profile，config.yaml 303 行

---

## D6 · 中文字体策略

- **类型**：决策
- **时间**：2026-08-28
- **拍板**：owner
- **状态**：已拍板
- **内容**：**S3 混合路线**——CDN 按需子集 + bundled 子集兜底（预研集 `docs/202608251637-migration-proposal/13-font-subset-loading-proposal.md` 的 Phase 0-5 管线可作 CDN 路线的实施蓝图参考；fork 自带 tools/font-subset bundled 管线作离线兜底）。**公共前置**（无论后续实施细节）：font-subset 工具链 + 字体授权 tier 登记。
- **未决另议**：O3 本地字体字重匹配放宽与否（行为变更）不在本次拍板范围，保持 open。
- **归属**：E1