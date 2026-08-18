# 01 · 目标态定义

> 日期：2026-08-18 | 本文是「做哪些加法」的唯一依据。能力块的增删改先改本文，再动工。

## 1. 一句话定义

**一个 localhost 形态的营销设计 AI 工作台**：用户在上游编辑器画布上，用「需求单 + 品牌配置（type/profile）」驱动 AI 完成营销物料设计；agent runtime 建在 pi sdk / dsh 上、可再替换；编辑器内核永久跟随上游。

架构前提（已实测成立）：工具定义在 core、与 runtime 无关；工具经 WebSocket 在编辑器内执行，agent 后端不碰 SceneGraph。

## 2. 能力地图

| 层 | 块 | 内容 | 处置 | 验收 |
|---|---|---|---|---|
| **核心价值闭环** | C1 需求单 | 画布 brief 帧（素材区 / AI 结论区）、brief↔设计绑定、BriefPanelDialog、素材图理解（hash 缓存描述） | 移植，语义由测试锁定 | brief 系列测试 |
| | C2 品牌配置 | config.yaml（type + profile + `applicable_to` + markdown 风格指南）、loader/repository、overlay 注入、ConfigBar / ProfileGallery / BrandConfigPanel | 数据逐字搬；UI 复审 | overlay / library 测试 |
| | C3 核心工具链 | setup_material_type、generate_image（references / composite / replace_id / 历史快照）、look、compose_backdrop、sample_hero_color | 移植，测试即规约 | 16 文件 224 用例 |
| | C4 视觉回路 | look 图片投递（多模态 tool-result）、媒体省略策略 | **对新 runtime 重写**（见 03） | 视觉回路测试 |
| | C5 Chat UI | ChatInput / ChatMessage / ChatPanel（拥有区） | 移植 + 复审 | 端到端冒烟 |
| **支撑机制** | B1 Agent runtime | session 持久化（pluginData 关联文件）、工具审批、skills、多 provider | **重建**（pi sdk / dsh） | 能力契约测试 |
| | B2 工具执行桥 | automation / WebSocket RPC + core 工具定义 | 移植（已 runtime 无关），扩审批往返 | 工具桥测试 |
| | B3 凭证 | keyring + provider 配置 | 移植并简化 | — |
| | B4 serve 入口 | `packages/cli` → serve 命令 + 文件 API | 小规模重建 | 启动冒烟 |
| **引擎补丁** | P1~Pn | imageCache LRU（OOM）、CJK 回退、JSX 容错、render 管道等 | 编号登记、随需移入，各带回归测试 | 对应回归测试 |
| **产品化** | F1 | rebrand、zh-cn + en 双语、CI 发版 | 最后做 | CI 绿 |

**最小价值闭环**（第一刀）：需求单 → 选 type/profile → generate_image → look → 迭代。
闭环只切 C1/C2/C3/C4/C5 被经过的最薄切片；validate、生图历史、ProfileGallery 精化、references 软过滤等均为后续独立加法，每块自带测试单独进入。

## 3. 不加清单（和加法同等重要）

- .fig 素材库机制——已被 config.yaml 取代（旧分支实测：`public/default-library.fig`、生成器均不存在）。别让旧文档复活它。
- `src/components/L3/` 工作台目录——旧分支实测已不存在，需求单 UI 在 `src/components/chat/`。
- AI SDK agent loop + 前端 session 管理——被 B1 取代，`packages/agent` 42 文件整体不移植。
- validate 的 readonly baseline 机制——已废弃的语义。
- ACP / collab / desktop / demos / docs 站——删除区，永不回来。

## 4. 待拍板决策（拍板前对应块不动工）

| # | 决策 | 选项 | 影响 |
|---|---|---|---|
| D1 | 参考图机制的形态 | a) 文档内「参考区」page（现状）b) 收编进 brand config | C2/C3 边界 |
| D2 | vision 通道 B（独立视觉模型）去留 | a) 保留独立凭证 b) 并入统一 provider 配置 c) 砍掉 | C4 复杂度 |
| D3 | session 模型 | a) 一文件一 session b) 一文件多 session | B1 数据模型 + C5 UI |
| D4 | 产品形态 | localhost serve 单用户是否为定论 | B4 + Phase 0 中 cli 包去留 |

## 5. parity 线（新旧分支切换标准）

**最小价值闭环端到端跑通 + 224 条移植测试全绿 + CI 绿**。
不是「旧功能全搬完」——搬不完的增强项让它们在旧分支自然死亡，这正是重建要甩掉的东西。
