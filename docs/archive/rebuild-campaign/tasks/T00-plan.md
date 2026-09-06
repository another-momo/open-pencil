<!--
  写作纪律（改本文前必读）：
  - 事实性声明必须附核验命令 + 日期，否则标为【假设】
  - 计划被实测推翻时，直接改本文为新版本，完整理由记入 records/ 子文档
  - 本文只保留当前态，不保留修正历史
  - 改完后刷新本文头部的「状态」字段
  - 详细规则见 docs/rebuild/05-process.md §4
-->

# tasks/T00-plan.md · T00 任务计划

> **T 编号**：T00（文档治理 · 历史回填）
> **三件套**：
> - 计划：[T00-plan.md](T00-plan.md)（本文件）
> - 自检：[T00-self-check.md](T00-self-check.md)
> - 核验：[T00-verify.md](T00-verify.md)

## 1. 任务概述

整改文档集 v1（commit `a1f92d6e`）—— owner 初审发现"01 能力地图预设顺序错误、缺支撑层"后启动核查轮，4 个只读 subagent 分对 00/01/02/03 + 本地 dsh 实况，主 agent 整体 review，修正落地（v2）。

## 2. 战果

- **01 重构**：能力地图从「按价值分层」改为「按依赖排序」，新增层 0 支撑底座 F0（7 块，含实测发现的生图独立凭证链、MCP 桥三进程、brand 后端服务、prompts 预构建脆依赖）；剔除 phantom（validate 工具、「素材图理解」均实测无代码）
- **02 修正**：locale 算术（删 7 留 zh-CN，非删 8）、虚构 API 名（mergeLocaleMessage → 实为 @nanostores/i18n）、IS_TAURI 实测数字、EditorView 切断点 5+ 处、配置连带面（package.json scripts/deps、knip/steiger/oxlint）、browser-bridge 内部冲突登记
- **03 修正**：pi sdk 先验全部降级为【假设】（本地无包）；dsh 基线改为实测（Cordis 插件模型、session/compaction seam、内容模型支持 tool-result 图片、stdio 子进程嵌入形态、多 provider 实为 pi-ai 驱动——选型的正确对立面是「pi sdk 直接驱动 vs Cordis + pi-ai」）

## 3. 关联记录

- `records/topics/docs-governance.md` ROT-1 ~ ROT-14（R1-R4 核查结果）
- `records/topics/docs-governance.md` R1 / R2 / R3 / R4 子条目

## 4. 身份

T00 = 文档集 v1 整改 task 档案。原位于 [05-process.md §5](05-process.md)，按 [05-process.md §3.2](05-process.md) task 维度分离规则迁移至此。
