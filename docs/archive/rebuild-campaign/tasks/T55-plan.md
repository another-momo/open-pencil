<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 本文只保留当前态，不保留修正历史
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# T55 计划 · Phase 3 W2/T-B4：look 移植（通道 A + 媒体元数据字段化）

> **状态**：✅ 已完成（2026-09-01 收口） | **时间**：2026-08-31 立项 | **负责人**：主 agent + 实现 subagent
> **规格真源**：[S3-tool-contracts-spec.md §5/§10](../../../doc/S3-tool-contracts-spec.md)、[S4-phase3-plan.md §4](../../../doc/S4-phase3-plan.md) T-B4 行
> **移植源**：`open-pencil` 仓 feature/agent-backend @ 5d38aa4e：packages/core/src/tools/marketing/look.ts（370 行）；vision.ts（178 行）仅作通道 B 语义参考，**本任务不建通道 B**（S3 §1：侧信道=后续）

## 1. 背景与方案

look = AI 的「看图」工具。按 S3 §5 契约移植：

- **三档导出模式自动选择**：原图直出（节点本身 IMAGE fill）/ 孤立渲染 / 带上下文渲染——选择逻辑随源自带。
- **缩放策略**：长边 >1024 压缩、<512 上采样 ×4。
- **通道 A**：base64 图像进主对话。旧 `MEDIA_OUTPUT_TOOLS` 常量机制字段化——**不落 schema.ts**（上游文件不加字段），媒体输出工具登记表放 pi-backend 侧（ownedRoot），mapping 层（src/app/ai/pi-backend/mapping.ts，实测为事件映射器，2026-08-31）把登记工具的文本结果转媒体块。登记集合成文 + 钉扎测试。
- **主机能力前置**（01 §8 锚定）：`exportImage` 的 `renderInContext`/`clip` 选项必须实现——目标仓现状由实现期勘察（packages/core 既有 export-image 面，`tests/engine/tools/export-image.test.ts` 在案）；缺失则补实现，属上游区改动由主 agent 集成期登记 patch。
- **终审纪律进 workflow 文件**（禁止从全览判断小字、分区钻取验收）——属 T-C2 内容面，本任务只确保 look 返回结构承载分区信息（nodeId/bounds），不写 workflow 文案。
- **elision 不建**（12 册 O1：仅通道 A 启用时才建，~0.5-1 人日 context event 钩子；通道 A 本任务上线但 elision 机制归后续任务——S4 §7 尾巴表登记）。

**文件布局**（ownedRoots 内）：

| 文件 | 内容 |
|---|---|
| packages/core/src/tools/fork/marketing/look.ts | look 实现 + ToolDef（与 T52 同 folder 不同文件，无冲突） |
| src/app/ai/pi-backend/ 媒体登记 + mapping 适配（1-2 文件，实现期定名） | 媒体输出工具登记集合 + 结果转媒体块 |
| tests/engine/rebuild/marketing/look.test.ts | 契约测试（S3 §10：三档导出/缩放/通道 A 断言） |

**与 T52 的交界**：look 消费 brief 素材条目的 `imageNodeId`（T52 暴露）；两任务并行期以 S3 §3 字段名为契约，不测跨任务集成（集成冒烟归 T-D1）。

## 2. 不做清单

- 通道 B（独立视觉模型侧信道）与 vision.ts 客户端重写——后续任务。
- elision（保留最近 K 张）机制。
- workflow 文件的终审纪律文案（T-C2）。

## 3. 验收标准

1. `bun test tests/engine/rebuild/marketing/look.test.ts` 全绿：三档模式各自触发条件、缩放边界（1024 压缩 / 512 上采样×4 / 区间内原样）、`renderInContext`/`clip` 选项行为、返回结构含图像数据 + 节点元数据。
2. 媒体登记钉扎：登记集合含 look；mapping 层对登记工具结果产出媒体块（单测）。
3. `bun test tests/engine/rebuild/` 全绿不回退；九门禁全绿；全量回归失败数不增（对照 T51 基线）。
4. CI 逐 push 口径绿。

## 4. 红线

- 不改 schema.ts 加元数据字段（媒体登记走 pi-backend 侧方案）。
- 不建通道 B 任何桩代码（空函数/占位一律不留）。
- 并行波次纪律：禁止 commit/push；禁止碰 fork/index.ts 与 pi-backend/tools.ts 装配段；禁止改 zones.json/tracker/_index。
